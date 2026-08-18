/**
 * Database errors that should surface to the client (MCP tool error, REST
 * error, or dashboard remote-function error) as a structured message.
 */
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
