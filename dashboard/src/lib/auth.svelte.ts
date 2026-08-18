import { getToken, setToken, clearToken } from './session.svelte';

/**
 * Reactive auth state for the dashboard UI. The token is read from
 * sessionStorage and passed to every remote function call.
 *
 * Note: module-level $state is shared between SSR and the client, so the
 * token is hydrated from sessionStorage in the layout's $effect (which runs
 * on the client after hydration) — see src/routes/+layout.svelte.
 */
export const auth = $state<{ token: string }>({ token: '' });

/** Whether the user is signed in. Exported as a function (derived state
 * can't be exported from a module). */
export function isAuthed(): boolean {
	return auth.token.length > 0;
}

export function login(token: string) {
	auth.token = token;
	setToken(token);
}

export function logout() {
	auth.token = '';
	clearToken();
}
