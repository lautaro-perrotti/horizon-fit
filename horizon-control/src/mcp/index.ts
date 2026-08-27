import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { AppServices } from "../app-context.js";
import { ALL_TOOLS } from "../config.js";
import { AuthError } from "../auth/resource-server.js";
import { wwwAuthenticate } from "../auth/metadata.js";
import { dispatchCommand, TOOL_ARG_SCHEMAS, TOOL_DESCRIPTIONS } from "../core/commands/index.js";
import type { AuthPrincipal, ToolName } from "../types.js";
import { commandFromMcpName, denyList, listRegisteredTools, MCP_TOOL_NAME_PATTERN, mcpToolName } from "./tools.js";

export { commandFromMcpName, denyList, listRegisteredTools, MCP_TOOL_NAME_PATTERN, mcpToolName };

function jsonSchemaShape(tool: ToolName): Record<string, z.ZodType> {
  const schema = TOOL_ARG_SCHEMAS[tool];
  if (schema instanceof z.ZodObject) {
    return schema.shape as Record<string, z.ZodType>;
  }
  return {};
}

export function createMcpServer(services: AppServices, principal: AuthPrincipal): McpServer {
  const server = new McpServer({
    name: "horizon-control",
    version: "0.1.0",
  });

  for (const tool of ALL_TOOLS) {
    const name = mcpToolName(tool);
    server.registerTool(
      name,
      {
        title: name,
        description: TOOL_DESCRIPTIONS[tool],
        inputSchema: jsonSchemaShape(tool),
      },
      async (args) => {
        const result = await dispatchCommand(services, tool, args, principal);
        if (!result.ok) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ error: result.error, code: result.code, status: result.status }) }],
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data) }],
        };
      },
    );
  }

  return server;
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return undefined;
  return JSON.parse(raw);
}

function rewriteToolCallName(message: unknown): unknown {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return message;
  }
  const msg = message as { method?: unknown; params?: unknown };
  if (msg.method !== "tools/call" || !msg.params || typeof msg.params !== "object") {
    return message;
  }
  const params = msg.params as { name?: unknown };
  if (typeof params.name !== "string") {
    return message;
  }
  const command = commandFromMcpName(params.name);
  if (!command) {
    return message;
  }
  const canonical = mcpToolName(command);
  if (canonical === params.name) {
    return message;
  }
  return { ...message, params: { ...params, name: canonical } };
}

/** Accept historic dotted command names on tools/call without listing them. */
function rewriteMcpToolCallNames(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(rewriteToolCallName);
  }
  return rewriteToolCallName(body);
}

export async function handleMcpRequest(
  services: AppServices,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const header = String(req.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    sendJson(res, 401, { error: "invalid_token", error_description: "missing_token" }, {
      "WWW-Authenticate": wwwAuthenticate(services.config, "invalid_token"),
    });
    return;
  }

  let principal: AuthPrincipal;
  try {
    principal = await services.auth.verifyAccessToken(match[1]);
  } catch (error) {
    const authError = error instanceof AuthError ? error : new AuthError("invalid_token");
    sendJson(res, 401, { error: authError.code, error_description: authError.message }, {
      "WWW-Authenticate": wwwAuthenticate(services.config, authError.code),
    });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer(services, principal);
  await server.connect(transport);
  try {
    const body = req.method === "POST" ? rewriteMcpToolCallNames(await readJsonBody(req)) : undefined;
    await transport.handleRequest(req, res, body);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}
