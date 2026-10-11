import { eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { campaigns as campaignsTable } from "../db/schema.js";
import type { CommerceAdapter } from "./commerce.js";

const STORE_ID = "horizon-fit";

export type CampaignRow = {
  id: string;
  channel: "internal_promo" | "google_ads" | "meta_ads";
  objective: string;
  status: "observed" | "not_configured";
  name: string;
  orders: number;
  revenue: number | null;
  reason?: string;
};

export type AdsStatus = {
  configured: false;
  reason: "ads_adapter_not_configured";
  source: "google_ads" | "meta_ads";
};

export type CampaignsAdapter = {
  list: () => Promise<{
    configured: boolean;
    reason?: string;
    campaigns: CampaignRow[];
    ads: { google: AdsStatus; meta: AdsStatus };
  }>;
  ads: () => { google: AdsStatus; meta: AdsStatus };
  aggregate: () => Promise<{ configured: boolean; reason?: string; campaigns: number }>;
};

const ADS: AdsStatus = { configured: false, reason: "ads_adapter_not_configured", source: "google_ads" };
const META: AdsStatus = { configured: false, reason: "ads_adapter_not_configured", source: "meta_ads" };

export function createCampaignsAdapter(options: { commerce: CommerceAdapter; db?: HorizonDb }): CampaignsAdapter {
  const db = options.db;

  function persist(rows: CampaignRow[]) {
    if (!db) return;
    db.delete(campaignsTable).where(eq(campaignsTable.storeId, STORE_ID)).run();
    const now = Date.now();
    for (const row of rows) {
      db.insert(campaignsTable)
        .values({
          id: row.id,
          storeId: STORE_ID,
          channel: row.channel,
          objective: row.objective,
          status: row.status,
          name: row.name,
          orders: row.orders,
          revenue: row.revenue,
          reason: row.reason ?? null,
          updatedAt: now,
        })
        .run();
    }
  }

  return {
    ads() {
      return { google: ADS, meta: META };
    },
    async list() {
      const paid = await options.commerce.paidOrders();
      const ads = { google: ADS, meta: META };
      if (!paid.configured) {
        return { configured: false, reason: paid.reason ?? "missing_woo_rest_credentials", campaigns: [], ads };
      }
      const byCode = new Map<string, { orders: number; revenue: number }>();
      for (const order of paid.orders) {
        if (!order.coupon) continue;
        const current = byCode.get(order.coupon) ?? { orders: 0, revenue: 0 };
        current.orders += 1;
        current.revenue += order.revenue ?? 0;
        byCode.set(order.coupon, current);
      }
      const campaigns: CampaignRow[] = [...byCode.entries()].map(([name, row]) => ({
        id: `promo:${name}`,
        channel: "internal_promo",
        objective: "promo",
        status: "observed",
        name,
        orders: row.orders,
        revenue: row.orders ? row.revenue : null,
      }));
      campaigns.push(
        { id: "google_ads", channel: "google_ads", objective: "unknown", status: "not_configured", name: "Google Ads", orders: 0, revenue: null, reason: "ads_adapter_not_configured" },
        { id: "meta_ads", channel: "meta_ads", objective: "unknown", status: "not_configured", name: "Meta Ads", orders: 0, revenue: null, reason: "ads_adapter_not_configured" },
      );
      return { configured: true, reason: paid.reason, campaigns, ads };
    },
    async aggregate() {
      const listed = await this.list();
      persist(listed.campaigns);
      return { configured: listed.configured, reason: listed.reason, campaigns: listed.campaigns.length };
    },
  };
}
