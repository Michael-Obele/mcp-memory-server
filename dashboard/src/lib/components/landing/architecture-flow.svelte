<script lang="ts">
	import { Chart, Group, Link, Rect, Layer, Text, Tooltip } from 'layerchart';
	import { Sankey } from 'layerchart/graph';

	// The Sepia architecture as a flow: 12 AI tools + the dashboard funnel
	// through one Bun process on Fly.io into Neon Postgres.
	const data = {
		nodes: [
			{ id: 'Local editors', type: 'client' },
			{ id: 'Web AIs', type: 'client' },
			{ id: 'Dashboard', type: 'client' },
			{ id: 'MCP', type: 'endpoint' },
			{ id: 'REST', type: 'endpoint' },
			{ id: 'Bun', type: 'server' },
			{ id: 'Neon', type: 'db' }
		],
		links: [
			{ source: 'Local editors', target: 'MCP', value: 6 },
			{ source: 'Web AIs', target: 'MCP', value: 6 },
			{ source: 'Dashboard', target: 'REST', value: 1 },
			{ source: 'MCP', target: 'Bun', value: 12 },
			{ source: 'REST', target: 'Bun', value: 1 },
			{ source: 'Bun', target: 'Neon', value: 13 }
		]
	};

	const nodeColors: Record<string, string> = {
		client: 'var(--color-teal-400)',
		endpoint: 'var(--color-indigo-400)',
		server: 'var(--color-violet-400)',
		db: 'var(--color-amber-400)'
	};

	// Each flow takes its source node's hue — distinct per stream and tied to
	// where it comes from. Lighter 300-series variants keep them legible on the
	// dark background.
	const flowColors: Record<string, string> = {
		client: 'var(--color-teal-300)',
		endpoint: 'var(--color-indigo-300)',
		server: 'var(--color-violet-300)',
		db: 'var(--color-amber-300)'
	};

	const roleLabels: Record<string, string> = {
		client: 'Client',
		endpoint: 'Endpoint',
		server: 'Server',
		db: 'Database'
	};

	function nodeColor(node: { type: string }): string {
		return nodeColors[node.type] ?? 'var(--color-muted)';
	}

	function linkColor(link: { source: { type: string } }): string {
		return flowColors[link.source.type] ?? 'var(--color-muted)';
	}
</script>

<Chart {data} flatData={[]} height={420}>
	{#snippet children({ context })}
		<Layer>
			<Sankey nodeId={(d) => d.id} nodeWidth={10} nodePadding={18}>
				{#snippet children({ links, nodes })}
					{@const minX0 = Math.min(...nodes.map((n) => n.x0 ?? 0))}
					{#each links as link ([link.value, link.source.id, link.target.id].join('-'))}
						<Link
							sankey
							data={link}
							strokeWidth={link.width}
							stroke={linkColor(link)}
							class="opacity-80"
							onpointermove={(e) => context.tooltip.show(e, { link })}
							onpointerleave={() => context.tooltip.hide()}
						/>
					{/each}

					{#each nodes as node (node.id)}
						{@const nodeWidth = (node.x1 ?? 0) - (node.x0 ?? 0)}
						{@const nodeHeight = (node.y1 ?? 0) - (node.y0 ?? 0)}
						{@const isLeftColumn = (node.x0 ?? 0) <= minX0 + 1}
						<Group x={node.x0} y={node.y0}>
							<Rect
								width={nodeWidth}
								height={nodeHeight}
								fill={nodeColor(node)}
								class="transition-opacity hover:opacity-80"
								onpointermove={(e) => context.tooltip.show(e, { node })}
								onpointerleave={() => context.tooltip.hide()}
							/>
							<Text
								value={node.id}
								x={isLeftColumn ? -6 : nodeWidth + 6}
								y={nodeHeight / 2}
								textAnchor={isLeftColumn ? 'end' : 'start'}
								verticalAnchor="middle"
								class="pointer-events-none fill-foreground/90 text-xs font-medium"
							/>
						</Group>
					{/each}
				{/snippet}
			</Sankey>
		</Layer>

		<Tooltip.Root>
			{#snippet children({ data: tip })}
				{#if tip?.link}
					<Tooltip.Header>{tip.link.source.id} → {tip.link.target.id}</Tooltip.Header>
					<Tooltip.List>
						<Tooltip.Item label="Flow" value={tip.link.value} format="integer" />
					</Tooltip.List>
				{:else if tip?.node}
					<Tooltip.Header>{tip.node.id}</Tooltip.Header>
					<Tooltip.List>
						<Tooltip.Item label="Role" value={roleLabels[tip.node.type] ?? tip.node.type} />
					</Tooltip.List>
				{/if}
			{/snippet}
		</Tooltip.Root>
	{/snippet}
</Chart>
