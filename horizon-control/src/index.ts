import { createServices } from "./create-services.js";
import { createHorizonHttpServer } from "./server.js";
import { assertAllowedBind } from "./net/bind.js";

const services = createServices({ startWorker: true });
const bind = services.config.HORIZON_BIND;
const port = services.config.HORIZON_PORT;
assertAllowedBind(bind);

const server = createHorizonHttpServer(services);

server.listen(port, bind, () => {
  console.log(`horizon-control listening on http://${bind}:${port} (Tailscale-only MVP; not for public nginx)`);
  console.log(`  /healthz  liveness (no auth)`);
  console.log(`  /v1       HTTP commands (Bearer JWT)`);
  console.log(`  /mcp      Streamable HTTP MCP (Resource Server)`);
  console.log(`  /app      dashboard SPA (Tailscale; Auth0 PKCE)`);
  console.log(`  sqlite    ${services.config.sqlitePath}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    services.worker.stop();
    server.close(() => process.exit(0));
  });
}
