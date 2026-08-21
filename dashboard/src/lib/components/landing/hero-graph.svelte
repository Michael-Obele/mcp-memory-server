<script lang="ts">
	import { Chart, Link, Layer, Tooltip } from 'layerchart';
	import { ForceSimulation } from 'layerchart/force';
	import {
		forceManyBody,
		forceLink,
		forceCenter,
		forceCollide,
		type SimulationNodeDatum,
		type SimulationLinkDatum
	} from 'd3-force';
	import { curveLinear } from 'd3-shape';
	import { cls } from '@layerstack/tailwind';
	import { clamp, type Prettify } from '@layerstack/utils';
	import { importancePct } from '$lib/format.js';
	import { movable } from '$lib/actions/movable.js';

	type GraphNode = { id: string; label: string; type: string; importance: number };
	type GraphEdge = { id: string; source: string; target: string; label: string; weight: number };

	type SimNode = Prettify<GraphNode & SimulationNodeDatum>;
	type SimLink = Prettify<Omit<GraphEdge, 'source' | 'target'> & SimulationLinkDatum<SimNode>>;

	// Same type palette as the dashboard graph view, so the hero reads as the
	// real product surface.
	const typeColors: Record<string, string> = {
		person: '#f43f5e',
		project: '#0ea5e9',
		tool: '#14b8a6',
		concept: '#6366f1',
		preference: '#f59e0b',
		secret: '#a855f7'
	};

	const typeLabels: Record<string, string> = {
		person: 'Person',
		project: 'Project',
		tool: 'Tool',
		concept: 'Concept',
		preference: 'Preference',
		secret: 'Secret'
	};

	// A small, realistic slice of a Sepia user's graph — the product's own
	// mechanism, demonstrated live.
	const nodes: SimNode[] = [
		{ id: 'sepia', label: 'sepia', type: 'project', importance: 1 },
		{ id: 'claude', label: 'Claude Code', type: 'tool', importance: 0.9 },
		{ id: 'michael', label: 'Michael', type: 'person', importance: 0.9 },
		{ id: 'mcp', label: 'MCP', type: 'concept', importance: 0.8 },
		{ id: 'apikey', label: 'API key', type: 'secret', importance: 0.8 },
		{ id: 'dark', label: 'prefers dark mode', type: 'preference', importance: 0.7 },
		{ id: 'recall', label: 'zero-reminder recall', type: 'concept', importance: 0.7 },
		{ id: 'fly', label: 'Fly.io', type: 'tool', importance: 0.6 },
		{ id: 'neon', label: 'Neon Postgres', type: 'tool', importance: 0.6 },
		{ id: 'consolidate', label: 'consolidate', type: 'concept', importance: 0.6 },
		{ id: 'netlify', label: 'Netlify', type: 'tool', importance: 0.5 },
		{ id: 'deploy', label: 'deploy: fly.io', type: 'concept', importance: 0.5 }
	];

	const links: SimLink[] = [
		{ id: 'l1', source: 'claude', target: 'mcp', label: 'uses', weight: 0.9 },
		{ id: 'l2', source: 'claude', target: 'dark', label: 'remembers', weight: 0.7 },
		{ id: 'l3', source: 'sepia', target: 'fly', label: 'deployed on', weight: 0.8 },
		{ id: 'l4', source: 'sepia', target: 'neon', label: 'uses', weight: 0.8 },
		{ id: 'l5', source: 'sepia', target: 'netlify', label: 'hosted on', weight: 0.6 },
		{ id: 'l6', source: 'michael', target: 'sepia', label: 'owns', weight: 0.9 },
		{ id: 'l7', source: 'mcp', target: 'claude', label: 'connects', weight: 0.9 },
		{ id: 'l8', source: 'sepia', target: 'recall', label: 'provides', weight: 0.7 },
		{ id: 'l9', source: 'sepia', target: 'consolidate', label: 'runs', weight: 0.6 },
		{ id: 'l10', source: 'claude', target: 'apikey', label: 'uses', weight: 0.8 },
		{ id: 'l11', source: 'michael', target: 'claude', label: 'uses', weight: 0.8 },
		{ id: 'l12', source: 'sepia', target: 'mcp', label: 'exposes', weight: 0.9 },
		{ id: 'l13', source: 'sepia', target: 'deploy', label: 'has', weight: 0.5 }
	];

	function nodeColor(type: string): string {
		return typeColors[type] ?? 'hsl(0, 0%, 60%)';
	}

	function nodeRadius(n: { importance?: number }): number {
		return 9 + (n.importance ?? 0.5) * 9;
	}

	const linkForce = forceLink<SimNode, SimLink>(links)
		.id((d) => d.id)
		.distance(120)
		.strength(0.35);
	const chargeForce = forceManyBody<SimNode>().strength(-240);
	const collideForce = forceCollide<SimNode>().radius((d) => nodeRadius(d) + 8);
	const centerForce = forceCenter<SimNode>();

	let chartSize = $state({ width: 0, height: 0 });
	let dragging = $state(false);
	const onResize = (e: { width: number; height: number }) => {
		chartSize = { width: e.width, height: e.height };
	};

	// Stable references so the simulation settles once instead of restarting
	// on every render (same pattern as the dashboard graph view).
	const simData = $derived({ nodes, links });
	const simForces = $derived({
		link: linkForce,
		charge: chargeForce,
		collide: collideForce,
		center: centerForce.x(chartSize.width / 2).y(chartSize.height / 2)
	});
