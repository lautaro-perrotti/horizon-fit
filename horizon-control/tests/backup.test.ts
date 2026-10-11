import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { backupControl, pruneBackups, restoreSqlite } from "../src/observability/backup.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("backup and extended healthz", () => {
  it("backs up a file sqlite and restores the same row", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-bak-"));
    const source = path.join(dir, "src.sqlite");
    const destDir = path.join(dir, "out");
    const db = new Database(source);
    db.exec("CREATE TABLE probe (id TEXT PRIMARY KEY, n INTEGER)");
    db.prepare("INSERT INTO probe VALUES (?, ?)").run("row-1", 7);
    db.close();
    const result = await backupControl({ sqlitePath: source, destDir });
    expect(result.ok).toBe(true);
    expect(result.sqlite).toBeTruthy();
    const restored = path.join(dir, "restored.sqlite");
    restoreSqlite(result.sqlite!, restored);
    const copy = new Database(restored, { readonly: true });
    expect(copy.prepare("SELECT n FROM probe WHERE id=?").get("row-1")).toEqual({ n: 7 });
    copy.close();
  });

  it("prunes older sqlite backups and matching env copies", () => {
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-bak-prune-"));
    for (let i = 0; i < 10; i += 1) {
      const stamp = `2026-10-11T0${i}-00-00-000Z`;
      const sqlite = path.join(destDir, `horizon-control-${stamp}.sqlite`);
      const envFile = path.join(destDir, `horizon-control.env-${stamp}`);
      fs.writeFileSync(sqlite, "x");
      fs.writeFileSync(envFile, "y");
      const at = Date.now() - (10 - i) * 1000;
      fs.utimesSync(sqlite, at / 1000, at / 1000);
    }
    expect(pruneBackups(destDir, 3)).toBe(7);
    expect(fs.readdirSync(destDir).filter((name) => name.endsWith(".sqlite"))).toHaveLength(3);
    expect(fs.readdirSync(destDir).filter((name) => name.includes(".env-"))).toHaveLength(3);
  });

  it("refuses to backup :memory: and keeps healthz unauthenticated", async () => {
    expect((await backupControl({ sqlitePath: ":memory:", destDir: os.tmpdir() })).ok).toBe(false);
    const { app, keys } = await buildTestApp();
    const live = await request(app, "/healthz");
    expect(live.status).toBe(200);
    const body = await live.json();
    expect(body.ok).toBe(true);
    expect(body.integrations.woo).toBe(false);
    expect(body.integrations.ai).toBe(false);
    expect(body.gateway.configured).toBe(false);
    expect(body.mcp.path).toBe("/mcp");
    expect(live.headers.get("x-request-id")).toBeTruthy();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    expect((await request(app, "/v1/insights/overview", { token })).status).toBe(200);
  });
});
