import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Server-side auth for remote functions. The dashboard connects to Neon
 * directly (via @sepia/shared), so the sign-in token gates the Netlify
 * function endpoints. The expected token is DASHBOARD_TOKEN, falling back to
 * the server's MCP_BEARER_TOKEN so one token works everywhere.
 *
 * In dev (no token set) auth is skipped.
 */
export function requireAuth(token: string | undefined) {
	const expected = env.DASHBOARD_TOKEN ?? env.MCP_BEARER_TOKEN;
	if (!expected) return; // dev mode — no auth configured
	if (token && token === expected) return;
	error(401, 'Unauthorized — sign in with your sepia token');
}
