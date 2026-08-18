<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Search, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { addMemory, updateMemoryData, getEntities } from '$lib/remote/index.js';
	import { auth } from '$lib/auth.svelte';
	import { MEMORY_TYPES } from '@sepia/shared';

	let {
		open = $bindable(false),
		namespaces = [],
		memory = null,
		onSaved = () => {}
	}: {
		open?: boolean;
		namespaces?: string[];
		memory?: Record<string, unknown> | null;
		onSaved?: () => void;
	} = $props();

	let content = $state('');
	let type = $state<'fact' | 'observation' | 'preference' | 'instruction'>('fact');
	let importance = $state(0.5);
	let namespace = $state('personal');
	let entityIds = $state<string[]>([]);
	let saving = $state(false);

	let entityQuery = $state('');
	let entityResults = $state<Awaited<ReturnType<typeof getEntities>>>([]);
	let searchingEntities = $state(false);

	// Reset the form when the dialog opens or the memory changes.
	$effect(() => {
		if (open) {
			content = memory?.content ? String(memory.content) : '';
			type = (memory?.type as typeof type) ?? 'fact';
			importance = typeof memory?.importance === 'number' ? memory.importance : 0.5;
			namespace = memory?.namespace ? String(memory.namespace) : (namespaces[0] ?? 'personal');
			entityIds = memory?.entity_ids ? (memory.entity_ids as string[]) : [];
			entityQuery = '';
			entityResults = [];
		}
	});

	async function searchEntities() {
		if (!entityQuery.trim()) {
			entityResults = [];
			return;
		}
		searchingEntities = true;
		try {
			entityResults = await getEntities([auth.token, { q: entityQuery, namespace, limit: 8 }]);
		} finally {
			searchingEntities = false;
		}
	}

	function toggleEntity(id: string) {
		if (entityIds.includes(id)) {
			entityIds = entityIds.filter((x) => x !== id);
		} else if (entityIds.length < 3) {
			entityIds = [...entityIds, id];
		} else {
			toast.warning('A memory can link to at most 3 entities');
		}
	}

	async function save() {
		if (!content.trim()) {
			toast.error('Memory content is required');
			return;
		}
		saving = true;
		try {
			if (memory?.id) {
				await updateMemoryData([
					auth.token,
					String(memory.id),
					{ content, type, importance, entity_ids: entityIds }
				]);
				toast.success('Memory updated');
			} else {
				await addMemory([
					auth.token,
					{ content, type, importance, namespace, entity_ids: entityIds }
				]);
				toast.success('Memory created');
			}
			open = false;
			onSaved();
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Failed to save memory');
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{memory?.id ? 'Edit memory' : 'New memory'}</Dialog.Title>
			<Dialog.Description>
				{memory?.id
					? 'Update this knowledge fragment.'
					: 'Record a fact, observation, preference, or instruction.'}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-2">
			<div class="space-y-2">
				<Label for="mem-content">Content</Label>
				<Textarea
					id="mem-content"
					bind:value={content}
					rows={4}
					placeholder="What did you learn?"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="mem-type">Type</Label>
					<select
						id="mem-type"
						bind:value={type}
						class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
					>
						{#each MEMORY_TYPES as t}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="mem-ns">Namespace</Label>
					<select
						id="mem-ns"
						bind:value={namespace}
						class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
					>
						{#each namespaces as n}
							<option value={n}>{n}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Importance</Label>
					<span class="text-sm text-muted-foreground">{Math.round(importance * 100)}%</span>
				</div>
				<Slider
					type="single"
					value={importance}
					onValueChange={(v: number) => (importance = v)}
					min={0}
					max={1}
					step={0.05}
				/>
			</div>

			<div class="space-y-2">
				<Label>Linked entities (max 3)</Label>
				<div class="relative">
					<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						bind:value={entityQuery}
						placeholder="Search entities to link…"
						class="pl-9"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								searchEntities();
							}
						}}
					/>
				</div>
				{#if entityResults.length > 0}
					<div class="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
						{#each entityResults as e}
							<button
								type="button"
								onclick={() => toggleEntity(String(e.id))}
								class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
							>
								<span class="truncate">{e.name}</span>
								{#if entityIds.includes(String(e.id))}
									<Badge variant="secondary">Linked</Badge>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
				{#if entityIds.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each entityIds as id}
							<Badge variant="outline" class="gap-1 pr-1">
								{id.slice(0, 8)}…
								<button type="button" onclick={() => toggleEntity(id)} aria-label="Remove link">
									<X class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				{#snippet child({ props })}
					<Button variant="ghost" {...props}>Cancel</Button>
				{/snippet}
			</Dialog.Close>
			<Button onclick={save} disabled={saving}>
				{saving ? 'Saving…' : memory?.id ? 'Save changes' : 'Create memory'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
