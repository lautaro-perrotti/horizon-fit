import { describe, expect, it } from "vitest";
import { errorSlice, notConfiguredSlice, notJoinedSlice, okSlice, unknownSlice, withStaleness, zeroSlice } from "../src/core/slice.js";

describe("SourceSlice status contract", () => {
  it("keeps a real zero distinct from unknown, not configured, error, and not joined", () => {
    const zero = zeroSlice("woo_rest_orders", { units: 0 });
    expect(zero.status).toBe("zero");
    expect(zero.available).toBe(true);
    expect(zero.data).toEqual({ units: 0 });
    expect(notConfiguredSlice("ga4", "missing_google_credentials").status).toBe("not_configured");
    expect(unknownSlice("gsc", "missing_canonical_url").status).toBe("unknown");
    expect(errorSlice("ga4", "ga4_http_403").status).toBe("error");
    expect(notJoinedSlice("seo_audit").status).toBe("not_joined");
    expect(okSlice("woo_store_api", { name: "Top" }).available).toBe(true);
  });

  it("relabels an old ok slice as stale without dropping data", () => {
    const fresh = okSlice("gsc", { clicks: 10 }, { fetched_at: new Date(Date.now() - 1000).toISOString(), stale_after_ms: 60_000 });
    expect(withStaleness(fresh).status).toBe("ok");
    const old = okSlice("gsc", { clicks: 10 }, { fetched_at: new Date(Date.now() - 3_600_000).toISOString(), stale_after_ms: 60_000 });
    const stale = withStaleness(old);
    expect(stale.status).toBe("stale");
    expect(stale.data).toEqual({ clicks: 10 });
  });
});
