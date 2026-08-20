<script lang="ts">
	import { Plus, Search, SlidersHorizontal, LoaderCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { toast } from 'svelte-sonner';
	import { getEntities, getNamespaces, removeEntity } from '$lib/remote/index.js';
	import { auth, isAuthed } from '$lib/auth.svelte';
	import { importancePct, entityTypeBadge, truncate } from '$lib/format.js';
	import EntityFormDialog from '$lib/components/entity-form-dialog.svelte';
	import { page } from '$app/state';
	import { Trash2 } from '@lucide/svelte';

	const namespaces = $derived(isAuthed() ? getNamespaces(auth.token) : null);
	let namespaceList = $state<string[]>([]);
	$effect(() => {
		namespaces?.then((ns) => (namespaceList = ns.map((n) => n.name)));
	});

	let q = $state('');
	let namespace = $state('all');
	let type = $state('');
	let entities = $state<Awaited<ReturnType<typeof getEntities>>>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let error = $state('');
	let showCreate = $state(false);
	const PAGE_SIZE = 50;

	async function load() {
		loading = true;
		error = '';
		try {
			entities = await getEntities([
				auth.token,
				{
					q: q || undefined,
					namespace: namespace === 'all' ? undefined : namespace,
					type: type || undefined,
					limit: PAGE_SIZE
				}
			]);
			hasMore = entities.length >= PAGE_SIZE;
		} catch (e) {
			error = (e as Error)?.message ?? 'Failed to load entities';
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore) return;
		loadingMore = true;
		error = '';
		try {
			const next = await getEntities([
				auth.token,
				{
					q: q || undefined,
					namespace: namespace === 'all' ? undefined : namespace,
					type: type || undefined,
					limit: PAGE_SIZE,
					offset: entities.length
				}
			]);
			entities = [...entities, ...next];
			hasMore = next.length >= PAGE_SIZE;
		} catch (e) {
			error = (e as Error)?.message ?? 'Failed to load more entities';
		} finally {
			loadingMore = false;
		}
	}

	async function del(id: string) {
		if (
			!confirm(
				'Delete this entity? Its relations are removed and linked memories are unlinked (not deleted).'
			)
		)
			return;
		await removeEntity([auth.token, id]);
		toast.success('Entity deleted');
		load();
	}

	$effect(() => {
		if (page.url.searchParams.get('new') === '1') {
			showCreate = true;
			history.replaceState(null, '', '/entities');
		}
	});

	$effect(() => {
		load();
	});
</script>

<svelte:head><title>Sepia — Entities</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Entities</h1>
			<p class="text-sm text-muted-foreground">
				Knowledge-graph nodes — people, projects, tools, concepts.
			</p>
		</div>
		<Button onclick={() => (showCreate = true)}>
			<Plus class="size-4" /> New entity
		</Button>
	</div>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<SlidersHorizontal class="size-4" /> Filters
			</CardTitle>
		</CardHeader>
		<CardContent class="flex flex-wrap items-end gap-3">
			<div class="relative min-w-48 flex-1">
				<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					bind:value={q}
					placeholder="Search by name…"
					class="pl-9"
					onkeydown={(e) => {
						if (e.key === 'Enter') load();
					}}
				/>
			</div>
			<select
				bind:value={namespace}
				class="h-9 rounded-md border border-input bg-background px-3 text-sm"
				aria-label="Namespace filter"
			>
				<option value="all">All namespaces</option>
				{#each namespaceList as n}
					<option value={n}>{n}</option>
				{/each}
			</select>
			<Input bind:value={type} placeholder="Type (e.g. tool)" class="w-40" />
			<Button variant="outline" onclick={load}>Apply</Button>
		</CardContent>
	</Card>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	{#if loading}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each [0, 1, 2, 3, 4, 5] as _}
				<Skeleton class="h-28 w-full" />
			{/each}
		</div>
	{:else if entities.length === 0}
		<Card>
			<CardContent class="py-10 text-center text-sm text-muted-foreground">
				No entities match these filters.
			</CardContent>
		</Card>
	{:else}
		<div class="space-y-3">
			<p class="text-xs text-muted-foreground">
				Showing {entities.length} entities{hasMore ? ' — load more to see the rest' : ''}
			</p>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each entities as e}
					<Card>
						<CardContent class="p-4">
							<div class="flex items-start justify-between gap-2">
								<a href={`/app/entities/${e.id}`} class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{e.name}</p>
									<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
										{truncate(e.summary ?? '', 120)}
									</p>
									<div class="mt-2 flex flex-wrap items-center gap-2">
										<Badge class={entityTypeBadge(e.type)}>{e.type}</Badge>
										<span class="text-xs text-muted-foreground">{importancePct(e.importance)}%</span>
									</div>
								</a>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => del(String(e.id))}
									aria-label="Delete entity"
								>
									<Trash2 class="size-4 text-destructive" />
								</Button>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
			{#if hasMore}
				<div class="flex justify-center pt-2">
					<Button variant="outline" onclick={loadMore} disabled={loadingMore}>
						{#if loadingMore}<LoaderCircle class="size-4 animate-spin" />{/if}
						Load more
					</Button>
				</div>
			{/if}
		</div>
	{/if}

	<EntityFormDialog bind:open={showCreate} namespaces={namespaceList} onSaved={load} />
</div>
