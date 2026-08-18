import * as v from "valibot";
import { db, MemoryError } from "./db.ts";
import {
  // business logic (shared with the MCP tools)
  createNamespace,
  listNamespaces,
  getNamespace,
  deleteNamespace,
  createEntity,
  getEntity,
  updateEntity,
  deleteEntity,
  findEntities,
  createMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  queryMemories,
  createRelation,
  deleteRelation,
  listRelations,
  search,
  traverseGraph,
  consolidate,
  getStats,
  // Valibot schemas (single source of truth for input validation)
  NamespaceInput,
  EntityInput,
  EntityUpdateInput,
  MemoryInput,
  MemoryUpdateInput,
  RelationInput,
  SearchInput,
  TraverseInput,
} from "@sepia/shared";

/**
 * REST API for the dashboard and external clients. Same process, same auth,
 * same business logic as the MCP tools — the /api/* surface is a thin JSON
 * wrapper over @sepia/shared. Error shape: { error: { code, message } }.
 */

const ALLOWED_ORIGINS = new Set([
  "https://sepia.svelte-apps.me",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      Vary: "Origin",
    };
  }
  return {};
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(data, { status, headers: extra });
}

function error(code: string, message: string, status: number) {
  return json({ error: { code, message } }, status);
}

/** Map a MemoryError to an HTTP status. */
function statusFor(err: MemoryError): number {
  switch (err.code) {
    case "not_found":
    case "namespace_not_found":
      return 404;
    case "already_exists":
      return 409;
    case "invalid_input":
    case "entity_not_found":
      return 422;
    default:
      return 400;
  }
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new MemoryError("invalid_input", "request body must be valid JSON");
  }
}

/** Parse a UUID path param; throw 422 if malformed. */
function uuidParam(value: string | undefined, name: string): string {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new MemoryError("invalid_input", `${name} must be a valid UUID`);
  }
  return value;
}

