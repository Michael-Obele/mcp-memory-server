import { command } from '$app/server';
import * as v from 'valibot';
import { consolidate } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/** Run the decay/dedup/purge maintenance sweep. */
export const runConsolidate = command(v.string(), async (token) => {
	requireAuth(token);
	return consolidate(db());
});
