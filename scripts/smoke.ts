/**
 * Headless JSON-RPC smoke test for the MCP server.
 *
 * Tests the protocol surface (initialize incl. instructions, tools/list,
 * auth) always; runs a full CRUD scenario in a throwaway namespace when
 * DATABASE_URL is set. Exits non-zero on any failure.
 *
 * Usage:
 *   bun run smoke                          # protocol tests against localhost:8080
 *   SMOKE_URL=https://... bun run smoke    # against a deployed server
 */
import { db } from "../src/db.ts";
import { TOOL_NAMES } from "@sepia/shared";

const BASE = process.env.SMOKE_URL ?? "http://localhost:8080/mcp";
const token = process.env.MCP_BEARER_TOKEN;
const hasDb = Boolean(process.env.DATABASE_URL);

let sessionId: string | null = null;
let nextId = 1;
let failures = 0;

function ok(label: string, detail = "") {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label: string, detail = "") {
  failures++;
  console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
}
function check(label: string, cond: boolean, detail = "") {
  cond ? ok(label, detail) : fail(label, detail);
}

async function rpc(
  method: string,
  params?: unknown,
  opts: { notify?: boolean } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  if (token) headers["authorization"] = `Bearer ${token}`;
  const body = opts.notify
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: nextId++, method, params };
  const res = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  if (opts.notify) return null;

  // Streamable HTTP responses may be application/json OR text/event-stream —
  // TMCP uses SSE framing, so handle both.
  const raw = await res.text();
  let payload: unknown;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
    if (!dataLine)
      throw new Error(`SSE response had no data line: ${raw.slice(0, 200)}`);
    payload = JSON.parse(dataLine.slice(6));
  } else {
    payload = JSON.parse(raw);
  }
  const json = payload as {
    result?: unknown;
    error?: { message?: string; code?: number };
  };
  if (json.error) throw new Error(`${json.error.message ?? json.error.code}`);
  return json.result;
}