function numParam(value: string | null, fallback: number): number {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolParam(value: string | null, fallback: boolean): boolean {
  if (value === null || value === "") return fallback;
  return value === "true" || value === "1";
}

/** Validate a body against a Valibot schema; throw 422 on failure. */
function validate<T extends v.GenericSchema>(
  schema: T,
  data: unknown,
): v.InferOutput<T> {
  const result = v.safeParse(schema, data);
  if (!result.success) {
    const issues = v.flatten(result.issues);
    const first =
      Object.values(issues.nested ?? {})[0]?.[0] ??
      issues.root?.[0] ??
      "invalid input";
    throw new MemoryError("invalid_input", first);
  }
  return result.output;
}

/**
 * Route an /api/* request. Returns a Response, or null if the path isn't an
 * API route (caller falls through to 404).
 */
export async function handleApi(
  request: Request,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api")) return null;

  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const sql = db();
  const path = url.pathname;
  const method = request.method;

  try {
    // ── Namespaces ────────────────────────────────────────────────────────
    if (path === "/api/namespaces" && method === "GET") {
      return json({ namespaces: await listNamespaces(sql) }, 200, cors);
    }
    if (path === "/api/namespaces" && method === "POST") {
      const input = validate(NamespaceInput, await readBody(request));
      return json(
        {
          namespace: await createNamespace(sql, input.name, input.description),
        },
        201,
        cors,
      );
    }

    // ── Entities ──────────────────────────────────────────────────────────
    if (path === "/api/entities" && method === "GET") {
      const entities = await findEntities(
        sql,
        url.searchParams.get("namespace") ?? undefined,
        url.searchParams.get("q") ?? undefined,
        url.searchParams.get("type") ?? undefined,
        numParam(url.searchParams.get("limit"), 20),
      );
      return json({ count: entities.length, entities }, 200, cors);
    }
    if (path === "/api/entities" && method === "POST") {
      const body = (await readBody(request)) as Record<string, unknown>;
      const input = validate(EntityInput, body);
      const namespace =
        typeof body.namespace === "string" ? body.namespace : "personal";
      return json(
        { entity: await createEntity(sql, namespace, input) },
        201,
        cors,
      );
    }
    const entityMatch = path.match(/^\/api\/entities\/([^/]+)$/);
    if (entityMatch) {
      const id = uuidParam(entityMatch[1], "entity id");
      if (method === "GET")
        return json({ entity: await getEntity(sql, id) }, 200, cors);
      if (method === "PATCH") {
        const input = validate(EntityUpdateInput, await readBody(request));
        return json({ entity: await updateEntity(sql, id, input) }, 200, cors);
      }
      if (method === "DELETE")
        return json({ deleted: await deleteEntity(sql, id) }, 200, cors);
    }

    // ── Memories ──────────────────────────────────────────────────────────
    if (path === "/api/memories" && method === "GET") {
      const typeParam = url.searchParams.get("type");
      const memories = await queryMemories(sql, {
        type:
          (typeParam as
            | "fact"
            | "observation"
            | "preference"
            | "instruction"
            | null) ?? undefined,
        namespace: url.searchParams.get("namespace") ?? undefined,
        importance_min: url.searchParams.has("importance_min")
          ? numParam(url.searchParams.get("importance_min"), 0)
          : undefined,
        archived: boolParam(url.searchParams.get("archived"), false),
        limit: numParam(url.searchParams.get("limit"), 20),
      });
      return json({ count: memories.length, memories }, 200, cors);
    }
    if (path === "/api/memories" && method === "POST") {
      const body = (await readBody(request)) as Record<string, unknown>;
      const input = validate(MemoryInput, body);
      const source = "dashboard";
      return json(
        { memory: await createMemory(sql, input, source) },
        201,
        cors,
      );
    }
    const memoryMatch = path.match(/^\/api\/memories\/([^/]+)$/);
    if (memoryMatch) {
      const id = uuidParam(memoryMatch[1], "memory id");
      if (method === "GET")
        return json({ memory: await getMemory(sql, id) }, 200, cors);
      if (method === "PATCH") {
        const input = validate(MemoryUpdateInput, await readBody(request));
        return json({ memory: await updateMemory(sql, id, input) }, 200, cors);
      }
      if (method === "DELETE")
        return json({ deleted: await deleteMemory(sql, id) }, 200, cors);
    }

    // ── Relations ─────────────────────────────────────────────────────────
    if (path === "/api/relations" && method === "GET") {
      const relations = await listRelations(sql, {
        entity_id: url.searchParams.get("entity_id") ?? undefined,
        namespace: url.searchParams.get("namespace") ?? undefined,
      });
      return json({ count: relations.length, relations }, 200, cors);
    }
    if (path === "/api/relations" && method === "POST") {
      const input = validate(RelationInput, await readBody(request));
      return json({ relation: await createRelation(sql, input) }, 201, cors);
    }
    const relationMatch = path.match(/^\/api\/relations\/([^/]+)$/);
    if (relationMatch) {
      const id = uuidParam(relationMatch[1], "relation id");
      if (method === "DELETE")
        return json({ deleted: await deleteRelation(sql, id) }, 200, cors);
    }

    // ── Search / graph / consolidate / stats ──────────────────────────────
    if (path === "/api/search" && method === "GET") {
      const input = validate(SearchInput, {
        q: url.searchParams.get("q") ?? "",
        namespace: url.searchParams.get("namespace") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
        limit: numParam(url.searchParams.get("limit"), 10),
      });
      return json(
        {
          count: (await search(sql, input)).length,
          results: await search(sql, input),
        },
        200,
        cors,
      );
    }
    if (path === "/api/graph" && method === "GET") {
      const root = url.searchParams.get("root");
      if (!root)
        return error("invalid_input", "root entity id is required", 422);
      const depth = numParam(url.searchParams.get("depth"), 1);
      return json(
        await traverseGraph(sql, uuidParam(root, "root"), depth),
        200,
        cors,
      );
    }
    if (path === "/api/consolidate" && method === "POST") {
      return json({ result: await consolidate(sql) }, 200, cors);
    }
    if (path === "/api/stats" && method === "GET") {
      return json({ stats: await getStats(sql) }, 200, cors);
    }

    return error("not_found", `no such API route: ${method} ${path}`, 404);
  } catch (err) {
    if (err instanceof MemoryError) {
      return error(err.code, err.message, statusFor(err));
    }
    const message = err instanceof Error ? err.message : String(err);
    return error("internal_error", message, 500);
  }
}
