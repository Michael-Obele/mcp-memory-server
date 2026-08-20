<script lang="ts">
	import { Search, LoaderCircle, ChevronDown, Check } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { getGraph, getFullGraph, getEntities, getStatsData } from '$lib/remote/index.js';
	import { auth } from '$lib/auth.svelte';
	import { importancePct } from '$lib/format.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { GraphResult } from '@sepia/shared';

	import {
		forceManyBody,
		forceLink,
		forceCenter,
		forceCollide,
		type SimulationNodeDatum,
		type SimulationLinkDatum
	} from 'd3-force';
	import { curveLinear } from 'd3-shape';
	import { Chart, Link, Layer, Tooltip } from 'layerchart';
	import { ForceSimulation } from 'layerchart/force';
	import { cls } from '@layerstack/tailwind';
	import { clamp, type Prettify } from '@layerstack/utils';

	import { movable } from '$lib/actions/movable';
	import GraphControls from '$lib/components/graph-controls.svelte';

	type GraphNode = { id: string; label: string; type: string; importance: number };
	type GraphEdge = { id: string; source: string; target: string; label: string; weight: number };

	type SimNode = Prettify<GraphNode & SimulationNodeDatum>;
	// Omit source/target from GraphEdge so the SimulationLinkDatum's
	// `NodeDatum | string | number` union isn't collapsed to `string`.
	type SimLink = Prettify<Omit<GraphEdge, 'source' | 'target'> & SimulationLinkDatum<SimNode>>;

	const typeColors: Record<string, string> = {
		person: '#f43f5e',
		project: '#0ea5e9',
		tool: '#14b8a6',
		concept: '#6366f1',
		repo: '#71717a'
	};

	// Deterministic color for arbitrary/custom entity types so every node in
	// the full graph gets a distinct hue (Obsidian-style).
	const GOLDEN_ANGLE = 137.508;

	function typeHsl(type: string, index: number): string {
		if (type in typeColors) return typeColors[type];
		const hue = (index * GOLDEN_ANGLE) % 360;
		return `hsl(${hue}, 70%, 55%)`;
	}

	// Build a deterministic color map for every type in the current graph.
	const typeColorMap = $derived.by(() => {
		const m = new Map<string, string>();
		allTypes.forEach((t, i) => m.set(t, typeHsl(t, i)));
		return m;
	});

	function nodeColor(type: string): string {
		return typeColorMap.get(type) ?? typeColors[type] ?? 'hsl(0, 0%, 60%)';
	}

	function nodeRadius(n: { importance?: number }): number {
		return 10 + (n.importance ?? 0.5) * 16;
	}

	let mode = $state<'full' | 'focus'>('full');
	let rootId = $state('');
	let depth = $state(2);
	let graphData = $state<GraphResult | null>(null);
	let loading = $state(true);
	let error = $state('');

	let rootSearch = $state('');
	let rootResults = $state<Awaited<ReturnType<typeof getEntities>>>([]);

	let sticky = $state(true);
	let dragging = $state(false);
	let moved = $state(false);
	let hoveredId = $state<string | null>(null);
	let typeFilter = $state<Set<string>>(new Set());

	// Pick a default root: the ?focus= param (→ focus mode), else the
	// most-accessed entity (used if the user switches to focus mode).
	$effect(() => {
		const focus = page.url.searchParams.get('focus');
		if (focus) {
			mode = 'focus';
			rootId = focus;
		} else if (!rootId) {
			getStatsData(auth.token).then((s) => {
				if (s.top_entities[0]) rootId = s.top_entities[0].id;
			});
		}
	});

	async function loadGraph() {
		loading = true;
		error = '';
		try {
			if (mode === 'full') {
				graphData = await getFullGraph(auth.token);
			} else {
				if (!rootId) return;
				graphData = await getGraph([auth.token, { start_id: rootId, depth }]);
			}
		} catch (e) {
			error = (e as Error)?.message ?? 'Failed to load graph';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (mode === 'full') {
			loadGraph();
		} else if (rootId) {
			loadGraph();
		}
	});

	// Fresh copies so the force simulation can mutate them (x/y/vx/vy) freely.
	const simNodes = $derived<SimNode[]>(graphData?.nodes.map((n) => ({ ...n })) ?? []);
	const simLinks = $derived<SimLink[]>(graphData?.edges.map((e) => ({ ...e })) ?? []);

	// Distinct entity types present in the loaded graph (for the type filter).
	const allTypes = $derived([...new Set(simNodes.map((n) => n.type))].sort());

	// Node id → type lookup so edge filtering can resolve string endpoints.
	const nodeTypeById = $derived.by(() => {
		const m = new Map<string, string>();
		for (const n of simNodes) m.set(n.id, n.type);
		return m;
	});

	// Type filter: empty set = show everything.
	const activeTypes = $derived(typeFilter.size === 0 ? null : typeFilter);

	const visibleNodes = $derived(
		activeTypes ? simNodes.filter((n) => activeTypes.has(n.type)) : simNodes
	);

	const visibleLinks = $derived(
		activeTypes
			? simLinks.filter((l) => {
					const src = typeof l.source === 'object' ? l.source.id : String(l.source);
					const tgt = typeof l.target === 'object' ? l.target.id : String(l.target);
					return (
						activeTypes.has(nodeTypeById.get(src) ?? '') &&
						activeTypes.has(nodeTypeById.get(tgt) ?? '')
					);
				})
			: simLinks
	);

	const linkForce = $derived(
		forceLink<SimNode, SimLink>(visibleLinks)
			.id((d) => d.id)
			.distance(90)
			.strength(0.4)
	);
	const chargeForce = forceManyBody<SimNode>().strength(-260);
	const collideForce = forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4);
	const centerForce = forceCenter<SimNode>();

	// Stable object references — ForceSimulation's `watch.pre` on `data` and
	// `forces` only fires when the actual contents change, not on every render.
	// Without this, the simulation restarts on every tick and never settles.
	const simData = $derived({ nodes: visibleNodes, links: visibleLinks });

	let chartSize = $state({ width: 0, height: 0 });
	const onResize = (e: { width: number; height: number }) => {
		chartSize = { width: e.width, height: e.height };
	};

	const simForces = $derived({
		link: linkForce,
		charge: chargeForce,
		collide: collideForce,
		center: centerForce.x(chartSize.width / 2).y(chartSize.height / 2)
	});

	// Neighbours of the hovered node (from the original edges, which keep
	// string source/target ids).
	const neighborIds = $derived.by(() => {
		if (!hoveredId || !graphData) return new Set<string>();
		const set = new Set<string>([hoveredId]);
		for (const e of graphData.edges) {
			if (e.source === hoveredId) set.add(e.target);
			if (e.target === hoveredId) set.add(e.source);
		}
		return set;
	});

	function toggleType(type: string) {
		const next = new Set(typeFilter);
		if (next.has(type)) {
			next.delete(type);
		} else {
			next.add(type);
		}
		typeFilter = next;
	}

	async function searchRoots() {
		if (!rootSearch.trim()) {
			rootResults = [];
			return;
		}
		rootResults = await getEntities([auth.token, { q: rootSearch, limit: 8 }]);
	}

	function pickRoot(id: string, name: string) {
		rootId = id;
		rootSearch = name;
		rootResults = [];
		loadGraph();
	}
