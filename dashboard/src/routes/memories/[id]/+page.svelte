<script lang="ts">
	import { ArrowLeft, Pencil, Trash2, Archive, ArchiveRestore } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { toast } from 'svelte-sonner';
	import {
		getMemoryDetail,
		removeMemory,
		updateMemoryData,
		getNamespaces
	} from '$lib/remote/index.js';
	import { auth, isAuthed } from '$lib/auth.svelte';
	import { formatDate, importancePct, TYPE_BADGE } from '$lib/format.js';
	import MemoryFormDialog from '$lib/components/memory-form-dialog.svelte';
	import { goto } from '$app/navigation';

	let { params } = $props();

	const memoryId = $derived(params.id);
	const memory = $derived(isAuthed() ? getMemoryDetail([auth.token, memoryId]) : null);
	const namespaces = $derived(isAuthed() ? getNamespaces(auth.token) : null);
	let namespaceList = $state<string[]>([]);
	$effect(() => {
		namespaces?.then((ns) => (namespaceList = ns.map((n) => n.name)));
	});

	let showEdit = $state(false);

	// The memory object passed to the edit dialog (mapped to entity_ids).
	let editMemory = $state<Record<string, unknown> | null>(null);

	$effect(() => {
		memory?.then((m) => {
			editMemory = {
				id: m.id,
				content: m.content,
				type: m.type,
				importance: m.importance,
				namespace: m.namespace,
				entity_ids: m.entities.map((e) => String(e.id))
			};
		});
	});

	async function del() {
		if (!confirm('Delete this memory permanently?')) return;
		await removeMemory([auth.token, params.id]);
		toast.success('Memory deleted');
		goto('/memories');
	}

	async function toggleArchive(m: { archived: boolean | null }) {
		await updateMemoryData([auth.token, params.id, { archived: !m.archived }]);
		toast.success(m.archived ? 'Restored from archive' : 'Archived');
		memory?.refresh();
	}
</script>

<svelte:head><title>Sepia — Memory</title></svelte:head>

<div class="space-y-4">
	<Button variant="ghost" onclick={() => goto('/memories')} class="gap-1">
		<ArrowLeft class="size-4" /> Back to memories
	</Button>

	{#if memory}
		{#await memory}
			<Skeleton class="h-40 w-full" />
		{:then m}
			<Card>
				<CardHeader class="flex-row items-start justify-between gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<Badge class={TYPE_BADGE[m.type as keyof typeof TYPE_BADGE] ?? ''}>{m.type}</Badge>
						<Badge variant="outline">{m.namespace}</Badge>
						{#if m.archived}
							<Badge variant="secondary">archived</Badge>
						{/if}
					</div>
					<div class="flex gap-1">
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
						<Button variant="ghost" size="icon" onclick={() => (showEdit = true)} aria-label="Edit">
							<Pencil class="size-4" />
						</Button>
						<Button variant="ghost" size="icon" onclick={del} aria-label="Delete">
							<Trash2 class="size-4 text-destructive" />
						</Button>
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					<p class="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>

					<div class="grid gap-4 sm:grid-cols-3">
						<div>
							<p class="text-xs text-muted-foreground">Importance</p>
							<p class="text-sm font-medium">{importancePct(m.importance)}%</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Created</p>
							<p class="text-sm font-medium">{formatDate(m.createdAt)}</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Updated</p>
							<p class="text-sm font-medium">{formatDate(m.updatedAt)}</p>
						</div>
					</div>

					{#if m.entities.length > 0}
						<div>
							<p class="mb-2 text-xs text-muted-foreground">Linked entities</p>
							<div class="flex flex-wrap gap-2">
								{#each m.entities as e}
									<a href={`/entities/${e.id}`}>
										<Badge variant="outline" class="hover:bg-accent">{e.name}</Badge>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</CardContent>
			</Card>
		{:catch e}
			<p class="text-sm text-destructive">
				Failed to load memory: {(e as Error)?.message ?? 'not found'}
			</p>
		{/await}
	{/if}

	<MemoryFormDialog
		bind:open={showEdit}
		namespaces={namespaceList}
		memory={editMemory}
		onSaved={() => memory?.refresh()}
	/>
</div>
