/**
 * Constants shared by the server, the dashboard, and the skill reference
 * generator. Single source of truth for domain values.
 */

/** Default namespace for all tools when none is specified. */
export const DEFAULT_NAMESPACE = "personal";

/** The four memory types. */
export const MEMORY_TYPES = [
  "fact",
  "observation",
  "preference",
  "instruction",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

/** Importance is a 0-1 score; higher decays slower. */
export const IMPORTANCE_MIN = 0;
export const IMPORTANCE_MAX = 1;
export const DEFAULT_IMPORTANCE = 0.5;

/** Memories can link to at most this many entities. */
export const MAX_ENTITY_LINKS = 3;

/** Upper bounds for list-like operations. */
export const SEARCH_LIMIT_MAX = 25;
export const QUERY_LIMIT_MAX = 50;
export const TRAVERSE_DEPTH_MAX = 3;

/** Consolidation policy (days). */
export const STALE_AFTER_DAYS = 90; // importance < 0.3 and untouched for this long → archive
export const STALE_IMPORTANCE = 0.3;
export const PURGE_AFTER_DAYS = 30; // archived for this long → hard delete