</script>

<svelte:head><title>Sepia — Graph</title></svelte:head>

<div class="space-y-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Knowledge graph</h1>
		<p class="text-sm text-muted-foreground">
			Force-directed view of the knowledge graph. Drag nodes, scroll to zoom, drag the background to
			pan. Click a node to open it.
		</p>
	</div>

	<Card>
		<CardContent class="flex flex-wrap items-end gap-3 p-4">
			<div class="space-y-1">
				<span class="text-xs text-muted-foreground">View</span>
				<div class="flex overflow-hidden rounded-md border">
					<button
						type="button"
						onclick={() => (mode = 'full')}
						class={cls(
							'px-3 py-1.5 text-sm transition-colors',
							mode === 'full'
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-muted-foreground hover:bg-accent'
						)}
					>
						Full graph
					</button>
					<button
						type="button"
						onclick={() => (mode = 'focus')}
						class={cls(
							'px-3 py-1.5 text-sm transition-colors',
							mode === 'focus'
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-muted-foreground hover:bg-accent'
						)}
					>
						Focus
					</button>
				</div>
			</div>

			{#if mode === 'focus'}
				<div class="space-y-1">
					<label for="root-search" class="text-xs text-muted-foreground">Root entity</label>
					<div class="relative">
						<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="root-search"
							bind:value={rootSearch}
							placeholder="Search root entity…"
							class="w-56 pl-9"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									searchRoots();
								}
							}}
						/>
					</div>
					{#if rootResults.length > 0}
						<div
							class="absolute z-10 mt-1 max-h-40 w-56 space-y-1 overflow-y-auto rounded-md border bg-background p-1 shadow-md"
						>
							{#each rootResults as r (r.id)}
								<button
									type="button"
									onclick={() => pickRoot(String(r.id), r.name)}
									class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
								>
									<span class="truncate">{r.name}</span>
									<Badge variant="outline">{r.type}</Badge>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="space-y-1">
					<label for="depth-slider" class="text-xs text-muted-foreground">Depth: {depth}</label>
					<input
						id="depth-slider"
						type="range"
						bind:value={depth}
						min={1}
						max={3}
						step={1}
						class="w-32"
						onchange={loadGraph}
						aria-label="Traversal depth"
					/>
				</div>
				<Button onclick={loadGraph} disabled={loading}>
					{#if loading}<LoaderCircle class="size-4 animate-spin" />{/if}
					Traverse
				</Button>
			{/if}

			{#if mode === 'full' && allTypes.length > 0}
				<div class="space-y-1">
					<span class="text-xs text-muted-foreground">Filter by type</span>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="outline" class="gap-2">
								{typeFilter.size === 0
									? 'All types'
									: typeFilter.size === 1
										? '1 type'
										: `${typeFilter.size} types`}
								<ChevronDown class="size-4" />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start" class="max-h-80">
							<DropdownMenu.Item onclick={() => (typeFilter = new Set())}>
								{#if typeFilter.size === 0}
									<Check class="size-4" />
								{:else}
									<span class="size-4"></span>
								{/if}
								All types
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							{#each allTypes as type (type)}
								<DropdownMenu.Item onclick={() => toggleType(type)}>
									{#if typeFilter.has(type)}
										<Check class="size-4" />
									{:else}
										<span class="size-4"></span>
									{/if}
									{type}
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			{/if}

			<label class="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
				<input type="checkbox" bind:checked={sticky} class="size-4 accent-primary" />
				Sticky nodes
			</label>
		</CardContent>
	</Card>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	<Card>
		<CardContent class="p-0">
			{#if loading}
				<Skeleton class="h-120 w-full rounded-none" />
			{:else if graphData && visibleNodes.length > 0}
				<div class="relative">
					<Chart
						transform={{
							mode: 'canvas',
							scrollMode: 'scale',
							scaleExtent: [0.2, 4],
							motion: { type: 'tween', duration: 300 }
						}}
						clip
						height={480}
						{onResize}
					>
						{#snippet children({ context })}
							<Layer>
								{#key `${visibleNodes.length}-${visibleLinks.length}-${mode}`}
									<ForceSimulation forces={simForces} data={simData}>
										{#snippet children({ nodes, simulation, linkPositions })}
											{#each visibleLinks as link, i (link.id)}
												{@const src =
													typeof link.source === 'object' ? link.source.id : link.source}
												{@const tgt =
													typeof link.target === 'object' ? link.target.id : link.target}
												{@const connected =
													hoveredId === null || src === hoveredId || tgt === hoveredId}
												<Link
													data={link}
													{...linkPositions[i]}
													curve={curveLinear}
													class={cls(
														'stroke-muted-foreground/30 transition-opacity',
														hoveredId !== null && !connected && 'opacity-15'
													)}
												/>
											{/each}

											{#each nodes as node, i (node.id)}
												{@const thisNode = simulation.nodes()[i]}
												{@const dimmed = hoveredId !== null && !neighborIds.has(node.id)}
												<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
												<circle
													cx={node.x}
													cy={node.y}
													r={nodeRadius(node)}
													use:movable={{
														onMoveStart: () => {
															context.tooltip.hide();
															dragging = true;
															moved = false;
														},
														onMove: (e) => {
															moved = true;
															thisNode.fx = clamp(
																(thisNode.fx ?? thisNode.x ?? 0) + e.detail.dx,
																0,
																context.width
															);
															thisNode.fy = clamp(
																(thisNode.fy ?? thisNode.y ?? 0) + e.detail.dy,
																0,
																context.height
															);
															simulation.alpha(1).restart();
														},
														onMoveEnd: () => {
															dragging = false;
															if (!sticky) {
																delete thisNode.fx;
																delete thisNode.fy;
																simulation.alpha(1).restart();
															}
														}
													}}
													onclick={() => {
														if (moved) return;
														goto(`/entities/${node.id}`);
													}}
													onpointerenter={() => (hoveredId = node.id)}
													onpointerleave={() => {
														hoveredId = null;
														context.tooltip.hide();
													}}
													onpointermove={(e) => !dragging && context.tooltip.show(e, node)}
													class={cls(
														'cursor-grab transition-opacity select-none',
														dimmed && 'opacity-20'
													)}
													fill={nodeColor(node.type)}
													stroke="var(--color-background)"
													stroke-width={2}
												/>
												<text
													x={node.x}
													y={(node.y ?? 0) + nodeRadius(node) + 12}
													text-anchor="middle"
													class={cls(
														'pointer-events-none fill-muted-foreground/80 text-[10px] transition-opacity select-none',
														dimmed && 'opacity-20'
													)}
												>
													{node.label}
												</text>
											{/each}
										{/snippet}
									</ForceSimulation>
								{/key}
							</Layer>

							<GraphControls />

							<Tooltip.Root>
								{#snippet children({ data })}
									<Tooltip.Header>{data.label}</Tooltip.Header>
									<Tooltip.List>
										<Tooltip.Item label="Type" value={data.type} />
										<Tooltip.Item
											label="Importance"
											value={importancePct(data.importance)}
											format="integer"
										/>
									</Tooltip.List>
								{/snippet}
							</Tooltip.Root>
						{/snippet}
					</Chart>

					<div
						class="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-md bg-background/90 p-2 text-xs text-muted-foreground"
					>
						<span>
							{visibleNodes.length} nodes · {visibleLinks.length} edges
							{#if mode === 'full'}· full graph{:else}· depth {graphData.depth_reached}{/if}
						</span>
						<span class="flex items-center gap-2">
						{#each allTypes as type (type)}
							<span class="flex items-center gap-1">
								<span class="size-2 rounded-full" style:background={nodeColor(type)}></span>
									{type}
								</span>
							{/each}
						</span>
					</div>
				</div>
			{:else}
				<div class="flex h-120 items-center justify-center text-sm text-muted-foreground">
					{#if mode === 'full'}
						No entities match the selected types.
					{:else}
						Pick a root entity to explore the graph.
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
