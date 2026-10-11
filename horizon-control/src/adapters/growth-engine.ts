import type { ProductInsight } from "./insights.js";

export const GROWTH_WEIGHTS = {
  revenue_importance: 0.22,
  demand: 0.16,
  traffic: 0.16,
  conversion_gap: 0.18,
  stock_exposure: 0.1,
  merchant_exposure: 0.08,
  seo_opportunity: 0.05,
  competitive_pressure: 0.05,
} as const;

export type GrowthRuleId =
  | "HIGH_TRAFFIC_LOW_CONVERSION"
  | "HIGH_IMPRESSIONS_LOW_CTR"
  | "HIGH_IMPRESSIONS_LOW_CONVERSION"
  | "MERCHANT_BLOCKED_HIGH_VALUE"
  | "SEO_ISSUE_HIGH_DEMAND"
  | "LOW_STOCK_HIGH_DEMAND"
  | "HIGH_STOCK_LOW_VELOCITY"
  | "PRICE_OUTLIER";

export type GrowthDraft = {
  type: GrowthRuleId;
  parent_sku: string;
  product: string;
  metrics: Record<string, number | string | null>;
  evidence: string[];
  source: string;
  reason: string;
  recommended_action: string;
  period: string;
};

export type GrowthCohort = {
  viewsP75: number | null;
  cvrMedian: number | null;
  impressionsP75: number | null;
  ctrMedian: number | null;
  clicksP75: number | null;
  revenueMax: number | null;
  velocityP25: number | null;
};

export type ScoredOpportunity = GrowthDraft & {
  score: number;
  score_caption: string;
  components: Record<string, number>;
  weights_used: Record<string, number>;
  severity: "info" | "warning" | "critical";
};

const IMPRESSIONS_FLOOR = 200;
const VIEWS_FLOOR = 100;
const REVENUE_FLOOR = 20_000;
const CTR_ABS = 0.02;
const POSITION_MAX = 15;

export function available(slice: { available?: boolean; status?: string } | null | undefined): boolean {
  return Boolean(slice?.available);
}

