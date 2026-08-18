import { query, command } from '$app/server';
import * as v from 'valibot';
import { listRelations, createRelation, deleteRelation, RelationInput } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

const RelationFilters = v.object({
	entity_id: v.optional(v.string()),
	namespace: v.optional(v.string())
});

/** List relations (by entity or namespace). */
export const getRelations = query(
	v.tuple([v.string(), RelationFilters]),
	async ([token, filters]) => {
		requireAuth(token);
		return listRelations(db(), filters);
	}
);

/** Create a relation (upserts weight on conflict). */
export const addRelation = command(v.tuple([v.string(), RelationInput]), async ([token, input]) => {
	requireAuth(token);
	return createRelation(db(), input);
});

/** Delete a relation. */
export const removeRelation = command(v.tuple([v.string(), v.string()]), async ([token, id]) => {
	requireAuth(token);
	return deleteRelation(db(), id);
});
