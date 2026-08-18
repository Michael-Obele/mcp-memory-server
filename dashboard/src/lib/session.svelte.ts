import { browser } from '$app/environment';

/**
 * Client-side session. The sign-in token lives in sessionStorage (per the
 * plan) and is passed to every remote function, which validates it server-side
 * before touching the database.
 */
const TOKEN_KEY = 'sepia_token';

export function getToken(): string | null {
	if (!browser) return null;
	return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
	if (browser) sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
	if (browser) sessionStorage.removeItem(TOKEN_KEY);
}
