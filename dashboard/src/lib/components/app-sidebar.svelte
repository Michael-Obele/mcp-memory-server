<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';
	import {
		Search,
		Layers,
		Boxes,
		Network,
		Plug,
		Settings,
		LogOut,
		BrainCircuit
	} from '@lucide/svelte';
	import { logout } from '$lib/auth.svelte';
	import { goto } from '$app/navigation';

	const nav = [
		{ href: '/', label: 'Search', icon: Search },
		{ href: '/memories', label: 'Memories', icon: Layers },
		{ href: '/entities', label: 'Entities', icon: Boxes },
		{ href: '/graph', label: 'Graph', icon: Network },
		{ href: '/connect', label: 'Connect an AI', icon: Plug },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function handleLogout() {
		logout();
		goto('/');
	}
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" class="gap-2">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								<BrainCircuit class="size-4" />
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">Sepia</span>
								<span class="truncate text-xs text-muted-foreground">Memory server</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
			<Sidebar.Menu>
				{#each nav as item}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={isActive(item.href)} tooltipContent={item.label}>
							{#snippet child({ props })}
								<a href={item.href} {...props}>
									<item.icon />
									<span>{item.label}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton onclick={handleLogout} tooltipContent="Sign out">
					<LogOut />
					<span>Sign out</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
