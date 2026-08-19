import { query, command } from '$app/server';
import * as v from 'valibot';
import {
	queryMemories,
	getMemory,
	createMemory,
	updateMemory,
	deleteMemory,
	MemoryInput,
	MemoryUpdateInput
} from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

const MemoryFilters = v.object({
	type: v.optional(v.picklist(['fact', 'observation', 'preference', 'instruction'])),
	namespace: v.optional(v.string()),
	importance_min: v.optional(v.number()),
	archived: v.optional(v.boolean(), false),
	limit: v.optional(v.number(), 20),
	offset: v.optional(v.number(), 0)
});

/** Query memories with filters. */
export const getMemories = query(v.tuple([v.string(), MemoryFilters]), async ([token, filters]) => {
	requireAuth(token);
	return queryMemories(db(), filters);
});

/** Full memory detail: memory + linked entities. */
export const getMemoryDetail = query(v.tuple([v.string(), v.string()]), async ([token, id]) => {
	requireAuth(token);
	return getMemory(db(), id);
});

/** Create a memory (optionally linked to entities). */
export const addMemory = command(v.tuple([v.string(), MemoryInput]), async ([token, input]) => {
	requireAuth(token);
	return createMemory(db(), input, 'dashboard');
});

/** Update a memory. */
export const updateMemoryData = command(
	v.tuple([v.string(), v.string(), MemoryUpdateInput]),
	async ([token, id, update]) => {
		requireAuth(token);
		return updateMemory(db(), id, update);
	}
);

/** Delete a memory. */
export const removeMemory = command(v.tuple([v.string(), v.string()]), async ([token, id]) => {
	requireAuth(token);
	return deleteMemory(db(), id);
});
