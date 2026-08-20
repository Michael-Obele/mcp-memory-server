<script lang="ts">
	import { Plus, Trash2, Download, FileJson, FileText, KeyRound, Database } from '@lucide/svelte';
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
	import { toast } from 'svelte-sonner';
	import { getNamespaces, addNamespace, removeNamespace, exportAll } from '$lib/remote/index.js';
	import { auth, isAuthed, logout } from '$lib/auth.svelte';
	import { goto } from '$app/navigation';

	const namespaces = $derived(isAuthed() ? getNamespaces(auth.token) : null);

	let newName = $state('');
	let newDesc = $state('');
	let creating = $state(false);
	let exporting = $state(false);

	async function createNs() {
		if (!newName.trim()) {
			toast.error('Namespace name is required');
			return;
		}
		creating = true;
		try {
			await addNamespace([auth.token, { name: newName.trim(), description: newDesc.trim() }]);
			toast.success(`Namespace "${newName.trim()}" created`);
			newName = '';
			newDesc = '';
			namespaces?.refresh();
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Failed to create namespace');
		} finally {
			creating = false;
		}
	}

	async function delNs(id: string, name: string) {
		if (name === 'personal') {
			toast.error('The default "personal" namespace cannot be deleted');
			return;
		}
		if (
			!confirm(
				`Delete namespace "${name}"? This permanently removes all its entities, relations, and memories.`
			)
		)
			return;
		try {
			await removeNamespace([auth.token, id]);
			toast.success(`Namespace "${name}" deleted`);
			namespaces?.refresh();
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Failed to delete namespace');
		}
	}

	async function downloadJson() {
		exporting = true;
		try {
			const data = await exportAll(auth.token);
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `sepia-export-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success('JSON export downloaded');
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Export failed');
		} finally {
			exporting = false;
		}
	}

	async function downloadMarkdown() {
		exporting = true;
		try {
			const data = await exportAll(auth.token);
			let md = `# Sepia Memory Export\n\n_Generated ${new Date().toISOString()}_\n\n`;
			for (const ns of data.namespaces) {
				md += `\n## Namespace: ${ns.name}\n\n`;
				md += `Entities: ${ns.entity_count} · Memories: ${ns.memory_count} · Relations: ${ns.relation_count}\n\n`;
				const nsEntities = data.entities.filter((e) => e.namespace === ns.name);
				if (nsEntities.length) {
					md += `### Entities\n\n`;
					for (const e of nsEntities) {
						md += `- **${e.name}** (${e.type}, importance ${Math.round((e.importance ?? 0.5) * 100)}%)\n`;
						if (e.summary) md += `  - ${e.summary}\n`;
					}
					md += '\n';
				}
				const nsMemories = data.memories.filter((m) => m.namespace === ns.name);
				if (nsMemories.length) {
					md += `### Memories\n\n`;
					for (const m of nsMemories) {
						md += `- [${m.type}] ${m.content}\n`;
					}
					md += '\n';
				}
			}
			const blob = new Blob([md], { type: 'text/markdown' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `sepia-export-${new Date().toISOString().slice(0, 10)}.md`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success('Markdown export downloaded');
		} catch (e) {
			toast.error((e as Error)?.message ?? 'Export failed');
		} finally {
			exporting = false;
		}
	}

	function signOut() {
		logout();
		goto('/');
	}
</script>

<svelte:head><title>Sepia — Settings</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-sm text-muted-foreground">Namespaces, access, and data export.</p>
	</div>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<Database class="size-4" /> Namespaces
			</CardTitle>
			<CardDescription
				>Isolated containers for memory. Deleting a namespace removes everything inside it.</CardDescription
			>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="flex flex-col gap-2 sm:flex-row">
				<Input bind:value={newName} placeholder="New namespace name" class="sm:max-w-56" />
				<Input bind:value={newDesc} placeholder="Description (optional)" class="flex-1" />
				<Button onclick={createNs} disabled={creating} class="gap-1">
					<Plus class="size-4" /> Create
				</Button>
			</div>

			{#if namespaces}
				{#await namespaces}
					<div class="space-y-2">
						{#each [0, 1] as _}
							<Skeleton class="h-14 w-full" />
						{/each}
					</div>
				{:then ns}
					<div class="space-y-2">
						{#each ns as n}
							<div class="flex items-center justify-between gap-3 rounded-md border p-3">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<p class="font-medium">{n.name}</p>
										{#if n.name === 'personal'}
											<Badge variant="secondary">default</Badge>
										{/if}
									</div>
									{#if n.description}
										<p class="truncate text-xs text-muted-foreground">{n.description}</p>
									{/if}
									<p class="text-xs text-muted-foreground">
										{n.entity_count} entities · {n.memory_count} memories · {n.relation_count} relations
									</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => delNs(String(n.id), n.name)}
									disabled={n.name === 'personal'}
									aria-label={`Delete namespace ${n.name}`}
								>
									<Trash2 class="size-4 text-destructive" />
								</Button>
							</div>
						{/each}
					</div>
				{:catch e}
					<p class="text-sm text-destructive">
						{(e as Error)?.message ?? 'Failed to load namespaces'}
					</p>
				{/await}
			{/if}
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<KeyRound class="size-4" /> Access
			</CardTitle>
			<CardDescription>Your session token is stored in this browser only.</CardDescription>
		</CardHeader>
		<CardContent class="space-y-3">
			<div class="flex items-center gap-2">
				<code class="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
					{auth.token ? `${auth.token.slice(0, 8)}…${auth.token.slice(-4)}` : 'Not signed in'}
				</code>
				<Button variant="outline" onclick={signOut}>Sign out</Button>
			</div>
			<p class="text-xs text-muted-foreground">
				To rotate the token, set a new <code class="rounded bg-muted px-1">MCP_BEARER_TOKEN</code>
				on the server (<code class="rounded bg-muted px-1">fly secrets set MCP_BEARER_TOKEN=…</code
				>) and sign in again.
			</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<Download class="size-4" /> Data export
			</CardTitle>
			<CardDescription
				>Download everything in memory as JSON or human-readable Markdown.</CardDescription
			>
		</CardHeader>
		<CardContent class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={downloadJson} disabled={exporting} class="gap-1">
				<FileJson class="size-4" /> Export JSON
			</Button>
			<Button variant="outline" onclick={downloadMarkdown} disabled={exporting} class="gap-1">
				<FileText class="size-4" /> Export Markdown
			</Button>
		</CardContent>
	</Card>
</div>
