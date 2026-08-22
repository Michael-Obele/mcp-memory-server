<script lang="ts">
	import {
		Search,
		Network,
		RefreshCw,
		Layers,
		Plug,
		Zap,
		ExternalLink,
		ArrowRight,
		Database,
		Shield,
		Server
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import favicon from '$lib/assets/favicon.svg?no-inline';
	import HeroGraph from '$lib/components/landing/hero-graph.svelte';
	import ToolBreadth from '$lib/components/landing/tool-breadth.svelte';
	import MemoryGrowth from '$lib/components/landing/memory-growth.svelte';
	import ArchitectureFlow from '$lib/components/landing/architecture-flow.svelte';
	import InstallMatrix from '$lib/components/landing/install-matrix.svelte';

	const features = [
		{
			icon: Database,
			title: 'Knowledge graph',
			desc: 'Entities, weighted relations, and memories with importance scoring — structured like how your brain actually works.',
			color: 'text-orange-400'
		},
		{
			icon: Search,
			title: 'Unified search',
			desc: 'Keyword + metadata search across everything. BFS graph traversal from any entity. Find what your AI stored.',
			color: 'text-amber-400'
		},
		{
			icon: RefreshCw,
			title: 'Self-maintaining',
			desc: 'Decay scoring, deduplication, and purge — pure SQL, no LLM calls. The consolidate tool keeps your graph clean.',
			color: 'text-yellow-500'
		},
		{
			icon: Layers,
			title: 'Namespaced',
			desc: "Isolate memory into spaces — per project, per client, per context. Your AI knows which world it's in.",
			color: 'text-brand'
		},
		{
			icon: Zap,
			title: 'Zero-reminder recall',
			desc: "Server instructions auto-injected into your AI's system prompt. Your agents remember without you asking.",
			color: 'text-amber-300'
		},
		{
			icon: Shield,
			title: 'Self-hosted',
			desc: 'Your data stays on your infrastructure. No SaaS dependency. Bearer token for editors, OAuth for web AIs.',
			color: 'text-red-400'
		}
	];

	const tools = [
		{ name: 'Claude Code', category: 'editor' },
		{ name: 'Cursor', category: 'editor' },
		{ name: 'Copilot', category: 'editor' },
		{ name: 'Codex', category: 'editor' },
		{ name: 'Zed', category: 'editor' },
		{ name: 'OpenCode', category: 'editor' },
		{ name: 'Claude (web)', category: 'web' },
		{ name: 'ChatGPT', category: 'web' },
		{ name: 'Grok', category: 'web' },
		{ name: 'Gemini', category: 'web' },
		{ name: 'Perplexity', category: 'web' },
		{ name: 'Le Chat', category: 'web' }
	];
</script>

<svelte:head>
	<title>Sepia — Memory Server for AI Agents</title>
	<meta
		name="description"
		content="A self-hosted, remote knowledge-graph memory server for AI coding agents. 7 tools, $0/month, your data stays yours."
	/>
</svelte:head>

<!-- Hero -->
<section class="relative flex min-h-screen items-center overflow-hidden px-4 py-24">
	<!-- Ambient glow -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,149,106,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_top_left,transparent_0%,var(--background)_72%)]"
		aria-hidden="true"
	></div>

	<div
		class="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.1fr]"
	>
		<div>
			<div
				class="mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand/15 ring-1 ring-brand/25"
			>
				<img src={favicon} alt="" class="size-8" />
			</div>

			<h1
				class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
				style="letter-spacing: -0.03em"
			>
				Your AI never forgets.
			</h1>

			<p class="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">
				A self-hosted memory server that gives every AI agent a persistent knowledge graph — facts,
				relations, preferences — recalled automatically across every session.
			</p>

			<div class="mt-8 flex flex-wrap items-center gap-3">
				<a href="/app">
					<Button size="lg" class="gap-2 px-6">
						Open dashboard <ArrowRight class="size-4" />
					</Button>
				</a>
				<a href="https://github.com/Michael-Obele/sepia" target="_blank" rel="noopener">
					<Button variant="outline" size="lg" class="gap-2 px-6">
						<ExternalLink class="size-4" /> View on GitHub
					</Button>
				</a>
			</div>

			<div class="mt-10 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<Badge variant="secondary" class="font-mono">$0/month</Badge>
				<span class="text-border">·</span>
				<Badge variant="secondary" class="font-mono">7 MCP tools</Badge>
				<span class="text-border">·</span>
				<Badge variant="secondary" class="font-mono">Self-hosted</Badge>
				<span class="text-border">·</span>
				<Badge variant="secondary" class="font-mono">Fly.io + Neon + Netlify</Badge>
			</div>
		</div>

		<div class="relative">
			<HeroGraph />
		</div>
	</div>

	<!-- Scroll hint -->
	<div class="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground/40">
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path d="M10 4v12M5 11l5 5 5-5" />
		</svg>
	</div>
