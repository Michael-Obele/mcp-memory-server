<script lang="ts">
	import { Copy, Check, Server, KeyRound, ExternalLink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { auth } from '$lib/auth.svelte';

	const MCP_URL = 'https://sepia.fly.dev/mcp';

	let copied = $state('');

	async function copy(text: string, key: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => (copied = ''), 1500);
	}

	const targets = [
		{
			name: 'Claude (web)',
			auth: 'OAuth',
			steps: [
				'Settings → Connectors → Add connector',
				'Choose "Custom"',
				'Paste the MCP URL',
				'Sign in with OAuth'
			]
		},
		{
			name: 'ChatGPT',
			auth: 'OAuth',
			steps: [
				'Settings → Apps → Developer mode → Create',
				'Choose "Custom app"',
				'Paste the MCP URL',
				'Complete OAuth sign-in'
			]
		},
		{
			name: 'Grok (xAI)',
			auth: 'OAuth',
			steps: [
				'grok.com/connectors → New Connector → Custom',
				'Paste the MCP URL',
				'Complete OAuth sign-in'
			]
		},
		{
			name: 'Gemini (Spark)',
			auth: 'OAuth',
			steps: [
				'Settings → Connected Apps',
				'Add a custom MCP app',
				'Paste the MCP URL',
				'Complete OAuth sign-in'
			]
		},
		{
			name: 'Perplexity',
			auth: 'OAuth',
			steps: [
				'Settings → Connectors → Custom connector → Remote',
				'Paste the MCP URL',
				'Complete OAuth sign-in'
			]
		},
		{
			name: 'Le Chat',
			auth: 'OAuth',
			steps: ['Connectors → + Add', 'Paste the MCP URL', 'Auto-detect OAuth 2.1']
		},
		{
			name: 'Claude Code',
			auth: 'Bearer',
			steps: ['Add the server to your MCP config', 'Set the Authorization header to your token']
		},
		{
			name: 'Cursor',
			auth: 'Bearer',
			steps: ['Add a remote MCP server', 'Paste the MCP URL', 'Set the Authorization header']
		},
		{
			name: 'Zed',
			auth: 'Bearer',
			steps: ['Add a remote MCP server', 'Paste the MCP URL', 'Set the Authorization header']
		}
	];

	const claudeCodeConfig = `{
  "mcpServers": {
    "sepia": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${auth.token}"
      }
    }
  }
}`;
</script>

<svelte:head><title>Sepia — Connect an AI</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Connect an AI</h1>
		<p class="text-sm text-muted-foreground">
			Point any MCP-capable AI at your memory server. The server URL is <code
				class="rounded bg-muted px-1">{MCP_URL}</code
			>.
		</p>
	</div>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<KeyRound class="size-4" /> Your access token
			</CardTitle>
			<CardDescription
				>Used for Bearer-token clients (Claude Code, Cursor, Zed). OAuth clients sign in separately.</CardDescription
			>
		</CardHeader>
		<CardContent class="space-y-3">
			<div class="flex items-center gap-2">
				<code class="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
					{auth.token ? `${auth.token.slice(0, 8)}…${auth.token.slice(-4)}` : 'Not signed in'}
				</code>
				<Button
					variant="outline"
					size="sm"
					onclick={() => copy(auth.token, 'token')}
					disabled={!auth.token}
					class="gap-1"
				>
					{#if copied === 'token'}<Check class="size-4" />{:else}<Copy class="size-4" />{/if}
					Copy
				</Button>
			</div>
			<p class="text-xs text-muted-foreground">
				Keep this token private — it grants full read/write access to your memory.
			</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<Server class="size-4" /> Claude Code config
			</CardTitle>
			<CardDescription
				>Add this to your <code class="rounded bg-muted px-1">.mcp.json</code> or user MCP config.</CardDescription
			>
		</CardHeader>
		<CardContent class="space-y-3">
			<pre class="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed"><code
					>{claudeCodeConfig}</code
				></pre>
			<Button
				variant="outline"
				size="sm"
				onclick={() => copy(claudeCodeConfig, 'config')}
				class="gap-1"
			>
				{#if copied === 'config'}<Check class="size-4" />{:else}<Copy class="size-4" />{/if}
				Copy config
			</Button>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle class="text-base">Supported clients</CardTitle>
			<CardDescription>Web platforms use OAuth; local editors use the Bearer token.</CardDescription
			>
		</CardHeader>
		<CardContent>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-xs text-muted-foreground">
							<th class="pr-4 pb-2 font-medium">Client</th>
							<th class="pr-4 pb-2 font-medium">Auth</th>
							<th class="pb-2 font-medium">Steps</th>
						</tr>
					</thead>
					<tbody>
						{#each targets as t}
							<tr class="border-b last:border-0">
								<td class="py-3 pr-4 font-medium">{t.name}</td>
								<td class="py-3 pr-4">
									<Badge variant={t.auth === 'OAuth' ? 'secondary' : 'outline'}>{t.auth}</Badge>
								</td>
								<td class="py-3">
									<ol class="list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
										{#each t.steps as s}
											<li>{s}</li>
										{/each}
									</ol>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardContent class="flex items-start gap-3 p-4">
			<ExternalLink class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">
				OAuth (Phase 2) is required by ChatGPT, Gemini, Grok, Perplexity, and Le Chat. Until it's
				enabled, use the Bearer token with Claude Code, Cursor, Zed, or any client that supports
				custom headers.
			</p>
		</CardContent>
	</Card>
</div>
