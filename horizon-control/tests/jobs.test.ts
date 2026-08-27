import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("jobs", () => {
  it("seo.audit and tests.run persist queued/running/succeeded with timeout and attempts", async () => {
    const { app, keys, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    const created = await request(app, "/v1/seo/audit", { method: "POST", token, body: {} });
    expect(created.status).toBe(200);
    const job = await created.json();
    expect(job.status).toBe("queued");
    expect(job.timeoutMs).toBeGreaterThan(0);
    expect(job.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(job.args.target).toBe("https://horizonfit.com.ar");

    await services.worker.tick();
    const stored = await request(app, `/v1/jobs/${job.id}`, { token });
    expect(stored.status).toBe(200);
    const body = await stored.json();
    expect(body.status).toBe("succeeded");
    expect(body.startedAt).toBeTruthy();
    expect(body.finishedAt).toBeTruthy();
    expect(body.result).toMatchObject({ mocked: true, exitCode: 0 });
  });

  it("sanitizes failed job errors and can cancel", async () => {
    const { services } = await buildTestApp({
      runner: async () => {
        throw new Error("Bearer super-secret-token boom");
      },
    });
    const job = await services.jobs.enqueue({
      type: "tests.run",
      args: { suites: ["search-merchant-tests.php"] },
      actor: "admin",
      clientId: "admin",
    });
    await services.worker.tick();
    const failed = await services.jobs.get(job.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.error).not.toMatch(/super-secret-token/);
    expect(failed?.error).toMatch(/\[REDACTED\]/);

    const queued = await services.jobs.enqueue({
      type: "seo.audit",
      args: { target: "https://horizonfit.com.ar" },
      actor: "admin",
      clientId: "admin",
    });
    await services.jobs.cancel(queued.id);
    expect((await services.jobs.get(queued.id))?.status).toBe("cancelled");
  });
});
