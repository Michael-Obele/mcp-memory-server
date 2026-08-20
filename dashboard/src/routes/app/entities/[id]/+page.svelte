<script lang="ts">
	import { ArrowLeft, Pencil, Trash2, Network, Plus, Link2, Unlink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { toast } from 'svelte-sonner';
	import {
		getEntityDetail,
		removeEntity,
		updateEntityData,
		removeMemory,
		removeRelation,
		addRelation,
		getEntities
	} from '$lib/remote/index.js';
	import { auth, isAuthed } from '$lib/auth.svelte';
	import { formatDate, importancePct, entityTypeBadge, TYPE_BADGE, truncate } from '$lib/format.js';
	import EntityFormDialog from '$lib/components/entity-form-dialog.svelte';
	import { goto } from '$app/navigation';

	let { params } = $props();
	const entityId = $derived(params.id);
	const entity = $derived(isAuthed() ? getEntityDetail([auth.token, entityId]) : null);

	let showEdit = $state(false);
	let editEntity = $state<Record<string, unknown> | null>(null);

	$effect(() => {
		entity?.then((e) => {
			editEntity = {
				id: e.id,
				name: e.name,
				type: e.type,
				summary: e.summary,
				importance: e.importance,
				namespace: e.namespace
			};
		});
	});

	async function del() {
		if (
			!confirm(
				'Delete this entity? Its relations are removed and linked memories are unlinked (not deleted).'
			)
		)
			return;
		await removeEntity([auth.token, entityId]);
		toast.success('Entity deleted');
		goto('/app/entities');
	}

	async function delMemory(id: string) {
		await removeMemory([auth.token, id]);
		toast.success('Memory deleted');
		entity?.refresh();
	}

	async function delRelation(id: string) {
		await removeRelation([auth.token, id]);
		toast.success('Relation deleted');
		entity?.refresh();
	}

	// ── New relation form ───────────────────────────────────────────────────
	let relType = $state('related_to');
	let relTarget = $state('');
	let relWeight = $state(0.5);
	let relSearch = $state('');
	let relResults = $state<Awaited<ReturnType<typeof getEntities>>>([]);
	let relDirection = $state<'out' | 'in'>('out');

	async function searchRelTargets() {
		if (!relSearch.trim()) {
			relResults = [];
			return;
		}
		relResults = await getEntities([auth.token, { q: relSearch, limit: 8 }]);
	}

	async function createRelation() {
		if (!relTarget) {
			toast.error('Choose a target entity');
			return;
		}
		try {
			if (relDirection === 'out') {
				await addRelation([
					auth.token,
					{ source_id: entityId, target_id: relTarget, relation_type: relType, weight: relWeight }
				]);
			} else {
				await addRelation([
					auth.token,
					{ source_id: relTarget, target_id: entityId, relation_type: relType, weight: relWeight }
				]);
			}
			toast.success('Relation created');
			relTarget = '';
			relSearch = '';
			relResults = [];
			entity?.refresh();
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Failed to create relation');
		}
	}
</script>

<svelte:head><title>Sepia — Entity</title></svelte:head>

<div class="space-y-4">
		<Button variant="ghost" onclick={() => goto('/app/entities')} class="gap-1">
		<ArrowLeft class="size-4" /> Back to entities
	</Button>

	{#if entity}
		{#await entity}
			<Skeleton class="h-48 w-full" />
		{:then e}
			<Card>
				<CardHeader class="flex-row items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h1 class="text-xl font-semibold tracking-tight">{e.name}</h1>
							<Badge class={entityTypeBadge(e.type)}>{e.type}</Badge>
							<Badge variant="outline">{e.namespace}</Badge>
						</div>
						{#if e.summary}
							<p class="mt-2 text-sm text-muted-foreground">{e.summary}</p>
						{/if}
					</div>
					<div class="flex shrink-0 gap-1">
						<Button
							variant="outline"
							size="sm"
							onclick={() => goto(`/app/graph?focus=${e.id}`)}
							class="gap-1"
						>
							<Network class="size-4" /> Graph
						</Button>
						<Button variant="ghost" size="icon" onclick={() => (showEdit = true)} aria-label="Edit">
							<Pencil class="size-4" />
						</Button>
						<Button variant="ghost" size="icon" onclick={del} aria-label="Delete">
							<Trash2 class="size-4 text-destructive" />
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div class="grid gap-4 sm:grid-cols-3">
						<div>
							<p class="text-xs text-muted-foreground">Importance</p>
							<p class="text-sm font-medium">{importancePct(e.importance)}%</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Created</p>
							<p class="text-sm font-medium">{formatDate(e.createdAt)}</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Accesses</p>
							<p class="text-sm font-medium">{e.accessCount}</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Tabs value="memories" class="w-full">
				<TabsList>
					<TabsTrigger value="memories">Memories ({e.memories.length})</TabsTrigger>
					<TabsTrigger value="relations"
						>Relations ({e.relations_out.length + e.relations_in.length})</TabsTrigger
					>
				</TabsList>

				<TabsContent value="memories" class="space-y-2">
					{#if e.memories.length === 0}
						<Card>
							<CardContent class="py-8 text-center text-sm text-muted-foreground">
								No memories linked to this entity yet.
							</CardContent>
						</Card>
					{:else}
						{#each e.memories as m}
							<Card>
								<CardContent class="p-4">
									<div class="flex items-start justify-between gap-3">
										<a href={`/app/memories/${m.id}`} class="min-w-0 flex-1">
											<p class="text-sm">{truncate(m.content, 250)}</p>
											<div class="mt-2 flex items-center gap-2">
												<Badge class={TYPE_BADGE[m.type as keyof typeof TYPE_BADGE] ?? ''}
													>{m.type}</Badge
												>
												<span class="text-xs text-muted-foreground"
													>{importancePct(m.importance)}%</span
												>
											</div>
										</a>
										<Button
											variant="ghost"
											size="icon"
											onclick={() => delMemory(String(m.id))}
											aria-label="Delete memory"
										>
											<Trash2 class="size-4 text-destructive" />
										</Button>
									</div>
								</CardContent>
							</Card>
						{/each}
					{/if}
				</TabsContent>

				<TabsContent value="relations" class="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle class="flex items-center gap-2 text-base">
								<Link2 class="size-4" /> New relation
							</CardTitle>
						</CardHeader>
						<CardContent class="space-y-3">
							<div class="flex flex-wrap items-end gap-3">
								<div class="space-y-1">
									<Label>Direction</Label>
									<select
										bind:value={relDirection}
										class="h-9 rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="out">{e.name} → target</option>
										<option value="in">target → {e.name}</option>
									</select>
								</div>
								<div class="space-y-1">
									<Label>Relation type</Label>
									<Input bind:value={relType} placeholder="e.g. uses" class="w-32" />
								</div>
								<div class="space-y-1">
									<Label>Target entity</Label>
									<Input
										bind:value={relSearch}
										placeholder="Search entity…"
										class="w-48"
										onkeydown={(ev) => {
											if (ev.key === 'Enter') {
												ev.preventDefault();
												searchRelTargets();
											}
										}}
									/>
								</div>
								<Button variant="outline" onclick={searchRelTargets}>Find</Button>
							</div>

							{#if relResults.length > 0}
								<div class="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
									{#each relResults as r}
										<button
											type="button"
											onclick={() => {
												relTarget = String(r.id);
												relSearch = r.name;
												relResults = [];
											}}
											class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
										>
											<span class="truncate">{r.name}</span>
											<Badge variant="outline">{r.type}</Badge>
										</button>
									{/each}
								</div>
							{/if}

							<div class="flex items-center gap-3">
								<span class="text-sm text-muted-foreground"
									>Weight: {Math.round(relWeight * 100)}%</span
								>
								<input
									type="range"
									bind:value={relWeight}
									min={0}
									max={1}
									step={0.05}
									class="flex-1"
									aria-label="Relation weight"
								/>
								<Button onclick={createRelation} class="gap-1">
									<Plus class="size-4" /> Add relation
								</Button>
							</div>
						</CardContent>
					</Card>

					{#if e.relations_out.length > 0}
						<Card>
							<CardHeader><CardTitle class="text-base">Outgoing</CardTitle></CardHeader>
							<CardContent class="space-y-1">
								{#each e.relations_out as r}
									<div
										class="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-accent"
									>
									<a href={`/app/entities/${r.other_id}`} class="flex min-w-0 items-center gap-2">
											<span class="text-sm font-medium">{e.name}</span>
											<span class="text-xs text-muted-foreground">—{r.relation_type}→</span>
											<span class="truncate text-sm font-medium">{r.other_name}</span>
										</a>
										<div class="flex shrink-0 items-center gap-2">
											<span class="text-xs text-muted-foreground"
												>{Math.round((r.weight ?? 0.5) * 100)}%</span
											>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => delRelation(String(r.id))}
												aria-label="Delete relation"
											>
												<Unlink class="size-4 text-destructive" />
											</Button>
										</div>
									</div>
								{/each}
							</CardContent>
						</Card>
					{/if}

					{#if e.relations_in.length > 0}
						<Card>
							<CardHeader><CardTitle class="text-base">Incoming</CardTitle></CardHeader>
							<CardContent class="space-y-1">
								{#each e.relations_in as r}
									<div
										class="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-accent"
									>
									<a href={`/app/entities/${r.other_id}`} class="flex min-w-0 items-center gap-2">
											<span class="truncate text-sm font-medium">{r.other_name}</span>
											<span class="text-xs text-muted-foreground">—{r.relation_type}→</span>
											<span class="text-sm font-medium">{e.name}</span>
										</a>
										<div class="flex shrink-0 items-center gap-2">
											<span class="text-xs text-muted-foreground"
												>{Math.round((r.weight ?? 0.5) * 100)}%</span
											>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => delRelation(String(r.id))}
												aria-label="Delete relation"
											>
												<Unlink class="size-4 text-destructive" />
											</Button>
										</div>
									</div>
								{/each}
							</CardContent>
						</Card>
					{/if}
				</TabsContent>
			</Tabs>
		{:catch err}
			<p class="text-sm text-destructive">
				Failed to load entity: {(err as Error)?.message ?? 'not found'}
			</p>
		{/await}
	{/if}

	<EntityFormDialog bind:open={showEdit} entity={editEntity} onSaved={() => entity?.refresh()} />
</div>
