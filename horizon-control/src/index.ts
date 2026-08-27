import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import { createServices } from "./create-services.js";
import { createHttpApp } from "./api/app.js";
import { handleMcpRequest } from "./mcp/index.js";

const services = createServices({ startWorker: true });
const app = createHttpApp(services);
const honoListener = getRequestListener(app.fetch);

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/mcp" || url.startsWith("/mcp?")) {
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

const bind = services.config.HORIZON_BIND;
const port = services.config.HORIZON_PORT;

server.listen(port, bind, () => {
  console.log(`horizon-control listening on http://${bind}:${port} (Tailscale-only MVP; not for public nginx)`);
  console.log(`  /v1  HTTP commands`);
  console.log(`  /mcp Streamable HTTP MCP (Resource Server)`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    services.worker.stop();
    server.close(() => process.exit(0));
  });
}

