import { getRequestListener } from "@hono/node-server";
import { createServer, type Server } from "node:http";
import type { AppServices } from "./app-context.js";
import { createHttpApp } from "./api/app.js";
import { handleMcpRequest } from "./mcp/index.js";

export function createHorizonHttpServer(services: AppServices): Server {
  const app = createHttpApp(services);
  const honoListener = getRequestListener(app.fetch);

  return createServer((req, res) => {
    const pathOnly = (req.url ?? "/").split("?")[0];
    if (pathOnly === "/mcp") {
      void handleMcpRequest(services, req, res).catch((error) => {
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: "server_error", error_description: String(error) }));
        }
      });
      return;
    }
    honoListener(req, res);
  });
}