</script>

<div
	class="relative overflow-hidden rounded-2xl border border-brand/15 bg-card/40 shadow-[0_0_0_1px_rgba(212,149,106,0.04),0_24px_60px_-24px_rgba(0,0,0,0.6)]"
>
	<!-- Window chrome -->
	<div
		class="flex items-center justify-between border-b border-border/50 px-4 py-2.5"
		aria-hidden="true"
	>
		<div class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-rose-500/70"></span>
			<span class="size-2.5 rounded-full bg-amber-500/70"></span>
			<span class="size-2.5 rounded-full bg-emerald-500/70"></span>
		</div>
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<span class="relative flex size-1.5">
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
				></span>
				<span class="relative inline-flex size-1.5 rounded-full bg-emerald-400"></span>
			</span>
			<span class="font-mono">sepia · knowledge graph</span>
		</div>
	</div>

	<Chart height={480} {onResize} class="w-full">
		{#snippet children({ context })}
			<Layer>
				<ForceSimulation forces={simForces} data={simData}>
					{#snippet children({ nodes, simulation, linkPositions })}
						{#each links as link, i (link.id)}
							<Link
								data={link}
								{...linkPositions[i]}
								curve={curveLinear}
								class="stroke-muted-foreground/25"
							/>
						{/each}

						{#each nodes as node, i (node.id)}
							{@const thisNode = simulation.nodes()[i]}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<circle
								cx={node.x}
								cy={node.y}
								r={nodeRadius(node)}
								fill={nodeColor(node.type)}
								stroke="var(--color-background)"
								stroke-width={2}
								use:movable={{
									onMoveStart: () => {
										context.tooltip.hide();
										dragging = true;
									},
									onMove: (e) => {
										thisNode.fx = clamp(
											(thisNode.fx ?? thisNode.x ?? 0) + e.detail.dx,
											0,
											chartSize.width
										);
										thisNode.fy = clamp(
											(thisNode.fy ?? thisNode.y ?? 0) + e.detail.dy,
											0,
											chartSize.height
										);
										simulation.alpha(1).restart();
									},
									onMoveEnd: () => {
										dragging = false;
									}
								}}
								onpointermove={(e) => !dragging && context.tooltip.show(e, node)}
								onpointerleave={context.tooltip.hide}
								class={cls(
									'cursor-grab transition-opacity hover:opacity-80 active:cursor-grabbing',
									node.fx ? 'stroke-primary/60 stroke-2' : ''
								)}
							/>
							<text
								x={node.x}
								y={(node.y ?? 0) + nodeRadius(node) + 13}
								text-anchor="middle"
								class="pointer-events-none fill-muted-foreground/80 text-[10px] select-none"
							>
								{node.label}
							</text>
						{/each}
					{/snippet}
				</ForceSimulation>
			</Layer>

			<Tooltip.Root>
				{#snippet children({ data })}
					<Tooltip.Header>{data.label}</Tooltip.Header>
					<Tooltip.List>
						<Tooltip.Item label="Type" value={typeLabels[data.type] ?? data.type} />
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

	<!-- Legend -->
	<div
		class="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground"
		aria-hidden="true"
	>
		{#each Object.entries(typeColors) as [type, color] (type)}
			<span class="flex items-center gap-1.5">
				<span class="size-2 rounded-full" style="background: {color}"></span>
				{typeLabels[type]}
			</span>
		{/each}
	</div>
</div>
