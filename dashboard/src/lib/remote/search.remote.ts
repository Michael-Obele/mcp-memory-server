import { query } from '$app/server';
import * as v from 'valibot';
import { search, SearchInput } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/** Unified search over memories + entities (same engine as the MCP tool). */
export const searchAll = query(v.tuple([v.string(), SearchInput]), async ([token, input]) => {
	requireAuth(token);
	return search(db(), input);
});
