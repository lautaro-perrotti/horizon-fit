// Local dashboard preview: serves /app with fixtures, no Auth0, no worker, no outbound jobs.
// npm run dashboard:dev  →  http://127.0.0.1:8797/app/  (?scenario=cold | errors)
import { loadConfig } from "../src/config.js";
import { createServices } from "../src/create-services.js";
import { createHorizonHttpServer } from "../src/server.js";

if (process.env.NODE_ENV === "production") {
  console.error("dashboard:dev is for local preview only; refusing to run with NODE_ENV=production.");
  process.exit(1);
}

const port = Number(process.env.HORIZON_DASHBOARD_DEV_PORT || 8797);
const config = loadConfig({
  HORIZON_BIND: "127.0.0.1",
  HORIZON_PORT: String(port),
  HORIZON_PUBLIC_URL: `http://127.0.0.1:${port}`,
  HORIZON_SQLITE_PATH: ":memory:",
  HORIZON_DATA_DIR: "",
  HORIZON_DASHBOARD_FIXTURES: "1",
  HORIZON_WOO_KEY: "",
  HORIZON_WOO_SECRET: "",
  HORIZON_GOOGLE_SA_PATH: "",
  HORIZON_GOOGLE_SA_JSON: "",
  HORIZON_COMPETITOR_URLS: "",
});
const services = createServices({ config, startWorker: false });
const server = createHorizonHttpServer(services);
server.listen(port, "127.0.0.1", () => {
  console.log(`dashboard preview with fixtures: http://127.0.0.1:${port}/app/`);
  console.log("scenarios: ?scenario=hoy (default) · cold · errors");
});

function stop() {
  server.close();
  services.stopBackground();
  services.closeDb();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
