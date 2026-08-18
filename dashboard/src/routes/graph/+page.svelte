<script lang="ts">
	import { Search, ZoomIn, ZoomOut, Maximize, LoaderCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { getGraph, getEntities, getStatsData } from '$lib/remote/index.js';
	import { auth } from '$lib/auth.svelte';
	import { entityTypeBadge, importancePct } from '$lib/format.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import cytoscape from 'cytoscape';
	import dagre from 'cytoscape-dagre';

	cytoscape.use(dagre);

	let container = $state<HTMLDivElement | null>(null);
	let cy = $state<cytoscape.Core | null>(null);

	let rootId = $state('');
	let depth = $state(2);
	let graphData = $state<Awaited<ReturnType<typeof getGraph>> | null>(null);
	let loading = $state(true);
	let error = $state('');

	let rootSearch = $state('');
	let rootResults = $state<Awaited<ReturnType<typeof getEntities>>>([]);

	// Pick a default root: the ?focus= param, else the most-accessed entity.
	$effect(() => {
		const focus = page.url.searchParams.get('focus');
		if (focus) {
			rootId = focus;
		} else if (!rootId) {
			getStatsData(auth.token).then((s) => {
				if (s.top_entities[0]) rootId = s.top_entities[0].id;
			});
		}
	});

	async function loadGraph() {
		if (!rootId) return;
		loading = true;
		error = '';
		try {
			graphData = await getGraph([auth.token, { start_id: rootId, depth }]);
		} catch (e) {
			error = (e as Error)?.message ?? 'Failed to load graph';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (rootId) loadGraph();
	});

	// Render the graph when data + container are ready.
	$effect(() => {
		if (!container || !graphData) return;
		if (cy) {
			cy.destroy();
			cy = null;
		}

		const typeColors: Record<string, string> = {
			person: '#f43f5e',
			project: '#0ea5e9',
			tool: '#14b8a6',
			concept: '#6366f1',
			repo: '#71717a'
		};

		const nodes = graphData.nodes.map((n) => ({
			data: {
				id: n.id,
				label: n.label,
				type: n.type,
				importance: n.importance
			}
		}));
		const edges = graphData.edges.map((e) => ({
			data: {
				id: e.id,
				source: e.source,
				target: e.target,
				label: e.label,
				weight: e.weight
			}
		}));

		const instance = cytoscape({
			container,
			elements: [...nodes, ...edges],
			style: [
				{
					selector: 'node',
					style: {
						'background-color': (el: cytoscape.NodeSingular) =>
							typeColors[el.data('type')] ?? '#a1a1aa',
						label: 'data(label)',
						'font-size': 11,
						'text-valign': 'bottom',
						'text-margin-y': 4,
						'text-wrap': 'ellipsis',
						'text-max-width': '120',
						width: (el: cytoscape.NodeSingular) => String(24 + (el.data('importance') ?? 0.5) * 40),
						height: (el: cytoscape.NodeSingular) =>
							String(24 + (el.data('importance') ?? 0.5) * 40),
						'border-width': 2,
						'border-color': '#ffffff'
					}
				},
				{
					selector: 'edge',
					style: {
						width: (el: cytoscape.EdgeSingular) => String(1 + (el.data('weight') ?? 0.5) * 2),
						'line-color': '#cbd5e1',
						'curve-style': 'bezier',
						'target-arrow-color': '#cbd5e1',
						'target-arrow-shape': 'triangle',
						label: 'data(label)',
						'font-size': 9,
						'text-rotation': 'autorotate',
						'text-background-color': '#ffffff',
						'text-background-opacity': 0.8,
						'text-background-padding': '2'
					}
				}
			],
			layout: {
				name: 'dagre',
				rankDir: 'LR',
				spacingFactor: 1.2,
				padding: 30
			} as cytoscape.LayoutOptions
		});

		instance.on('tap', 'node', (evt) => {
			const id = evt.target.id();
			goto(`/entities/${id}`);
		});

		cy = instance;
	});

	$effect(() => {
		return () => {
			if (cy) {
				cy.destroy();
				cy = null;
			}
		};
	});

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
			BFS traversal from a root entity. Click a node to open it.
		</p>
	</div>

	<Card>
		<CardContent class="flex flex-wrap items-end gap-3 p-4">
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
						{#each rootResults as r}
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
		</CardContent>
	</Card>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	<Card>
		<CardContent class="p-0">
			{#if loading}
				<Skeleton class="h-120 w-full rounded-none" />
			{:else if graphData && graphData.nodes.length > 0}
				<div class="relative">
					<div
						bind:this={container}
						class="h-120 w-full"
						role="img"
						aria-label="Knowledge graph visualization"
					></div>
					<div class="absolute top-3 right-3 flex flex-col gap-1">
						<Button
							variant="outline"
							size="icon"
							onclick={() => cy?.zoom(cy.zoom() * 1.2)}
							aria-label="Zoom in"
						>
							<ZoomIn class="size-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onclick={() => cy?.zoom(cy.zoom() * 0.8)}
							aria-label="Zoom out"
						>
							<ZoomOut class="size-4" />
						</Button>
						<Button variant="outline" size="icon" onclick={() => cy?.fit()} aria-label="Fit graph">
							<Maximize class="size-4" />
						</Button>
					</div>
					<div
						class="absolute bottom-3 left-3 rounded-md bg-background/90 p-2 text-xs text-muted-foreground"
					>
						{graphData.nodes.length} nodes · {graphData.edges.length} edges · depth {graphData.depth_reached}
					</div>
				</div>
			{:else}
				<div class="flex h-120 items-center justify-center text-sm text-muted-foreground">
					Pick a root entity to explore the graph.
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
