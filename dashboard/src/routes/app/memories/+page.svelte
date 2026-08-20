<script lang="ts">
	import {
		Plus,
		Trash2,
		Archive,
		ArchiveRestore,
		Search,
		SlidersHorizontal,
		LoaderCircle
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { toast } from 'svelte-sonner';
	import { getMemories, getNamespaces, removeMemory, updateMemoryData } from '$lib/remote/index.js';
	import { auth, isAuthed } from '$lib/auth.svelte';
	import { timeAgo, importancePct, TYPE_BADGE, truncate } from '$lib/format.js';
	import MemoryFormDialog from '$lib/components/memory-form-dialog.svelte';
	import { page } from '$app/state';
	import { MEMORY_TYPES } from '@sepia/shared';

	const namespaces = $derived(isAuthed() ? getNamespaces(auth.token) : null);
	let namespaceList = $state<string[]>([]);

	$effect(() => {
		namespaces?.then((ns) => {
			namespaceList = ns.map((n) => n.name);
		});
	});

	let type = $state('all');
	let namespace = $state('all');
	let archived = $state(false);
	let q = $state('');
	let minImportance = $state(0);
	let limit = $state(20);
	let offset = $state(0);

	let memories = $state<Awaited<ReturnType<typeof getMemories>>>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let error = $state('');

	let showCreate = $state(false);

	async function load() {
		loading = true;
		error = '';
		offset = 0;
		try {
			memories = await getMemories([
				auth.token,
				{
					type:
						type === 'all'
							? undefined
							: (type as 'fact' | 'observation' | 'preference' | 'instruction'),
					namespace: namespace === 'all' ? undefined : namespace,
					archived,
					importance_min: minImportance > 0 ? minImportance : undefined,
					limit,
					offset: 0
				}
			]);
			hasMore = memories.length >= limit;
		} catch (e) {
			error = (e as Error)?.message ?? 'Failed to load memories';
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore) return;
		loadingMore = true;
		error = '';
		try {
			const next = await getMemories([
				auth.token,
				{
					type:
						type === 'all'
							? undefined
							: (type as 'fact' | 'observation' | 'preference' | 'instruction'),
					namespace: namespace === 'all' ? undefined : namespace,
					archived,
					importance_min: minImportance > 0 ? minImportance : undefined,
					limit,
					offset: offset + limit
				}
			]);
			memories = [...memories, ...next];
			offset += limit;
			hasMore = next.length >= limit;
		} catch (e) {
			error = (e as Error)?.message ?? 'Failed to load more memories';
		} finally {
			loadingMore = false;
		}
	}

	async function del(id: string) {
		if (!confirm('Delete this memory permanently?')) return;
		await removeMemory([auth.token, id]);
		toast.success('Memory deleted');
		load();
	}

	async function toggleArchive(m: { id: string; archived: boolean | null }) {
		await updateMemoryData([auth.token, String(m.id), { archived: !m.archived }]);
		toast.success(m.archived ? 'Restored from archive' : 'Archived');
		load();
	}

	// Open the create dialog when navigated with ?new=1
	$effect(() => {
		if (page.url.searchParams.get('new') === '1') {
			showCreate = true;
			history.replaceState(null, '', '/memories');
		}
	});

	// Initial load
	$effect(() => {
		load();
	});
</script>

<svelte:head><title>Sepia — Memories</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Memories</h1>
			<p class="text-sm text-muted-foreground">Browse and manage knowledge fragments.</p>
		</div>
		<Button onclick={() => (showCreate = true)}>
			<Plus class="size-4" /> New memory
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
					placeholder="Filter by text…"
					class="pl-9"
					onkeydown={(e) => {
						if (e.key === 'Enter') load();
					}}
				/>
			</div>
			<select
				bind:value={type}
				class="h-9 rounded-md border border-input bg-background px-3 text-sm"
				aria-label="Type filter"
			>
				<option value="all">All types</option>
				{#each MEMORY_TYPES as t}
					<option value={t}>{t}</option>
				{/each}
			</select>
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
			<select
				bind:value={minImportance}
				class="h-9 rounded-md border border-input bg-background px-3 text-sm"
				aria-label="Minimum importance"
			>
				<option value={0}>Any importance</option>
				<option value={0.3}>≥ 30%</option>
				<option value={0.5}>≥ 50%</option>
				<option value={0.7}>≥ 70%</option>
				<option value={0.9}>≥ 90%</option>
			</select>
			<label class="flex items-center gap-2 text-sm">
				<Switch bind:checked={archived} />
				Show archived
			</label>
			<Button variant="outline" onclick={load}>Apply</Button>
		</CardContent>
	</Card>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	{#if loading}
		<div class="space-y-2">
			{#each [0, 1, 2, 3, 4] as _}
				<Skeleton class="h-20 w-full" />
			{/each}
		</div>
	{:else if memories.length === 0}
		<Card>
			<CardContent class="py-10 text-center text-sm text-muted-foreground">
				No memories match these filters.
			</CardContent>
		</Card>
	{:else}
		<div class="space-y-2">
			<p class="text-xs text-muted-foreground">
				Showing {memories.length} memories{hasMore ? ' — load more to see the rest' : ''}
			</p>
			{#each memories as m}
				<Card>
					<CardContent class="p-4">
						<div class="flex items-start justify-between gap-3">
							<a href={`/app/memories/${m.id}`} class="min-w-0 flex-1">
								<p class="text-sm">{truncate(m.content, 300)}</p>
								<div class="mt-2 flex flex-wrap items-center gap-2">
									<Badge class={TYPE_BADGE[m.type as keyof typeof TYPE_BADGE] ?? ''}>{m.type}</Badge
									>
									<span class="text-xs text-muted-foreground">{m.namespace}</span>
									<span class="text-xs text-muted-foreground">· {importancePct(m.importance)}%</span
									>
									<span class="text-xs text-muted-foreground">· {timeAgo(m.updatedAt)}</span>
									{#if m.archived}
										<Badge variant="outline">archived</Badge>
									{/if}
								</div>
							</a>
							<div class="flex shrink-0 gap-1">
								<Button
									variant="ghost"
									size="icon"
									onclick={() => toggleArchive(m)}
									aria-label={m.archived ? 'Restore' : 'Archive'}
								>
									{#if m.archived}
										<ArchiveRestore class="size-4" />
									{:else}
										<Archive class="size-4" />
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => del(String(m.id))}
									aria-label="Delete"
								>
									<Trash2 class="size-4 text-destructive" />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
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

	<MemoryFormDialog bind:open={showCreate} namespaces={namespaceList} onSaved={load} />
</div>