</section>

<!-- Features -->
<section class="relative px-4 py-24 sm:py-32">
	<div class="mx-auto max-w-5xl">
		<div class="mx-auto max-w-2xl text-center">
			<h2
				class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
				style="letter-spacing: -0.03em"
			>
				Everything your AI needs to remember.
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				Not a chat log. Not a JSONL file. A real knowledge graph with search, traversal, and
				maintenance — purpose-built for AI agents.
			</p>
		</div>

		<div class="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as f}
				<div
					class="group relative rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-border hover:bg-card"
				>
					<div class="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted/50">
						<f.icon class="size-5 {f.color}" />
					</div>
					<h3 class="text-base font-semibold text-foreground">{f.title}</h3>
					<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
				</div>
			{/each}
		</div>

		<div class="mt-20 grid items-center gap-12 lg:grid-cols-2">
			<div>
				<h3
					class="text-2xl font-semibold tracking-tight text-foreground"
					style="letter-spacing: -0.03em"
				>
					Seven tools. One server.
				</h3>
				<p class="mt-3 text-muted-foreground">
					20 operations across 7 MCP tools. Rich CRUD for entities, memories, and namespaces — plus
					focused search, traversal, and maintenance. All pure SQL, no LLM calls.
				</p>
				<div class="mt-6 flex flex-wrap gap-2">
					{#each ['manage_entity', 'manage_memory', 'manage_namespace', 'manage_relation', 'search', 'traverse_graph', 'consolidate'] as tool (tool)}
						<Badge variant="outline" class="font-mono">{tool}</Badge>
					{/each}
				</div>
			</div>
			<div class="rounded-xl border border-border/50 bg-card/40 p-4">
				<ToolBreadth />
			</div>
		</div>
	</div>
</section>

<!-- Memory growth -->
<section class="relative px-4 py-24 sm:py-32">
	<div class="mx-auto max-w-5xl">
		<div class="grid items-center gap-12 lg:grid-cols-2">
			<div>
				<h2
					class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
					style="letter-spacing: -0.03em"
				>
					Memory that compounds.
				</h2>
				<p class="mt-4 text-muted-foreground">
					Every session adds facts, relations, and preferences. Your graph grows richer over time —
					and your AI recalls it all without being reminded.
				</p>
				<div class="mt-8 space-y-3">
					<div class="flex items-start gap-3">
						<Database class="mt-0.5 size-4 shrink-0 text-brand" />
						<div>
							<p class="text-sm font-medium text-foreground">Facts, observations, preferences</p>
							<p class="text-sm text-muted-foreground">
								Memories with importance scoring — the durable context your agents build up.
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Network class="mt-0.5 size-4 shrink-0 text-amber-400" />
						<div>
							<p class="text-sm font-medium text-foreground">Weighted relations</p>
							<p class="text-sm text-muted-foreground">
								Entities connected by typed, weighted edges — a graph, not a log.
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<RefreshCw class="mt-0.5 size-4 shrink-0 text-orange-400" />
						<div>
							<p class="text-sm font-medium text-foreground">Self-maintaining</p>
							<p class="text-sm text-muted-foreground">
								Decay scoring and dedup keep the graph clean — automatically.
							</p>
						</div>
					</div>
				</div>
			</div>
			<div class="rounded-xl border border-border/50 bg-card/40 p-4">
				<MemoryGrowth />
				<p class="mt-2 text-center text-xs text-muted-foreground">
					Illustrative — your graph grows as your agents work.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- Architecture -->
<section class="relative px-4 py-24 sm:py-32">
	<div class="mx-auto max-w-5xl">
		<div class="grid items-center gap-12 lg:grid-cols-2">
			<div>
				<h2
					class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
					style="letter-spacing: -0.03em"
				>
					Simple architecture.<br />Serious capability.
				</h2>
				<p class="mt-4 text-muted-foreground">
					One Bun process on Fly.io serves both the MCP endpoint and the REST API. The dashboard is
					a static SPA on Netlify — it never wakes your VM. Neon Postgres on the free tier handles
					persistence.
				</p>
				<div class="mt-8 space-y-3">
					<div class="flex items-start gap-3">
						<Server class="mt-0.5 size-4 shrink-0 text-brand" />
						<div>
							<p class="text-sm font-medium text-foreground">Scale-to-zero</p>
							<p class="text-sm text-muted-foreground">
								The Fly machine only spins up for real API calls. The CDN-served dashboard is always
								fast.
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Shield class="mt-0.5 size-4 shrink-0 text-brand" />
						<div>
							<p class="text-sm font-medium text-foreground">Two-phase auth</p>
							<p class="text-sm text-muted-foreground">
								Bearer tokens for local editors. OAuth 2.1 + PKCE for web AIs like ChatGPT and
								Gemini.
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<Plug class="mt-0.5 size-4 shrink-0 text-brand" />
						<div>
							<p class="text-sm font-medium text-foreground">Works everywhere</p>
							<p class="text-sm text-muted-foreground">
								12 AI tools supported out of the box — local editors and web-based AIs alike.
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Architecture flow -->
			<div class="m-4 rounded-xl border border-border/50 bg-card/40 p-2">
				<ArchitectureFlow />
			</div>
		</div>
	</div>
</section>

<!-- Supported tools -->
<section class="relative px-4 py-24 sm:py-32">
	<div class="mx-auto max-w-5xl">
		<div class="mx-auto max-w-2xl text-center">
			<h2
				class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
				style="letter-spacing: -0.03em"
			>
				Works with every AI you use.
			</h2>
			<p class="mt-4 text-muted-foreground">
				Local editors via Bearer token. Web AIs via OAuth. One memory server, all your tools.
			</p>
		</div>

		<div class="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{#each tools as tool}
				<div
					class="flex items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-4 py-3 text-sm text-foreground transition-colors hover:border-border hover:bg-card/60"
				>
					<span
						class="size-1.5 rounded-full {tool.category === 'editor'
							? 'bg-teal-400'
							: 'bg-violet-400'}"
					></span>
					{tool.name}
				</div>
			{/each}
		</div>

		<div class="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
			<span class="flex items-center gap-1.5">
				<span class="size-1.5 rounded-full bg-teal-400"></span> Local editor
			</span>
			<span class="flex items-center gap-1.5">
				<span class="size-1.5 rounded-full bg-violet-400"></span> Web AI
			</span>
		</div>
	</div>
