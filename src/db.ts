import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/** The query function type used everywhere. */
export type Db = NeonQueryFunction<false, false>;

let cached: Db | null = null;

/**
 * Returns the Neon client, creating it lazily on first use so that
 * protocol-only operations (initialize, tools/list) work even without
 * DATABASE_URL configured.
 */
export function db(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — add it to .env (see .env.example) or run: fly secrets set DATABASE_URL=...",
    );
  }
  cached = neon(url);
  return cached;
}

/** Database errors that should surface to the client as tool errors. */
export class MemoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MemoryError";
    this.code = code;
  }
}

export function notFound(kind: string, idOrName: string): MemoryError {
  return new MemoryError("not_found", `${kind} '${idOrName}' not found`);
}
