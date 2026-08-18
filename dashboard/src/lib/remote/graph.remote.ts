import { query } from '$app/server';
import * as v from 'valibot';
import { traverseGraph, TraverseInput } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/** BFS traversal of the knowledge graph from a start entity. */
export const getGraph = query(v.tuple([v.string(), TraverseInput]), async ([token, input]) => {
	requireAuth(token);
	return traverseGraph(db(), input.start_id, input.depth);
});
