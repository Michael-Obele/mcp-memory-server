import { query } from '$app/server';
import * as v from 'valibot';
import { getStats } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/** Dashboard stats: counts, top entities, decay candidates, recent feed. */
export const getStatsData = query(v.string(), async (token) => {
	requireAuth(token);
	return getStats(db());
});
