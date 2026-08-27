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
import { denyList, listRegisteredTools } from "./tools.js";

export { denyList, listRegisteredTools };

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
    server.registerTool(
      tool,
      {
        title: tool,
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
  });
  const server = createMcpServer(services, principal);
  await server.connect(transport);
  const body = req.method === "POST" ? await readJsonBody(req) : undefined;
  await transport.handleRequest(req, res, body);
}
