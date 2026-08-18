# GitHub Copilot Instructions — sepia Dashboard

Agent rules for building the **sepia web dashboard** (`dashboard/`) — an SSR SvelteKit app that reads/writes the sepia memory graph **directly via Drizzle + Neon** (through `@sepia/shared`), using **remote functions** for data fetching and mutations. Follow these rules for every change in this folder. See [`../plan/dashboard.md`](../plan/dashboard.md) for the full spec.

## Tech Stack & Architecture

- **Runtime & Tooling**: Bun (`bun`, `bunx`) is the preferred package manager and task runner.
- **Framework**: SvelteKit 5 (runes mode is forced in `vite.config.ts` — always use runes: `$state`, `$props`, `$derived`, `$effect`).
- **Deployment**: SSR (server-rendered SvelteKit). Use `+page.server.ts`/`+layout.server.ts` ONLY for initial `load` functions; mutations go through remote functions.
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`). Prefer semantic classes (e.g., `btn-primary`, `text-muted-foreground`).
- **Data**: Direct Neon Postgres via **Drizzle** — the dashboard connects to the same DB as the server, through `@sepia/shared` (the shared package exports the Drizzle client, schema, and all data-layer functions). No REST API layer.
- **Authentication**: Bearer token stored in `sessionStorage` (Phase 1), sent as `Authorization: Bearer ...` on every API call. Phase 2 will use Authorization Code + PKCE. Never use cookies. **Better Auth is NOT in use** — it may be adopted later, but do not install or wire it up in this pass.
- **Icons**: Use `@lucide/svelte` (NEVER use `lucide-svelte`). Import icons as components: `import { IconName } from '@lucide/svelte'`. Use Lucide icons sparingly and only where they add real meaning — status, direction, or an action affordance. Never add decorative filler icons, and in particular avoid `Sparkles`/AI-style icons on buttons, headings, and dropdown options. Prefer text-only labels for dropdown options, tips, and captions; a control should communicate its purpose without its icon.
- **Components**: shadcn-svelte primitives and Bits UI. Never manually write shadcn-svelte components; always generate or install them via the official CLI commands obtained from MCP documentation or trusted research.

## Coding Conventions

### Quality Gate

- **Formatting**: Format only the files you have edited rather than the entire application. Use `bunx prettier --write <file_path>` for edited files. Additionally, verify changes with `bunx prettier --check <file_path>`. Avoid full-project formatting to prevent unnecessary file changes.
- **Proactive Checking**: Run `bun run check` (svelte-kit sync + svelte-check) immediately after substantive edits to catch regressions or type errors.
- **Error Handling**: Only warnings can be ignored; errors must be fixed immediately. Use `<svelte:boundary>` for async operations to handle loading and error states gracefully.

### Package Management

- **Installation**: Always install packages via CLI using `bun add <package>` or `bunx <package>` for one-time use. Never edit package.json directly.
- **Research**: Thoroughly research packages before installation to ensure compatibility, necessity, and alignment with project standards (e.g., check for Svelte 5 compatibility, bundle size, maintenance status).

### Svelte 5 Runes

Always use Svelte 5 runes for reactivity. Never use legacy `export let` or `$:`.

- `$state(value)`: Declare reactive state. Use `$state.raw` for large objects/arrays that don't need deep reactivity.
- `$props()`: Receive component props. Destructure for clarity: `let { prop1, prop2 } = $props();`.
- `$derived(expression)`: Declare derived state. Use `$derived.by(() => ...)` for complex logic.
- `$effect(() => ...)`: Handle side effects (DOM, timers, etc.). Avoid for state synchronization.
- `$bindable()`: Mark a prop as bindable for two-way communication.
- `$inspect(value)`: Debug reactive state in development.
- **Events**: Use modern event attributes (e.g., `onclick`, `onsubmit`, `onchange`) directly on elements.

### Deprecated Svelte Patterns to Avoid

Avoid these deprecated patterns from Svelte 4 and earlier. Use the modern Svelte 5 equivalents instead:

- **State Management**: Never use `let` declarations at the top level for reactivity. Use `$state()` instead.
- **Reactive Statements**: Avoid `$:` for derived state or side effects. Use `$derived()` and `$effect()` instead.
- **Props**: Never use `export let` for component props. Use `$props()` destructuring instead.
- **Event Handlers**: Avoid `on:click={handler}` directives. Use `onclick={handler}` attributes instead.
- **Component Events**: Never use `createEventDispatcher`. Pass callback props instead.
- **Component Instantiation**: Avoid `new Component()`. Use `mount(Component, ...)` instead.
- **Lifecycle Hooks**: Avoid `beforeUpdate`/`afterUpdate`. Use `$effect.pre`/`$effect` instead.
- **Slots**: Avoid `<slot />`. Use `{@render children()}` with snippets instead.
- **Dynamic Components**: Avoid `<svelte:component this={Comp}>`. Use `<Comp />` directly.
- **Legacy Props**: Avoid `$$props` and `$$restProps`. Use destructuring in `$props()` instead.
- **Stores**: Prefer runes over Svelte stores for component-level state.
- **Class Components**: Avoid class-based components. Use function components with runes.

- Use `$app/state` (e.g., `import { page } from '$app/state'`) instead of the deprecated `$app/stores` for accessing `page`, `navigating`, `updated`, etc.

### Data Fetching & Mutations (Remote Functions)

Default to **Remote Functions** (experimental `@sveltejs/kit` features or standard patterns) over `+page.server.ts` actions for most mutations.

- **Location**: Place remote functions in `src/lib/remote/` with the `.remote.ts` extension.
- **Barrel Exports**: Use `src/lib/remote/index.ts` to re-export all functions individually (not `export *`) to allow for better documentation and discovery.
- **Flavors**:
  - `query`: For reading dynamic data. Supports `refresh()`, `loading`, `error`.
  - `form`: For mutations via `<form>`. Supports progressive enhancement via `enhance`. Always prefer `form` components with `bind:value` or `.as()` attributes over manual `async handleSubmit` functions.
  - `command`: For mutations triggered by scripts/buttons without a form.
  - `prerender`: For data that can be fetched at build time.
- **Validation**: Always validate inputs using a Standard Schema library, preferably **Valibot**.
- **Form Usage**: Always use the `form` object and its fields (e.g., `form.fields.name.as('text')`) to bind to native HTML elements. Avoid creating custom `handleSubmit` async functions to manually call remote functions; instead, let the form's native submission or `enhance` handle the interaction.
- **Client-side Validation**: Use `preflight(schema)` for client-side validation before submission where applicable.
- **Efficiency**: Use `query.batch` for multiple related fetches and `submit().updates(query)` for efficient post-mutation UI updates.

### Database Access

- **Version**: Always use **Drizzle** (the project's ORM — NOT Prisma). The dashboard connects to Neon Postgres directly, through `@sepia/shared`.
- **Shared data layer**: `@sepia/shared` exports the Drizzle client (`db()`), the schema, and all data-layer functions (`createEntity`, `listMemories`, `search`, `traverseGraph`, `consolidate`, `stats`, etc.). Reuse these — do not re-implement DB access in the dashboard.
- **Client**: Use the lazy singleton `db()` from `@sepia/shared` (Neon HTTP driver). Never create a second client.
- **Schema changes**: `bunx drizzle-kit generate` for migrations, `bunx drizzle-kit push` for rapid prototyping. Schema lives in `packages/shared/src/db/schema.ts` (single source of truth for server + dashboard).
- **Env**: `DATABASE_URL` must be available to the dashboard (`.env` for dev, Netlify env vars for deploy).

### Accessibility (AAA)

- **AAA Check**: Every page or route must pass the AAA accessibility check (WCAG AAA) before it is considered complete. Ensure everything is easily visible and readable: sufficient contrast between text and backgrounds, legible font sizes and weights, clear visual hierarchy, and no content that is too small, too faint, or hard to read.
- **Verification**: After building or changing a page or route, audit it for AAA compliance — contrast, readability, and visibility — and fix any failures before finalizing.

### Styling & UI Design

- **Gradients**: NEVER use gradients; prefer solid colors, clean layouts, and professional minimalist aesthetics.
- **Tailwind v4**: Use semantic tokens from the CSS configuration (`src/routes/layout.css`). Avoid hardcoded HSL/Hex strings in components.
- **Responsive**: Use standard Tailwind responsive prefixes (e.g., `lg:flex-row`).
- **Utility**: Use a `cn` utility (clsx + tailwind-merge) for conditional class merging.

## Key Files & Directories Pattern

- `src/lib/remote/`: Logic for data fetching and mutations (`.remote.ts` files, barrel-exported from `src/lib/remote/index.ts`). These call `@sepia/shared` data-layer functions.
- `src/lib/components/ui/`: shadcn-svelte / primitive UI components. Prefer CLI-generated shadcn-svelte components over hand-written implementations.
- `src/lib/components/`: Shared components (e.g., navbar, footer) in `blocks/` subfolder; route-specific components in folders named after the route.
- `src/routes/`: Router logic. Use `+page.server.ts` or `+layout.server.ts` ONLY for initial `load` functions.
- `static/`: Static assets.

## Common Workflows

- **Development**: `bun run dev`
- **Type Checking**: `bun run check`
- **Build**: `bun run build`
- **Preview**: `bun run preview`

## AI Agent Integration

- **Memory MCP**: Use the **sepia MCP** (`mcp_sepia_*` tools) for memory — persist useful context by writing to and reading from it during work to maintain consistency across sessions. This is the same knowledge graph the dashboard displays, so what you store is what the dashboard shows.
- **Documentation**: Use `mcp_svelte_get-documentation` for the latest Svelte 5/Kit logic and `mcp_svelte_svelte-autofixer` to validate components before finalizing.
- **shadcn-svelte Workflow**: Never author shadcn-svelte components manually. Always use the CLI commands recommended by MCP documentation or equivalent trusted research to create, add, or update them.
