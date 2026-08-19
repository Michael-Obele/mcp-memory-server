<script lang="ts">
	import { ZoomIn, ZoomOut, Maximize } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getChartContext } from 'layerchart';

	const context = getChartContext();
</script>

<div class="absolute top-3 right-3 z-10 flex flex-col gap-1">
	<Button
		variant="outline"
		size="icon"
		onclick={() => context.transform.setScale(context.transform.scale * 1.2)}
		aria-label="Zoom in"
	>
		<ZoomIn class="size-4" />
	</Button>
	<Button
		variant="outline"
		size="icon"
		onclick={() => context.transform.setScale(context.transform.scale * 0.8)}
		aria-label="Zoom out"
	>
		<ZoomOut class="size-4" />
	</Button>
	<Button
		variant="outline"
		size="icon"
		onclick={() => context.transform.reset()}
		aria-label="Reset view"
	>
		<Maximize class="size-4" />
	</Button>
</div>
