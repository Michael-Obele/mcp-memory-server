<script lang="ts">
	import './layout.css';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { auth, isAuthed } from '$lib/auth.svelte';
	import { getToken } from '$lib/session.svelte';
	import SignIn from '$lib/components/sign-in.svelte';

	let { children } = $props();

	// Hydrate the auth token from sessionStorage on the client (module-level
	// $state is shared with SSR, so this must run after hydration).
	$effect(() => {
		auth.token = getToken() ?? '';
	});
</script>

<svelte:head>
	<title>Sepia — Memory Server</title>
	<meta name="description" content="Browse, search, and manage your AI memory knowledge graph." />
</svelte:head>

{#if isAuthed()}
	<Sidebar.Provider>
		<AppSidebar />
		<main class="flex min-h-svh w-full flex-col">
			<Sidebar.Trigger class="mt-2 ml-2" />
			<div class="flex-1 p-4 md:p-6 lg:p-8">
				{@render children()}
			</div>
		</main>
	</Sidebar.Provider>
{:else}
	<SignIn />
{/if}

<Toaster />
