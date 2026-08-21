<script lang="ts">
	import {
		Area,
		AreaChart,
		AnnotationPoint,
		defaultChartPadding,
		Highlight,
		LinearGradient,
		Tooltip
	} from 'layerchart';

	// Illustrative growth curve — your graph accumulates as agents work.
	const data = [
		{ week: 'W1', relations: 8, entities: 12, memories: 24 },
		{ week: 'W2', relations: 14, entities: 18, memories: 41 },
		{ week: 'W3', relations: 20, entities: 25, memories: 63 },
		{ week: 'W4', relations: 27, entities: 31, memories: 88 },
		{ week: 'W5', relations: 33, entities: 38, memories: 116 },
		{ week: 'W6', relations: 40, entities: 44, memories: 149 },
		{ week: 'W7', relations: 46, entities: 51, memories: 187 },
		{ week: 'W8', relations: 53, entities: 58, memories: 230 }
	];

	const series = [
		{ key: 'relations', label: 'Relations', color: 'var(--color-violet-400)' },
		{ key: 'entities', label: 'Entities', color: 'var(--color-teal-400)' },
		{ key: 'memories', label: 'Memories', color: 'var(--color-brand)' }
	];
</script>

<AreaChart
	{data}
	x="week"
	{series}
	seriesLayout="stack"
	padding={defaultChartPadding({ right: 10 })}
	height={340}
>
	{#snippet marks({ context })}
		{#each context.series.series as s, i (s.key)}
			<LinearGradient
				stops={s.color
					? [s.color, 'color-mix(in lch, ' + s.color + ' 8%, transparent)']
					: undefined}
				vertical
			>
				{#snippet children({ gradient })}
					<Area seriesKey={s.key} line={{ stroke: s.color }} fill={gradient} fillOpacity={0.35} />
				{/snippet}
			</LinearGradient>
		{/each}
		<Highlight lines points />
	{/snippet}

	{#snippet tooltip({ context })}
		<Tooltip.Root x="pointer" y="pointer" anchor="top" portal={false}>
			{#snippet children({ data })}
				<Tooltip.Header value={data.week} class="text-xs" />
				<Tooltip.List>
					{#each series as s (s.key)}
						<Tooltip.Item label={s.label} value={data[s.key]} color={s.color} />
					{/each}
				</Tooltip.List>
			{/snippet}
		</Tooltip.Root>
	{/snippet}
</AreaChart>
