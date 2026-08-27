import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("public nginx / compose must not expose Horizon Control", () => {
  it("shop nginx does not publish /mcp or /v1 for the control plane", () => {
    const conf = readFileSync(path.join(repoRoot, "docker/nginx/horizon-fit.conf"), "utf8");
    expect(conf).not.toMatch(/horizon-control/);
    expect(conf).not.toMatch(/:8787/);
    expect(conf).not.toMatch(/location\s+\/mcp/);
    expect(conf).not.toMatch(/location\s+\/v1/);
    expect(conf).toMatch(/server_name horizonfit.com.ar/);
    expect(conf).toMatch(/server_name api.horizonfit.com.ar/);
  });

  it("shop docker-compose.yml does not start horizon-control", () => {
    const compose = readFileSync(path.join(repoRoot, "docker-compose.yml"), "utf8");
    expect(compose).not.toMatch(/horizon-control/);
    expect(compose).not.toMatch(/HORIZON_BIND/);
    expect(compose).not.toMatch(/:8787/);
  });

  it("systemd unit is bind-safe and uses a 0600 EnvironmentFile", () => {
    const unit = readFileSync(path.join(repoRoot, "ops/systemd/horizon-control.service"), "utf8");
    expect(unit).toMatch(/EnvironmentFile=\/etc\/horizon-control\.env/);
    expect(unit).toMatch(/StandardOutput=journal/);
    expect(unit).toMatch(/Restart=on-failure/);
    expect(unit).toMatch(/HORIZON_BIND=127\.0\.0\.1/);
    expect(unit).toMatch(/HORIZON_DATA_DIR=\/var\/lib\/horizon-control/);
    expect(unit).not.toMatch(/0\.0\.0\.0/);
    expect(unit).toMatch(/do not enable or install/i);
  });
});
