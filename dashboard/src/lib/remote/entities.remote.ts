import { query, command } from '$app/server';
import * as v from 'valibot';
import {
	findEntities,
	getEntity,
	createEntity,
	updateEntity,
	deleteEntity,
	EntityInput,
	EntityUpdateInput
} from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

const EntityFilters = v.object({
	namespace: v.optional(v.string()),
	q: v.optional(v.string()),
	type: v.optional(v.string()),
	limit: v.optional(v.number(), 20),
	offset: v.optional(v.number(), 0)
});

/** List/filter entities. */
export const getEntities = query(v.tuple([v.string(), EntityFilters]), async ([token, filters]) => {
	requireAuth(token);
	return findEntities(db(), filters.namespace, filters.q, filters.type, filters.limit, filters.offset);
});

/** Full entity detail: entity + linked memories + in/out relations. */
export const getEntityDetail = query(v.tuple([v.string(), v.string()]), async ([token, id]) => {
	requireAuth(token);
	return getEntity(db(), id);
});

/** Create an entity. */
export const addEntity = command(
	v.tuple([v.string(), v.string(), EntityInput]),
	async ([token, namespace, input]) => {
		requireAuth(token);
		return createEntity(db(), namespace, input);
	}
);

/** Update an entity. */
export const updateEntityData = command(
	v.tuple([v.string(), v.string(), EntityUpdateInput]),
	async ([token, id, update]) => {
		requireAuth(token);
		return updateEntity(db(), id, update);
	}
);

/** Delete an entity (cascades relations, unlinks memories). */
export const removeEntity = command(v.tuple([v.string(), v.string()]), async ([token, id]) => {
	requireAuth(token);
	return deleteEntity(db(), id);
});
