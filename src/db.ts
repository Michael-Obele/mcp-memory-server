/**
 * Server-side DB entry point. The Drizzle client, schema, errors, and all
 * business logic now live in @sepia/shared (packages/shared/src/db/) so the
 * MCP server, the REST API, and the dashboard share ONE data layer — no drift.
 */
export { db, type Db } from "@sepia/shared";
export { MemoryError } from "@sepia/shared";
