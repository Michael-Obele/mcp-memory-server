<script lang="ts">
	import {
		Copy,
		Check,
		Terminal,
		FileText,
		Layers,
		Zap,
		Bot,
		ExternalLink,
		Shield
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	const BASE = 'https://sepia.fly.dev';
	const MCP_URL = `${BASE}/mcp`;

	let copied = $state('');
	let activeTab = $state('vscode');

	async function copy(text: string, key: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => (copied = ''), 1500);
	}

	const oneLiner = `curl -fsSL ${BASE}/install | bash`;
	const oneLinerWithToken = `SEPIA_TOKEN=YOUR_TOKEN curl -fsSL ${BASE}/install | bash`;

	const configs = {
		vscode: `{
  "servers": {
    "sepia": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}`,
		cursor: `{
  "mcpServers": {
    "sepia": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}`,
		opencode: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sepia": {
      "type": "remote",
      "url": "${MCP_URL}",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}`,
		zedRemote: `{
  "context_servers": {
    "sepia": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}`,
		zedBridge: `{
  "context_servers": {
    "sepia": {
      "source": "custom",
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "${MCP_URL}",
        "--header", "Authorization: Bearer YOUR_TOKEN"
      ],
      "env": {}
    }
  }
}`,
		claude: `claude mcp add --transport http sepia ${MCP_URL} --header "Authorization: Bearer YOUR_TOKEN"`
	};

	type Editor = {
		id: string;
		label: string;
		icon: typeof FileText;
		badge: string;
		files: string[];
		mcpFiles: string[];
		why: string;
	};

	const editors: Editor[] = [
		{
			id: 'vscode',
			label: 'VS Code',
			icon: FileText,
			badge: 'applyTo: "**"',
			files: [
				'.github/instructions/sepia.instructions.md',
				'~/.config/Code/User/prompts/sepia.instructions.md'
			],
			mcpFiles: ['.vscode/mcp.json → "servers"', '~/.config/Code/User/mcp.json'],
			why: 'Copilot auto-attaches *.instructions.md with applyTo "**" to every chat. Without this, memory is on-demand only.'
		},
		{
			id: 'cursor',
			label: 'Cursor',
			icon: Layers,
			badge: 'alwaysApply: true',
			files: ['.cursor/rules/sepia.mdc', '~/.cursor/rules/sepia.mdc'],
			mcpFiles: ['.cursor/mcp.json → "mcpServers"'],
			why: 'Cursor ignores the MCP instructions field. This .mdc rule is the ONLY channel that forces memory every session.'
		},
		{
			id: 'opencode',
			label: 'OpenCode',
			icon: Terminal,
			badge: 'AGENTS.md + sepia.md',
			files: ['./AGENTS.md', '~/.config/opencode/AGENTS.md', '~/.config/opencode/sepia.md'],
			mcpFiles: ['opencode.json → "mcp.sepia"', '~/.config/opencode/opencode.json'],
			why: 'OpenCode reads AGENTS.md at repo + user level. The sepia.md companion guarantees recall even in short sessions.'
		},
		{
			id: 'zed',
			label: 'Zed',
			icon: Bot,
			badge: 'context_servers',
			files: ['./AGENTS.md (shared)', '~/.config/zed/sepia.md (reference)'],
			mcpFiles: ['~/.config/zed/settings.json → "context_servers"'],
			why: 'Zed supports both native remote URL and mcp-remote bridge. AGENTS.md covers Zed too — context_servers wires the tool.'
		},
		{
			id: 'claude',
			label: 'Claude Code',
			icon: Shield,
			badge: 'CLAUDE.md',
			files: ['~/.claude/CLAUDE.md'],
			mcpFiles: ['claude mcp add --transport http'],
			why: 'Claude has TWO channels: MCP instructions field + CLAUDE.md. Together they give zero-reminder recall.'
		}
	];
</script>

<section id="install" class="relative px-4 py-24 sm:py-32">
	<div class="mx-auto max-w-5xl">
		<div class="mx-auto max-w-2xl text-center">
			<Badge variant="outline" class="mb-4 font-mono text-xs tracking-wider uppercase"
				>Always-on memory</Badge
			>
			<h2
				class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
				style="letter-spacing: -0.03em"
			>
				Install once.<br />Every editor remembers forever.
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				One command installs the <span class="font-medium text-foreground">skill (on-demand)</span>
				+ <span class="font-medium text-foreground">always-on instructions (every session)</span> for
				VS Code, Cursor, OpenCode, and Zed. No reminder prompts.
			</p>
		</div>

		<!-- One-liner -->
		<Card class="mt-10 overflow-hidden border-border/60">
			<CardHeader class="pb-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<div
							class="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20"
						>
							<Zap class="size-4 text-primary" />
						</div>
						<div>
							<CardTitle class="text-sm">One-line installer</CardTitle>
							<CardDescription class="text-xs"
								>Detects every editor you have and installs idempotently</CardDescription
							>
						</div>
					</div>
					<Badge variant="secondary" class="font-mono text-xs">curl → bash</Badge>
				</div>
			</CardHeader>
			<CardContent class="space-y-3">
				<div class="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-sm">
					<span class="hidden text-muted-foreground sm:inline">$</span>
					<code class="flex-1 truncate text-foreground">{oneLiner}</code>
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => copy(oneLiner, 'oneliner')}
						aria-label="Copy one-liner"
					>
						{#if copied === 'oneliner'}<Check class="size-4 text-green-500" />{:else}<Copy
								class="size-4"
							/>{/if}
					</Button>
				</div>
				<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span class="font-mono">With token (also patches MCP configs):</span>
					<code class="rounded bg-muted px-1.5 py-1 font-mono text-xs">{oneLinerWithToken}</code>
					<Button
						variant="ghost"
						size="xs"
						onclick={() => copy(oneLinerWithToken, 'oneliner-token')}
						class="h-6 gap-1"
					>
						{#if copied === 'oneliner-token'}<Check class="size-3" />{:else}<Copy
								class="size-3"
							/>{/if}
						Copy
					</Button>
				</div>
				<div class="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
					<span class="inline-flex items-center gap-1.5"
						><span class="size-1.5 rounded-full bg-teal-400"></span> Skill → SKILL.md</span
					>
					<span class="inline-flex items-center gap-1.5"
						><span class="size-1.5 rounded-full bg-amber-400"></span> Always-on → instructions</span
					>
					<span class="inline-flex items-center gap-1.5"
						><span class="size-1.5 rounded-full bg-violet-400"></span> MCP → headers</span
					>
				</div>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Fallback: <code class="rounded bg-muted px-1 font-mono"
						>npx skills add Michael-Obele/sepia</code
					>
					or <code class="rounded bg-muted px-1 font-mono">npx skills add {BASE}/skill</code>.
					Local:
					<code class="rounded bg-muted px-1 font-mono">bun run scripts/install-skill.sh</code>
				</p>
			</CardContent>
		</Card>

		<!-- Why two channels -->
		<div class="mt-6 grid gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-border/50 bg-card/40 p-4">
				<div
					class="mb-2 flex size-7 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20"
				>
					<Layers class="size-3.5 text-amber-500" />
				</div>
				<p class="text-sm font-semibold text-foreground">1. Skill (on-demand)</p>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					Extended guide: tool schemas, examples. Loaded when memory is relevant.
				</p>
			</div>
			<div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
				<div
					class="mb-2 flex size-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20"
				>
					<FileText class="size-3.5 text-primary" />
				</div>
				<p class="text-sm font-semibold text-foreground">2. Always-on (every session)</p>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					Injected into the system prompt. Forces <code
						class="rounded bg-muted px-1 font-mono text-xs">search</code
					> before work, persist after.
				</p>
			</div>
			<div class="rounded-xl border border-border/50 bg-card/40 p-4">
				<div
					class="mb-2 flex size-7 items-center justify-center rounded-md bg-teal-500/10 ring-1 ring-teal-500/20"
				>
					<Shield class="size-3.5 text-teal-500" />
				</div>
				<p class="text-sm font-semibold text-foreground">3. MCP server</p>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					7 tools over Streamable HTTP at <code class="font-mono text-xs">{MCP_URL}</code>
				</p>
			</div>
		</div>

		<!-- Per-editor tabs -->
		<Tabs bind:value={activeTab} class="mt-10">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<TabsList class="h-auto flex-wrap gap-1 p-1">
					{#each editors as ed}
						{@const Icon = ed.icon}
						<TabsTrigger value={ed.id} class="gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
							<Icon class="size-3.5" />
							{ed.label}
						</TabsTrigger>
					{/each}
				</TabsList>
				<a
					href="/app/connect"
					class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
				>
					Full connect page <ExternalLink class="size-3" />
				</a>
			</div>

			{#each editors as ed}
				{@const Icon = ed.icon}
				<TabsContent value={ed.id} class="mt-6">
					<Card class="border-border/60">
						<CardHeader class="pb-3">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="flex gap-3">
									<div
										class="hidden size-10 items-center justify-center rounded-xl bg-muted ring-1 ring-border/50 sm:flex"
									>
										<Icon class="size-5 text-foreground" />
									</div>
									<div>
										<CardTitle class="flex flex-wrap items-center gap-2 text-base">
											{ed.label}
											<Badge variant="outline" class="font-mono text-xs">{ed.badge}</Badge>
										</CardTitle>
										<CardDescription class="mt-1 max-w-xl text-sm leading-relaxed">
											{ed.why}
										</CardDescription>
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent class="space-y-5">
							<!-- Files -->
							<div>
								<p
									class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
								>
									System instructions → where they live
								</p>
								<div class="grid gap-2 sm:grid-cols-2">
									{#each ed.files as f}
										<div
											class="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs"
										>
											<FileText class="size-3.5 shrink-0 text-muted-foreground" />
											<span class="truncate">{f}</span>
										</div>
									{/each}
								</div>
							</div>

							<!-- MCP -->
							<div>
								<p
									class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
								>
									MCP config → what to paste
								</p>
								<p class="mb-2 text-xs text-muted-foreground">
									File: <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
										>{ed.mcpFiles.join('  ·  ')}</code
									>
								</p>

								{#if ed.id === 'vscode'}
									<div
										class="group relative overflow-hidden rounded-lg border border-border/50 bg-muted"
									>
										<div
											class="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-1.5"
										>
											<span class="font-mono text-xs text-muted-foreground">.vscode/mcp.json</span>
											<Button
												variant="ghost"
												size="xs"
												onclick={() => copy(configs.vscode, 'vscode')}
												class="h-6 gap-1"
											>
												{#if copied === 'vscode'}<Check class="size-3 text-green-500" /> Copy ✓{:else}<Copy
														class="size-3"
													/> Copy{/if}
											</Button>
										</div>
										<pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code
												>{configs.vscode}</code
											></pre>
									</div>
									<p class="mt-2 text-xs text-muted-foreground">
										Global fallback: <code class="rounded bg-muted px-1 font-mono"
											>~/.config/Code/User/mcp.json</code
										>
										with <code class="font-mono">"servers"</code>. Also add
										<code class="font-mono">.github/instructions/sepia.instructions.md</code>
										with <code class="font-mono">applyTo: "**"</code> — installer handles it.
									</p>
								{:else if ed.id === 'cursor'}
									<div
										class="group relative overflow-hidden rounded-lg border border-border/50 bg-muted"
									>
										<div
											class="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-1.5"
										>
											<span class="font-mono text-xs text-muted-foreground">.cursor/mcp.json</span>
											<Button
												variant="ghost"
												size="xs"
												onclick={() => copy(configs.cursor, 'cursor')}
												class="h-6 gap-1"
											>
												{#if copied === 'cursor'}<Check class="size-3 text-green-500" /> Copy ✓{:else}<Copy
														class="size-3"
													/> Copy{/if}
											</Button>
										</div>
										<pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code
												>{configs.cursor}</code
											></pre>
									</div>
									<p class="mt-2 text-xs text-muted-foreground">
										Cursor uses <code class="font-mono">mcpServers</code> (not
										<code class="font-mono">servers</code>). Rule file:
										<code class="font-mono">.cursor/rules/sepia.mdc</code>
										with <code class="font-mono">alwaysApply: true</code>.
									</p>
								{:else if ed.id === 'opencode'}
									<div
										class="group relative overflow-hidden rounded-lg border border-border/50 bg-muted"
									>
										<div
											class="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-1.5"
										>
											<span class="font-mono text-xs text-muted-foreground">opencode.json</span>
											<Button
												variant="ghost"
												size="xs"
												onclick={() => copy(configs.opencode, 'opencode')}
												class="h-6 gap-1"
											>
												{#if copied === 'opencode'}<Check class="size-3 text-green-500" /> Copy ✓{:else}<Copy
														class="size-3"
													/> Copy{/if}
											</Button>
										</div>
										<pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code
												>{configs.opencode}</code
											></pre>
									</div>
									<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
										OpenCode supports both <code class="font-mono">mcp.sepia</code> (v1) and
										<code class="font-mono">mcp.servers.sepia</code>
										(v2). Place in project <code class="font-mono">opencode.json</code> or user
										<code class="font-mono">~/.config/opencode/opencode.json</code>. Also add
										<code class="font-mono">AGENTS.md</code>
										— installer does it. CLI: <code class="font-mono">opencode mcp add</code> alternative.
									</p>
								{:else if ed.id === 'zed'}
									<div class="space-y-3">
										<div class="overflow-hidden rounded-lg border border-border/50 bg-muted">
											<div
												class="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-1.5"
											>
												<span class="font-mono text-xs text-muted-foreground"
													>~/.config/zed/settings.json — native remote (preferred)</span
												>
												<Button
													variant="ghost"
													size="xs"
													onclick={() => copy(configs.zedRemote, 'zedRemote')}
													class="h-6 gap-1"
												>
													{#if copied === 'zedRemote'}<Check class="size-3 text-green-500" /> Copy ✓{:else}<Copy
															class="size-3"
														/> Copy{/if}
												</Button>
											</div>
											<pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code
													>{configs.zedRemote}</code
												></pre>
										</div>
										<details class="rounded-lg border border-border/50 bg-card/30">
											<summary class="cursor-pointer px-3 py-2 text-xs font-medium text-foreground"
												>Fallback: stdio bridge via mcp-remote (older Zed) — click to show</summary
											>
											<div class="border-t border-border/50 bg-muted p-3">
												<pre class="overflow-x-auto text-xs leading-relaxed"><code
														>{configs.zedBridge}</code
													></pre>
												<Button
													variant="ghost"
													size="xs"
													onclick={() => copy(configs.zedBridge, 'zedBridge')}
													class="mt-2 h-6 gap-1"
												>
													{#if copied === 'zedBridge'}<Check class="size-3" /> Copied{:else}<Copy
															class="size-3"
														/> Copy bridge{/if}
												</Button>
											</div>
										</details>
										<p class="text-xs leading-relaxed text-muted-foreground">
											Zed key is <code class="font-mono">context_servers</code> (not mcpServers).
											Restart Agent Panel → check green dot. Also respects
											<code class="font-mono">./AGENTS.md</code>.
										</p>
									</div>
								{:else if ed.id === 'claude'}
									<div class="overflow-hidden rounded-lg border border-border/50 bg-muted">
										<div
											class="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-1.5"
										>
											<span class="font-mono text-xs text-muted-foreground">Terminal</span>
											<Button
												variant="ghost"
												size="xs"
												onclick={() => copy(configs.claude, 'claude')}
												class="h-6 gap-1"
											>
												{#if copied === 'claude'}<Check class="size-3 text-green-500" /> Copy ✓{:else}<Copy
														class="size-3"
													/> Copy{/if}
											</Button>
										</div>
										<pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code
												>{configs.claude}</code
											></pre>
									</div>
									<p class="mt-2 text-xs text-muted-foreground">
										Also install the skill: <code class="rounded bg-muted px-1 font-mono"
											>claude mcp add --transport http sepia ...</code
										> — then restart Claude Code.
									</p>
								{/if}
							</div>

							<Separator />

							<div class="flex flex-wrap gap-2 text-xs">
								<a
									href={`${BASE}/instructions/${ed.id === 'zed' ? 'zed' : ed.id === 'opencode' ? 'opencode' : ed.id}`}
									target="_blank"
									rel="noopener"
									class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
								>
									View raw instruction file <ExternalLink class="size-3" />
								</a>
								<span class="text-border">·</span>
								<span class="text-muted-foreground"
									>Source: <code class="rounded bg-muted px-1 font-mono text-xs"
										>skills/sepia/always-on/{ed.id === 'vscode'
											? 'vscode.instructions.md'
											: ed.id === 'cursor'
												? 'cursor.mdc'
												: ed.id === 'opencode'
													? 'opencode.md'
													: ed.id === 'zed'
														? 'zed.md'
														: 'claude.md'}</code
									>
									+
									<code class="rounded bg-muted px-1 font-mono text-xs">src/instructions.ts</code
									></span
								>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			{/each}
		</Tabs>

		<!-- Verify -->
		<Card class="mt-6 border-dashed bg-card/30">
			<CardContent class="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
				<div class="flex items-center gap-2">
					<div
						class="flex size-7 items-center justify-center rounded-md bg-teal-500/10 ring-1 ring-teal-500/20"
					>
						<Check class="size-3.5 text-teal-500" />
					</div>
					<span class="font-medium text-foreground">Verify</span>
					<span class="text-muted-foreground"
						>— restart editor, ask “what do you know about my project?”</span
					>
				</div>
				<span class="text-xs text-muted-foreground"
					>Expect: <code class="rounded bg-muted px-1 font-mono text-xs">From your memory: ...</code
					> without you prompting “use sepia”.</span
				>
			</CardContent>
		</Card>
	</div>
</section>
