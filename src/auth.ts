/**
 * Phase 1 authentication: static Bearer token via the MCP_BEARER_TOKEN env
 * var. When the env var is unset the server runs in DEV MODE (no auth) —
 * never deploy without setting it. Phase 2 (OAuth 2.1 via @tmcp/auth) will
 * layer on top of this without removing the token path.
 */

export function requireAuth(request: Request): Response | null {
  const expected = process.env.MCP_BEARER_TOKEN;
  if (!expected) return null; // dev mode
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token === expected) return null;
  return Response.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="mcp-memory"' },
    },
  );
}

export function authEnabled(): boolean {
  return Boolean(process.env.MCP_BEARER_TOKEN);
}
