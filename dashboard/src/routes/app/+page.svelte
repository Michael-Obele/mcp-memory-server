<script lang="ts">
	import {
		Search,
		Layers,
		Boxes,
		Network,
		RefreshCw,
		Plus,
		Database,
		Clock,
		LoaderCircle
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { toast } from 'svelte-sonner';
	import { getStatsData, searchAll, runConsolidate, getNamespaces } from '$lib/remote/index.js';
	import { auth, isAuthed } from '$lib/auth.svelte';
	import { formatDate, timeAgo, importancePct, TYPE_BADGE, truncate } from '$lib/format.js';
	import { goto } from '$app/navigation';

	// Only create queries when signed in — avoids SSR calls with an empty token.
	const stats = $derived(isAuthed() ? getStatsData(auth.token) : null);
	const namespaces = $derived(isAuthed() ? getNamespaces(auth.token) : null);

	let q = $state('');
	let namespace = $state('all');
	let results = $state<Awaited<ReturnType<typeof searchAll>> | null>(null);
	let searching = $state(false);

	async function doSearch() {
		searching = true;
		try {
			results = await searchAll([
				auth.token,
				{
					q,
					namespace: namespace === 'all' ? undefined : namespace,
					limit: 10
				}
			]);
		} finally {
			searching = false;
		}
	}

	async function consolidate() {
		const res = await runConsolidate(auth.token);
		toast.success('Consolidation complete', {
			description: `${res.archived_stale} stale, ${res.archived_duplicates} duplicates archived, ${res.purged} purged`
		});
		stats?.refresh();
	}

	function resultHref(r: { kind: string; id: string }) {
		return r.kind === 'entity' ? `/app/entities/${r.id}` : `/app/memories/${r.id}`;
	}
</script>

<svelte:head><title>Sepia — Search</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold tracking-tight">Memory</h1>
		<p class="text-sm text-muted-foreground">
			Search everything your AI agents have stored — memories, entities, and relations.
		</p>
	</div>

	{#if stats}
		{#await stats}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each [0, 1, 2, 3] as _}
					<Skeleton class="h-24 w-full" />
				{/each}
			</div>
		{:then s}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent class="flex items-center gap-3 p-4">
						<div
							class="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
						>
							<Database class="size-5" />
						</div>
						<div>
							<p class="text-2xl font-semibold">{s.memories}</p>
							<p class="text-xs text-muted-foreground">Memories</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="flex items-center gap-3 p-4">
						<div
							class="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
						>
							<Boxes class="size-5" />
						</div>
						<div>
							<p class="text-2xl font-semibold">{s.entities}</p>
							<p class="text-xs text-muted-foreground">Entities</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="flex items-center gap-3 p-4">
						<div
							class="flex size-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
						>
							<Network class="size-5" />
						</div>
						<div>
							<p class="text-2xl font-semibold">{s.relations}</p>
							<p class="text-xs text-muted-foreground">Relations</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="flex items-center gap-3 p-4">
						<div
							class="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
						>
							<RefreshCw class="size-5" />
						</div>
						<div>
							<p class="text-2xl font-semibold">{s.decay_candidates}</p>
							<p class="text-xs text-muted-foreground">Decay candidates</p>
						</div>
					</CardContent>
				</Card>
			</div>
		{:catch e}
			<p class="text-sm text-destructive">Failed to load stats: {e?.message ?? 'unknown error'}</p>
		{/await}
	{/if}

	<Card>
		<CardHeader>
			<CardTitle class="text-base">Search</CardTitle>
			<CardDescription>Same engine as the MCP search tool.</CardDescription>
		</CardHeader>
		<CardContent class="space-y-3">
			<div class="flex flex-col gap-2 sm:flex-row">
				<div class="relative flex-1">
					<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						bind:value={q}
						placeholder="Search memories and entities…"
						class="pl-9"
						onkeydown={(e) => {
							if (e.key === 'Enter') doSearch();
						}}
					/>
				</div>
				<select
					bind:value={namespace}
					class="h-9 rounded-md border border-input bg-background px-3 text-sm"
					aria-label="Namespace filter"
				>
					<option value="all">All namespaces</option>
					{#if namespaces}
						{#await namespaces}
							<option disabled>Loading…</option>
						{:then ns}
							{#each ns as n}
								<option value={n.name}>{n.name}</option>
							{/each}
						{/await}
					{/if}
				</select>
				<Button onclick={doSearch} disabled={searching}>
					{#if searching}<LoaderCircle class="size-4 animate-spin" />{/if}
					Search
				</Button>
			</div>

			{#if results}
				<Separator />
				<div class="space-y-1">
					{#if results.length === 0}
						<p class="py-4 text-center text-sm text-muted-foreground">No results for “{q}”.</p>
					{:else}
						{#each results as r}
							<a
								href={resultHref(r)}
								class="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent"
							>
								<Badge variant="outline" class="mt-0.5 shrink-0">
									{r.kind === 'entity' ? 'Entity' : 'Memory'}
								</Badge>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium">
										{r.kind === 'entity' ? r.name : truncate(r.content ?? '', 120)}
									</p>
									<p class="truncate text-xs text-muted-foreground">
										{r.kind === 'memory' ? truncate(r.content ?? '', 200) : r.snippet}
									</p>
								</div>
								<div class="flex shrink-0 flex-col items-end gap-1">
									<Badge class={TYPE_BADGE[r.type as keyof typeof TYPE_BADGE] ?? ''}>{r.type}</Badge
									>
									<span class="text-xs text-muted-foreground">{importancePct(r.importance)}%</span>
								</div>
							</a>
						{/each}
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>

	<div class="flex flex-wrap gap-2">
		<Button variant="outline" onclick={() => goto('/app/memories?new=1')}>
			<Plus class="size-4" /> New memory
		</Button>
		<Button variant="outline" onclick={() => goto('/app/entities?new=1')}>
			<Plus class="size-4" /> New entity
		</Button>
		<Button variant="outline" onclick={consolidate}>
			<RefreshCw class="size-4" /> Run consolidate
		</Button>
	</div>

	{#if stats}
		{#await stats}
			<Skeleton class="h-40 w-full" />
		{:then s}
			{#if s.recent_memories.length > 0}
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2 text-base">
							<Clock class="size-4" /> Recent memories
						</CardTitle>
						<CardDescription>Most recently updated across all namespaces.</CardDescription>
					</CardHeader>
					<CardContent class="space-y-3">
						{#each s.recent_memories as m}
							<a
								href={`/app/memories/${m.id}`}
								class="block rounded-md p-2 transition-colors hover:bg-accent"
							>
								<div class="flex items-start justify-between gap-3">
									<p class="text-sm">{truncate(m.content, 200)}</p>
									<span class="shrink-0 text-xs text-muted-foreground">{timeAgo(m.updated_at)}</span
									>
								</div>
								<div class="mt-1 flex items-center gap-2">
									<Badge class={TYPE_BADGE[m.type as keyof typeof TYPE_BADGE] ?? ''}>{m.type}</Badge
									>
									<span class="text-xs text-muted-foreground">{m.namespace}</span>
									<span class="text-xs text-muted-foreground">· {importancePct(m.importance)}%</span
									>
								</div>
							</a>
						{/each}
					</CardContent>
				</Card>
			{/if}
		{/await}
	{/if}
</div>