export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function cohortFromInsights(insights: ProductInsight[]): GrowthCohort {
  const views = insights.map((row) => row.analytics.data?.pdp_views).filter((value): value is number => value != null);
  const cvrs = insights.map((row) => row.analytics.data?.cvr).filter((value): value is number => value != null);
  const impressions = insights.map((row) => row.search.data?.impressions).filter((value): value is number => value != null);
  const ctrs = insights.map((row) => row.search.data?.ctr).filter((value): value is number => value != null);
  const clicks = insights.map((row) => row.search.data?.clicks).filter((value): value is number => value != null);
  const revenues = insights.map((row) => row.sales.data?.revenue).filter((value): value is number => value != null);
  const velocities = insights.map((row) => row.sales.data?.velocity_30d).filter((value): value is number => value != null);
  return {
    viewsP75: percentile(views, 75),
    cvrMedian: median(cvrs),
    impressionsP75: percentile(impressions, 75),
    ctrMedian: median(ctrs),
    clicksP75: percentile(clicks, 75),
    revenueMax: revenues.length ? Math.max(...revenues) : null,
    velocityP25: percentile(velocities, 25),
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function scoreOpportunity(insight: ProductInsight, cohort: GrowthCohort): {
  score: number;
  score_caption: string;
  components: Record<string, number>;
  weights_used: Record<string, number>;
  severity: "info" | "warning" | "critical";
} {
  const components: Record<string, number> = {};
  const revenue = insight.sales.data?.revenue;
  if (available(insight.sales) && revenue != null && cohort.revenueMax && cohort.revenueMax > 0) {
    components.revenue_importance = clamp((Math.log1p(revenue) / Math.log1p(cohort.revenueMax)) * 100);
  }
  const impressions = insight.search.data?.impressions;
  if (available(insight.search) && impressions != null && cohort.impressionsP75 && cohort.impressionsP75 > 0) {
    components.demand = clamp((impressions / cohort.impressionsP75) * 75);
  }
  const views = insight.analytics.data?.pdp_views;
  if (available(insight.analytics) && views != null && cohort.viewsP75 && cohort.viewsP75 > 0) {
    components.traffic = clamp((views / cohort.viewsP75) * 75);
  }
  const cvr = insight.analytics.data?.cvr;
  if (available(insight.analytics) && cvr != null && cohort.cvrMedian && cohort.cvrMedian > 0) {
    components.conversion_gap = clamp(((cohort.cvrMedian - cvr) / cohort.cvrMedian) * 100);
  }
  if (available(insight.catalog) && insight.catalog.data?.stock_status === "outofstock" && (views ?? 0) + (insight.sales.data?.velocity_30d ?? 0) > 0) {
    components.stock_exposure = 80;
  }
  if (available(insight.merchant) && (insight.merchant.data?.blocked ?? 0) > 0) {
    components.merchant_exposure = clamp(40 + (components.revenue_importance ?? 0) * 0.4);
  }
  if (available(insight.seo) && (insight.seo.data?.critical ?? 0) + (insight.seo.data?.warning ?? 0) > 0 && (impressions ?? 0) > 0) {
    components.seo_opportunity = clamp(20 + Math.min(80, (impressions ?? 0) / 50));
  }
  const index = insight.competition.data?.price_index;
  if (available(insight.competition) && index && index.n >= 2 && index.index != null && (index.index < 0.8 || index.index > 1.2)) {
    components.competitive_pressure = clamp(Math.abs(index.index - 1) * 80);
  }

  const used = Object.keys(components) as Array<keyof typeof GROWTH_WEIGHTS>;
  const weightSum = used.reduce((sum, key) => sum + GROWTH_WEIGHTS[key], 0);
  const weights_used: Record<string, number> = {};
  let score = 0;
  for (const key of used) {
    const weight = weightSum > 0 ? GROWTH_WEIGHTS[key] / weightSum : 0;
    weights_used[key] = weight;
    score += weight * components[key];
  }
  const domains = used.length ? used.join("+") : "none";
  const score_caption = used.length
    ? `score uses ${domains}; missing components dropped and weights renormalized`
    : "score has no usable components";
  const severity =
    ((insight.merchant.data?.blocked ?? 0) > 0 && (components.revenue_importance ?? 0) >= 60) ||
    ((components.conversion_gap ?? 0) >= 70 && (components.traffic ?? 0) >= 60)
      ? "critical"
      : score >= 40
        ? "warning"
        : "info";
  return { score: Math.round(score * 10) / 10, score_caption, components, weights_used, severity };
}

export function evaluateRules(insight: ProductInsight, cohort: GrowthCohort = emptyCohort()): GrowthDraft[] {
  const sku = insight.keys.parent_sku;
  const name = insight.catalog.data?.name ?? sku;
  const out: GrowthDraft[] = [];
  const views = insight.analytics.data?.pdp_views;
  const cvr = insight.analytics.data?.cvr;
  const impressions = insight.search.data?.impressions;
  const clicks = insight.search.data?.clicks;
  const ctr = insight.search.data?.ctr;
  const position = insight.search.data?.position;
  const revenue = insight.sales.data?.revenue;
  const velocity = insight.sales.data?.velocity_30d;

  if (available(insight.analytics) && views != null && cvr != null && cohort.viewsP75 != null && cohort.cvrMedian != null) {
    if (views >= cohort.viewsP75 && cvr <= cohort.cvrMedian * 0.5) {
      out.push({
        type: "HIGH_TRAFFIC_LOW_CONVERSION",
        parent_sku: sku,
        product: name,
        metrics: { pdp_views: views, cvr, views_p75: cohort.viewsP75, cvr_median: cohort.cvrMedian },
        evidence: [`PDP views ${views} ≥ P75 ${cohort.viewsP75}`, `CVR ${cvr} ≤ 50% de mediana ${cohort.cvrMedian}`],
        source: "ga4",
        reason: "high_traffic_low_conversion",
        recommended_action: "Revisar PDP, precio y oferta",
        period: "28d",
      });
    }
  }

  if (available(insight.search) && impressions != null && ctr != null && position != null) {
    const ctrBar = cohort.ctrMedian ?? CTR_ABS;
    const impressionBar = Math.max(IMPRESSIONS_FLOOR, cohort.impressionsP75 ?? IMPRESSIONS_FLOOR);
    if (impressions >= impressionBar && ctr < ctrBar && position <= POSITION_MAX) {
      out.push({
        type: "HIGH_IMPRESSIONS_LOW_CTR",
        parent_sku: sku,
        product: name,
        metrics: { impressions, ctr, position, ctr_bar: ctrBar },
        evidence: [`Impresiones ${impressions} ≥ ${impressionBar}`, `CTR ${ctr} < ${ctrBar}`, `posición ${position} ≤ ${POSITION_MAX}`],
        source: "gsc",
        reason: "high_impressions_low_ctr",
        recommended_action: "Revisar title/snippet",
        period: "28d",
      });
    }
  }

  if (available(insight.search) && (impressions ?? 0) >= IMPRESSIONS_FLOOR && available(insight.analytics) && cvr != null && cohort.cvrMedian != null && cvr <= cohort.cvrMedian * 0.5) {
    out.push({
      type: "HIGH_IMPRESSIONS_LOW_CONVERSION",
      parent_sku: sku,
      product: name,
      metrics: { impressions: impressions ?? null, clicks: clicks ?? null, cvr, cvr_median: cohort.cvrMedian },
      evidence: [`Demanda GSC alta`, `CVR ${cvr} ≤ 50% de mediana`],
      source: "gsc+ga4",
      reason: "high_impressions_low_conversion",
      recommended_action: "Revisar PDP / match de intención",
      period: "28d",
    });
  }

  if (available(insight.merchant) && (insight.merchant.data?.blocked ?? 0) > 0 && ((available(insight.sales) && (revenue ?? 0) >= REVENUE_FLOOR) || (available(insight.analytics) && (views ?? 0) >= VIEWS_FLOOR))) {
    out.push({
      type: "MERCHANT_BLOCKED_HIGH_VALUE",
      parent_sku: sku,
      product: name,
      metrics: { blocked: insight.merchant.data?.blocked ?? 0, revenue: revenue ?? null, pdp_views: views ?? null },
      evidence: [`${insight.merchant.data?.blocked} variantes blocked`, revenue != null ? `revenue 30d ${revenue}` : `views ${views}`],
      source: "merchant_feed",
      reason: "merchant_blocked_high_value",
      recommended_action: "Revisar feed / GMC",
      period: "30d",
    });
  }

  if (available(insight.seo) && (insight.seo.data?.critical ?? 0) + (insight.seo.data?.warning ?? 0) > 0 && available(insight.search) && (impressions ?? 0) >= IMPRESSIONS_FLOOR) {
    out.push({
      type: "SEO_ISSUE_HIGH_DEMAND",
      parent_sku: sku,
      product: name,
      metrics: { critical: insight.seo.data?.critical ?? 0, warning: insight.seo.data?.warning ?? 0, impressions: impressions ?? null },
      evidence: [`SEO issues en página con ${impressions} impresiones`],
      source: "seo_audit+gsc",
      reason: "seo_issue_high_demand",
      recommended_action: "Corregir on-page",
      period: "28d",
    });
  }

  if (available(insight.catalog) && insight.catalog.data?.stock_status === "outofstock" && ((available(insight.sales) && (velocity ?? 0) > 0) || (available(insight.analytics) && (views ?? 0) >= VIEWS_FLOOR))) {
    out.push({
      type: "LOW_STOCK_HIGH_DEMAND",
      parent_sku: sku,
      product: name,
      metrics: { stock_status: "outofstock", velocity_30d: velocity ?? null, pdp_views: views ?? null },
      evidence: ["SKU outofstock con demanda observada"],
      source: "woo_store_api",
      reason: "low_stock_high_demand",
      recommended_action: "Reponer stock",
      period: "30d",
    });
  }

  if (
    available(insight.catalog) &&
    insight.catalog.data?.stock_status === "instock" &&
    available(insight.sales) &&
    velocity != null &&
    cohort.velocityP25 != null &&
    velocity < cohort.velocityP25
  ) {
    out.push({
      type: "HIGH_STOCK_LOW_VELOCITY",
      parent_sku: sku,
      product: name,
      metrics: { velocity_30d: velocity, velocity_p25: cohort.velocityP25, variants: insight.catalog.data.variants.length },
      evidence: [`Velocity ${velocity} ≤ P25 ${cohort.velocityP25} con stock`],
      source: "woo_rest_orders",
      reason: "high_stock_low_velocity",
      recommended_action: "Revisar merchandising",
      period: "30d",
    });
  }

  const peers = insight.competition.data?.peers ?? [];
  const index = insight.competition.data?.price_index;
  if (available(insight.catalog) && available(insight.competition) && index && index.n >= 2 && index.horizon != null && index.median != null) {
    if (index.index != null && (index.index < 0.7 || index.index > 1.3)) {
      out.push({
        type: "PRICE_OUTLIER",
        parent_sku: sku,
        product: name,
        metrics: { horizon: index.horizon, median: index.median, index: index.index, n: index.n, peers: peers.length },
        evidence: [`Precio Horizon ${index.horizon} vs mediana de segmento ${index.median} (n=${index.n})`],
        source: "competitors",
        reason: "price_outlier",
        recommended_action: "Hecho solamente — no se recomienda bajar el precio",
        period: "snapshot",
      });
    }
  }

  return out;
}

export function emptyCohort(): GrowthCohort {
  return {
    viewsP75: null,
    cvrMedian: null,
    impressionsP75: null,
    ctrMedian: null,
    clicksP75: null,
    revenueMax: null,
    velocityP25: null,
  };
}

export function scoreDrafts(insight: ProductInsight, drafts: GrowthDraft[], cohort: GrowthCohort): ScoredOpportunity[] {
  const scored = scoreOpportunity(insight, cohort);
  return drafts.map((draft) => ({ ...draft, ...scored }));
}
