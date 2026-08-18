<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { toast } from 'svelte-sonner';
	import { addEntity, updateEntityData } from '$lib/remote/index.js';
	import { auth } from '$lib/auth.svelte';

	let {
		open = $bindable(false),
		namespaces = [],
		entity = null,
		onSaved = () => {}
	}: {
		open?: boolean;
		namespaces?: string[];
		entity?: Record<string, unknown> | null;
		onSaved?: () => void;
	} = $props();

	let name = $state('');
	let type = $state('concept');
	let summary = $state('');
	let importance = $state(0.5);
	let namespace = $state('personal');
	let saving = $state(false);

	$effect(() => {
		if (open) {
			name = entity?.name ? String(entity.name) : '';
			type = entity?.type ? String(entity.type) : 'concept';
			summary = entity?.summary ? String(entity.summary) : '';
			importance = typeof entity?.importance === 'number' ? entity.importance : 0.5;
			namespace = entity?.namespace ? String(entity.namespace) : (namespaces[0] ?? 'personal');
		}
	});

	async function save() {
		if (!name.trim() || !type.trim()) {
			toast.error('Name and type are required');
			return;
		}
		saving = true;
		try {
			if (entity?.id) {
				await updateEntityData([
					auth.token,
					String(entity.id),
					{ name, type, summary, importance }
				]);
				toast.success('Entity updated');
			} else {
				await addEntity([auth.token, namespace, { name, type, summary, importance }]);
				toast.success('Entity created');
			}
			open = false;
			onSaved();
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Failed to save entity');
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{entity?.id ? 'Edit entity' : 'New entity'}</Dialog.Title>
			<Dialog.Description>
				{entity?.id
					? 'Update this knowledge-graph node.'
					: 'Create a knowledge-graph node (person, project, tool, concept…).'}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-2">
			<div class="space-y-2">
				<Label for="ent-name">Name</Label>
				<Input id="ent-name" bind:value={name} placeholder="e.g. Bun" />
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="ent-type">Type</Label>
					<Input id="ent-type" bind:value={type} placeholder="e.g. tool" />
				</div>
				<div class="space-y-2">
					<Label for="ent-ns">Namespace</Label>
					<select
						id="ent-ns"
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
				<Label for="ent-summary">Summary</Label>
				<Textarea
					id="ent-summary"
					bind:value={summary}
					rows={3}
					placeholder="What is this entity?"
				/>
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
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				{#snippet child({ props })}
					<Button variant="ghost" {...props}>Cancel</Button>
				{/snippet}
			</Dialog.Close>
			<Button onclick={save} disabled={saving}>
				{saving ? 'Saving…' : entity?.id ? 'Save changes' : 'Create entity'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