async function callTool(name: string, args: Record<string, unknown>) {
  const result = (await rpc("tools/call", { name, arguments: args })) as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  const text = result.content?.find((c) => c.type === "text")?.text ?? "";
  if (result.isError) throw new Error(`tool ${name} returned error: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}

console.log(
  `smoke: ${BASE} (auth: ${token ? "bearer" : "none"}, db: ${hasDb ? "yes" : "no"})`,
);

// ── 1. Auth guard ───────────────────────────────────────────────────────────
if (token) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    }),
  });
  check("auth: 401 without token", res.status === 401, `status ${res.status}`);
} else {
  console.log("  ⏭  auth test skipped (MCP_BEARER_TOKEN not set)");
}

// ── 2. Protocol surface ─────────────────────────────────────────────────────
const init = (await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke-test", version: "0.0.1" },
})) as {
  instructions?: string;
  capabilities?: { tools?: unknown };
  serverInfo?: { name?: string };
};

check("initialize succeeds", Boolean(init));
check(
  "server name is 'sepia'",
  init.serverInfo?.name === "sepia",
  init.serverInfo?.name,
);
check(
  "instructions contract sent",
  typeof init.instructions === "string" &&
    init.instructions.includes("Usage contract"),
  `${init.instructions?.slice(0, 40)}…`,
);
check("tools capability advertised", Boolean(init.capabilities?.tools));

await rpc("notifications/initialized", undefined, { notify: true });

const listed = (await rpc("tools/list")) as { tools?: Array<{ name: string }> };
const names = (listed.tools ?? []).map((t) => t.name);
for (const expected of TOOL_NAMES) {
  check(`tool: ${expected}`, names.includes(expected));
}
check("exactly 7 tools", names.length === 7, names.length.toString());

// ── 3. CRUD scenario (requires DATABASE_URL) ────────────────────────────────
if (hasDb) {
  console.log("crud scenario (throwaway namespace):");
  const ns = `smoke-${Date.now()}`;
  try {
    const created = (await callTool("manage_namespace", {
      action: "create",
      name: ns,
    })) as {
      namespace: { id: string };
    };
    const nsId = created.namespace.id;
    ok("namespace create", ns);

    const project = (await callTool("manage_entity", {
      action: "create",
      namespace: ns,
      entity: {
        name: "Smoke Project",
        type: "project",
        summary: "test",
        importance: 0.8,
      },
    })) as { entity: { id: string } };
    const toolEntity = (await callTool("manage_entity", {
      action: "create",
      namespace: ns,
      entity: { name: "Smoke Tool", type: "tool", importance: 0.6 },
    })) as { entity: { id: string } };
    const person = (await callTool("manage_entity", {
      action: "create",
      namespace: ns,
      entity: { name: "Smoke Person", type: "person", importance: 0.9 },
    })) as { entity: { id: string } };
    ok(
      "entity create ×3",
      [project.entity.id, toolEntity.entity.id, person.entity.id]
        .join(",")
        .slice(0, 12) + "…",
    );

    await callTool("manage_relation", {
      action: "create",
      relation: {
        source_id: project.entity.id,
        target_id: toolEntity.entity.id,
        relation_type: "uses",
        weight: 0.9,
      },
    });
    await callTool("manage_relation", {
      action: "create",
      relation: {
        source_id: person.entity.id,
        target_id: project.entity.id,
        relation_type: "owns",
        weight: 0.9,
      },
    });
    // Upsert: same relation, new weight → should update, not duplicate.
    await callTool("manage_relation", {
      action: "create",
      relation: {
        source_id: project.entity.id,
        target_id: toolEntity.entity.id,
        relation_type: "uses",
        weight: 0.5,
      },
    });
    const relList = (await callTool("manage_relation", {
      action: "list",
      entity_id: project.entity.id,
    })) as {
      relations: unknown[];
    };
    check(
      "relation create + upsert (no dupes)",
      relList.relations.length === 2,
      `${relList.relations.length} relations`,
    );

    const mem = (await callTool("manage_memory", {
      action: "create",
      memory: {
        content:
          "Smoke memory: the project uses the tool for testing cold starts",
        type: "fact",
        importance: 0.7,
        namespace: ns,
        entity_ids: [project.entity.id, toolEntity.entity.id],
      },
    })) as { memory: { id: string } };
    ok("memory create (linked to 2 entities)");

    const fetched = (await callTool("manage_memory", {
      action: "get",
      id: mem.memory.id,
    })) as {
      memory: { entities: unknown[] };
    };
    check("memory get includes links", fetched.memory.entities.length === 2);

    const searchRes = (await callTool("search", {
      q: "cold starts",
      namespace: ns,
    })) as { hits: unknown[] };
    check(
      "search finds memory",
      searchRes.hits.length > 0,
      `${searchRes.hits.length} hits`,
    );

    const trav = (await callTool("traverse_graph", {
      start_id: project.entity.id,
      depth: 2,
    })) as {
      nodes: unknown[];
      edges: unknown[];
    };
    check(
      "traverse_graph depth 2",
      trav.nodes.length === 3 && trav.edges.length === 2,
      `${trav.nodes.length} nodes, ${trav.edges.length} edges`,
    );

    await callTool("manage_memory", {
      action: "update",
      id: mem.memory.id,
      update: { importance: 0.2, entity_ids: [] },
    });
    const requery = (await callTool("manage_memory", {
      action: "query",
      namespace: ns,
      importance_min: 0.5,
    })) as {
      memories: unknown[];
    };
    check(
      "memory update (importance + unlink)",
      requery.memories.length === 0,
      "0 memories at importance ≥ 0.5",
    );

    const cons = (await callTool("consolidate", {})) as {
      archived_stale: number;
    };
    check("consolidate runs", typeof cons.archived_stale === "number");

    await callTool("manage_namespace", { action: "delete", name: ns });
    ok("namespace delete (cascade cleanup)");
  } catch (error) {
    fail(
      "crud scenario",
      error instanceof Error ? error.message : String(error),
    );
    // Best-effort cleanup so re-runs stay green.
    try {
      await callTool("manage_namespace", { action: "delete", name: ns });
    } catch {
      /* namespace may not exist */
    }
  }
} else {
  console.log("  ⏭  crud scenario skipped (set DATABASE_URL)");
  // Validate the lib layer against a live DB if present — nothing more to do.
  try {
    db();
  } catch {
    /* expected without DATABASE_URL */
  }
}

console.log(
  failures === 0
    ? "\n🎉 all smoke tests passed"
    : `\n💥 ${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);
