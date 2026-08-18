import { query, command } from '$app/server';
import * as v from 'valibot';
import { listNamespaces, createNamespace, deleteNamespace, NamespaceInput } from '@sepia/shared';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';

/** List namespaces with entity/memory/relation counts. */
export const getNamespaces = query(v.string(), async (token) => {
	requireAuth(token);
	return listNamespaces(db());
});

/** Create a namespace. */
export const addNamespace = command(
	v.tuple([v.string(), NamespaceInput]),
	async ([token, input]) => {
		requireAuth(token);
		return createNamespace(db(), input.name, input.description);
	}
);

/** Delete a namespace (cascades entities → relations/memories). */
export const removeNamespace = command(
	v.tuple([v.string(), v.string()]),
	async ([token, idOrName]) => {
		requireAuth(token);
		return deleteNamespace(db(), idOrName);
	}
);
