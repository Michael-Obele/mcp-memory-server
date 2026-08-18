import { env } from '$env/dynamic/private';
import { db as createDb, type Db } from '@sepia/shared';

/**
 * Dashboard DB client. Reads DATABASE_URL from SvelteKit's $env/dynamic/private
 * (which Vite populates from .env / Netlify env vars) and passes it to the
 * shared Drizzle client. The shared client caches, so this is cheap.
 */
export function db(): Db {
	return createDb(env.DATABASE_URL);
}