</section>

<!-- Install matrix — always-on + skill + MCP for every editor -->
<InstallMatrix />

<!-- Deploy CTA -->
<section class="relative px-4 py-24 sm:py-32">
	<div class="mx-auto max-w-3xl text-center">
		<h2
			class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
			style="letter-spacing: -0.03em"
		>
			Deploy in 10 minutes. Free forever.
		</h2>
		<p class="mx-auto mt-4 max-w-xl text-muted-foreground">
			Fly.io free tier + Neon Postgres free tier + Netlify free tier. Your AI gets persistent memory
			for $0/month.
		</p>

		<div class="mx-auto mt-10 max-w-lg rounded-xl border border-border/50 bg-card/50 p-6 text-left">
			<p class="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
				Quick start
			</p>
			<div class="space-y-2 font-mono text-sm">
				<p class="text-muted-foreground">
					<span class="text-brand">$</span> fly launch
				</p>
				<p class="text-muted-foreground">
					<span class="text-brand">$</span> fly secrets set DATABASE_URL=...
				</p>
				<p class="text-muted-foreground">
					<span class="text-brand">$</span> fly secrets set AUTH_TOKEN=...
				</p>
				<p class="mt-3 text-muted-foreground">
					<span class="text-brand">#</span> Connect your AI
				</p>
				<p class="text-muted-foreground">
					<span class="text-brand">$</span> open
					<span class="text-amber-400">https://your-app.fly.dev/mcp</span>
				</p>
			</div>
		</div>

		<div class="mt-10 flex flex-wrap items-center justify-center gap-3">
			<a href="https://github.com/Michael-Obele/sepia" target="_blank" rel="noopener">
				<Button size="lg" class="gap-2 px-6">
					<ExternalLink class="size-4" /> Read the docs
				</Button>
			</a>
			<a href="/app">
				<Button variant="outline" size="lg" class="gap-2 px-6">
					Try the dashboard <ExternalLink class="size-4" />
				</Button>
			</a>
		</div>
	</div>
</section>

<!-- Footer -->
<footer class="border-t border-border/50 px-4 py-8">
	<div
		class="mx-auto flex max-w-5xl flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between"
	>
		<div class="flex items-center gap-2">
			<img src={favicon} alt="" class="size-4" />
			<span class="font-medium text-foreground">Sepia</span>
			<span>· Memory server for AI agents</span>
		</div>
		<div class="flex items-center gap-4">
			<a
				href="https://github.com/Michael-Obele/sepia"
				target="_blank"
				rel="noopener"
				class="transition-colors hover:text-foreground"
			>
				GitHub
			</a>
			<a href="/app" class="transition-colors hover:text-foreground">Dashboard</a>
		</div>
	</div>
</footer>
