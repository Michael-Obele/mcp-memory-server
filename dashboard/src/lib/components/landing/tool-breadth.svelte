<script lang="ts">
	import { BarChart, defaultChartPadding } from 'layerchart';

	// Honest operation counts per MCP tool, straight from src/tools/*.ts.
	const data = [
		{ tool: 'manage_entity', ops: 5 },
		{ tool: 'manage_memory', ops: 5 },
		{ tool: 'manage_namespace', ops: 4 },
		{ tool: 'manage_relation', ops: 3 },
		{ tool: 'consolidate', ops: 3 },
		{ tool: 'search', ops: 1 },
		{ tool: 'traverse_graph', ops: 1 }
	];
</script>

<BarChart
	{data}
	x="ops"
	y="tool"
	orientation="horizontal"
	series={[{ key: 'ops', value: 'ops', color: 'var(--color-brand)' }]}
	axis="y"
	rule={false}
	props={{
		yAxis: {
			tickLabelProps: {
				textAnchor: 'start',
				dx: 6,
				dy: 2,
				class: 'text-xs fill-muted-foreground stroke-none'
			},
			tickLength: 0
		},
		xAxis: {
			ticks: [0, 1, 2, 3, 4, 5],
			format: (d) => ''
		}
	}}
	padding={defaultChartPadding({ left: 0, bottom: 16 })}
	height={300}
/>
