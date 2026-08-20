import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'alt-x',
			showToggleButton: 'always',
			toggleButtonPos: 'bottom-right'
		}
	},

	kit: {
		// adapter-netlify: SSR + remote functions run in Netlify Functions,
		// connecting to Neon directly via @sepia/shared.
		adapter: adapter({
			// Node-based functions (not edge) — the Neon HTTP driver needs Node.
			edge: false,
			split: false
		}),
		experimental: {
			// Remote functions (.remote.ts) — type-safe client↔server data layer.
			remoteFunctions: true
		}
	},

	compilerOptions: {
		experimental: {
			// Svelte await expressions — `{#each await getX() as ...}` in components.
			async: true
		},
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	}
};

export default config;
