<script lang="ts">
	import './layout.css';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { auth } from '$lib/auth.svelte';
	import { getToken } from '$lib/session.svelte';
	import { Agentation, type AnnotationProps } from 'sv-agentation';
	import { browser, dev } from '$app/environment';

	let playgroundAnnotationProps: AnnotationProps = {
		toolbarPosition: 'bottom-left',
		outputMode: 'forensic',
		pauseAnimations: true,
		clearOnCopy: true,
		includeComponentContext: false,
		includeComputedStyles: false
	};

	let { children } = $props();

	// Hydrate the auth token from sessionStorage on the client (module-level
	// $state is shared with SSR, so this must run after hydration).
	$effect(() => {
		auth.token = getToken() ?? '';
	});
</script>

{@render children()}

<Toaster />

{#if browser && dev}
	<Agentation {...playgroundAnnotationProps} />
{/if}
