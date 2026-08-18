<script lang="ts">
	import { BrainCircuit, KeyRound } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { login } from '$lib/auth.svelte';

	let token = $state('');
	let error = $state('');

	function submit() {
		const trimmed = token.trim();
		if (!trimmed) {
			error = 'Enter your sepia token to continue.';
			return;
		}
		error = '';
		login(trimmed);
	}
</script>

<div class="flex min-h-svh items-center justify-center bg-background p-4">
	<Card class="w-full max-w-sm">
		<CardHeader class="text-center">
			<div
				class="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"
			>
				<BrainCircuit class="size-6" />
			</div>
			<CardTitle class="text-xl">Sepia</CardTitle>
			<CardDescription>Sign in to browse your AI memory knowledge graph.</CardDescription>
		</CardHeader>
		<CardContent>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
				class="space-y-4"
			>
				<div class="space-y-2">
					<Label for="token">Access token</Label>
					<div class="relative">
						<KeyRound
							class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							id="token"
							type="password"
							bind:value={token}
							placeholder="Paste your MCP_BEARER_TOKEN"
							class="pl-9"
							autocomplete="off"
						/>
					</div>
					{#if error}
						<p class="text-sm text-destructive">{error}</p>
					{/if}
				</div>
				<Button type="submit" class="w-full">Sign in</Button>
			</form>
		</CardContent>
	</Card>
</div>
