import { query } from '$app/server';
import * as v from 'valibot';
import { traverseGraph, fullGraph, TraverseInput } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/** BFS traversal of the knowledge graph from a start entity. */
export const getGraph = query(v.tuple([v.string(), TraverseInput]), async ([token, input]) => {
	requireAuth(token);
	return traverseGraph(db(), input.start_id, input.depth);
});

/** The entire knowledge graph (all entities + relations) for the full view. */
export const getFullGraph = query(v.string(), async (token) => {
	requireAuth(token);
	try {
		return await fullGraph(db());
	} catch (e) {
		console.error('[getFullGraph] error:', e);
		throw e;
	}
});

/** TEMP: simple test to isolate the serialization issue. */
export const getFullGraphTest = query(v.string(), async (token) => {
	requireAuth(token);
	return { ok: true, token: token?.slice(0, 4) };
});
