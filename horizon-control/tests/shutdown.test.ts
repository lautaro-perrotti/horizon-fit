import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { createShutdownController } from "../src/net/shutdown.js";

describe("graceful shutdown", () => {
  it("stops worker and evaluate timer, closes HTTP, closes SQLite, exits 0 once", async () => {
    const server = createServer((_req, res) => {
      res.end("ok");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const calls: string[] = [];
    let code: number | null = null;
    const { shutdown, closing } = createShutdownController({
      server,
      stopWorker: () => calls.push("worker"),
      stopBackground: () => calls.push("bg"),
      closeDb: () => calls.push("db"),
      drainMs: 80,
      forceMs: 2_000,
      exit: (value) => {
        code = value;
      },
      log: () => undefined,
    });
    await shutdown("SIGTERM");
    expect(calls).toEqual(["worker", "bg", "db"]);
    expect(code).toBe(0);
    expect(closing()).toBe(true);
    await shutdown("SIGTERM");
    expect(calls).toEqual(["worker", "bg", "db"]);
  });
});
