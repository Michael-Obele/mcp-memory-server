/**
 * Seeds the default namespace with a demo knowledge graph so search,
 * traversal, and consolidation are testable immediately.
 *
 * Idempotent: safe to re-run (entities/memories are matched by name/content).
 *
 * Usage: bun run seed   (requires DATABASE_URL in .env)
 */
import { db } from "../src/db.ts";
import { createNamespace } from "../src/lib/namespaces.ts";
import { createEntity } from "../src/lib/entities.ts";
import { createRelation } from "../src/lib/relations.ts";
import { createMemory } from "../src/lib/memories.ts";

const sql = db();

// 1. Ensure the default namespace exists.
const ns = await createNamespace(sql, "personal", "Default namespace").catch(
  () => null,
);
console.log(`✓ namespace 'personal' ready`);

// 2. Entities — match by name to stay idempotent.
async function entity(
  name: string,
  type: string,
  extra: Record<string, unknown> = {},
) {
  const existing = await sql`
    SELECT e.* FROM entities e
    JOIN namespaces n ON n.id = e.namespace_id
    WHERE n.name = 'personal' AND e.name = ${name} LIMIT 1
  `;
  if (existing[0]) {
    console.log(`  ~ entity '${name}' exists`);
    return String(existing[0].id);
  }
  const created = await createEntity(sql, "personal", { name, type, ...extra });
  if (!created) throw new Error(`entity '${name}' was not created`);
  console.log(`  + entity '${name}' (${type})`);
  return String(created.id);
}

const ids = {
  michael: await entity("Michael", "person", {
    summary: "The owner of this memory server",
    importance: 0.9,
  }),
  memoryServer: await entity("Memory MCP Server", "project", {
    summary: "Self-hosted remote knowledge-graph memory server for AI agents",
    importance: 0.8,
  }),
  bun: await entity("Bun", "tool", {
    summary:
      "Fast all-in-one JavaScript runtime — chosen for ~30ms cold starts",
    importance: 0.7,
  }),
  tmcp: await entity("TMCP", "tool", {
    summary:
      "TypeScript MCP framework with Valibot adapter and instructions support",
    importance: 0.7,
  }),
  neon: await entity("Neon Postgres", "tool", {
    summary: "Serverless Postgres with scale-to-zero free tier",
    importance: 0.6,
  }),
  fly: await entity("Fly.io", "platform", {
    summary: "Hosting platform — scale-to-zero VM for the server",
    importance: 0.6,
  }),
  netlify: await entity("Netlify", "platform", {
    summary: "CDN hosting for the dashboard SPA",
    importance: 0.5,
  }),
};

// 3. Relations (idempotent: upsert updates weight, never duplicates).
const relations: Array<[string, string, string, number]> = [
  [ids.memoryServer, ids.bun, "uses", 0.9],
  [ids.memoryServer, ids.tmcp, "uses", 0.9],
  [ids.memoryServer, ids.neon, "uses", 0.8],
  [ids.memoryServer, ids.fly, "deployed_on", 0.8],
  [ids.memoryServer, ids.netlify, "deployed_on", 0.6],
  [ids.michael, ids.memoryServer, "owns", 0.9],
  [ids.michael, ids.bun, "prefers", 0.8],
  [ids.tmcp, ids.bun, "runs_on", 0.7],
];
for (const [source, target, relation_type, weight] of relations) {
  await createRelation(sql, {
    source_id: source,
    target_id: target,
    relation_type,
    weight,
  });
}
console.log(`✓ ${relations.length} relations ready`);

// 4. Memories (idempotent: skip if exact content already exists in personal).
const memories: Array<{
  content: string;
  type: "fact" | "observation" | "preference" | "instruction";
  importance: number;
  entity_ids: string[];
}> = [
  {
    content:
      "Chose Bun over Node for the memory server because cold start matters when Fly scale-to-zero wakes the VM.",
    type: "fact",
    importance: 0.7,
    entity_ids: [ids.memoryServer, ids.bun],
  },
  {
    content:
      "Michael prefers Bun over Node.js and pnpm-style monorepo tooling.",
    type: "preference",
    importance: 0.8,
    entity_ids: [ids.michael, ids.bun],
  },
  {
    content:
      "The server sends MCP instructions in the initialize handshake so clients inject the usage contract into the system prompt.",
    type: "fact",
    importance: 0.6,
    entity_ids: [ids.memoryServer, ids.tmcp],
  },
  {
    content:
      "Neon free tier (0.5 GB, 100 CU-hours) is plenty for ~10K memories.",
    type: "fact",
    importance: 0.5,
    entity_ids: [ids.neon],
  },
  {
    content:
      "Dashboard is a static SPA on Netlify so browsing never wakes the scaled-to-zero Fly machine.",
    type: "observation",
    importance: 0.6,
    entity_ids: [ids.memoryServer, ids.netlify],
  },
];
let memoryCount = 0;
for (const m of memories) {
  const existing = await sql`
    SELECT id FROM memories
    WHERE namespace_id = (SELECT id FROM namespaces WHERE name = 'personal')
      AND lower(btrim(content)) = lower(btrim(${m.content})) LIMIT 1
  `;
  if (existing[0]) continue;
  await createMemory(sql, m, "seed");
  memoryCount++;
  console.log(`  + memory: ${m.content.slice(0, 60)}…`);
}
console.log(
  `✓ ${memoryCount} new memories (${memories.length - memoryCount} already present)`,
);

console.log("\nDone. Try: bun run smoke");
