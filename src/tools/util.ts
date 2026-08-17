import { McpError } from "tmcp";
import { tool } from "tmcp/utils";
import { MemoryError } from "../db.ts";

/**
 * Wraps a tool handler so that business errors become MCP tool errors
 * (visible to the model as a message) instead of JSON-RPC failures, while
 * protocol-level McpErrors still propagate.
 */
export function safe<T>(handler: (args: T) => Promise<unknown>) {
  return async (args: T) => {
    try {
      return tool.text(JSON.stringify(await handler(args), null, 2));
    } catch (error) {
      if (error instanceof McpError) throw error;
      if (error instanceof MemoryError) {
        return tool.error(`[${error.code}] ${error.message}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      return tool.error(message);
    }
  };
}
