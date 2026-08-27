import fs from "node:fs/promises";
import path from "node:path";
import { extraAllowedHosts, allowlistedFetch } from "../http/allowlist.js";

export type ConfigPiece<T> = {
  status: "ok" | "unavailable";
  data: T | null;
  source: string | null;
};

export type StorefrontConfig = {
  menu: ConfigPiece<unknown>;
  home_sections: ConfigPiece<unknown>;
  hero: ConfigPiece<unknown>;
  marquee: ConfigPiece<unknown>;
};

export type StorefrontAdapter = {
  getConfig: () => Promise<StorefrontConfig>;
};

async function readLocalJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readHttpJson(
  url: string,
  extraHosts: string[],
  fetchImpl: typeof fetch,
): Promise<unknown | null> {
  try {
    const response = await allowlistedFetch(url, extraHosts, { timeoutMs: 8000 }, fetchImpl);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function piece<T>(data: T | null, source: string | null): ConfigPiece<T> {
  if (data === null) return { status: "unavailable", data: null, source: null };
  return { status: "ok", data, source };
}

function extractSection(sections: unknown, type: string): unknown | null {
  const list = Array.isArray(sections)
    ? sections
    : sections && typeof sections === "object" && Array.isArray((sections as { sections?: unknown }).sections)
      ? (sections as { sections: unknown[] }).sections
      : null;
  if (!list) return null;
  const found = list.find((entry) => entry && typeof entry === "object" && (entry as { type?: string }).type === type);
  return found ?? null;
}

export function createStorefrontAdapter(options: {
  cacheDir: string;
  apiBaseUrl: string;
  extraHosts?: string[];
  fetchImpl?: typeof fetch;
}): StorefrontAdapter {
  const extraHosts = options.extraHosts ?? extraAllowedHosts([options.apiBaseUrl]);
  const fetchImpl = options.fetchImpl ?? fetch;
  const api = options.apiBaseUrl.replace(/\/$/, "");
  const cacheRoot = api ? `${api}/wp-content/uploads/horizon-fit-cache` : "";

  return {
    async getConfig() {
      const menuLocal = options.cacheDir ? await readLocalJson(path.join(options.cacheDir, "menu.json")) : null;
      const sectionsLocal = options.cacheDir
        ? (await readLocalJson(path.join(options.cacheDir, "home-sections.json"))) ??
          (await readLocalJson(path.join(options.cacheDir, "home-layout.json")))
        : null;

      const menu =
        menuLocal ??
        (cacheRoot ? await readHttpJson(`${cacheRoot}/menu.json`, extraHosts, fetchImpl) : null);
      const homeSections =
        sectionsLocal ??
        (cacheRoot ? await readHttpJson(`${cacheRoot}/home-sections.json`, extraHosts, fetchImpl) : null) ??
        (cacheRoot ? await readHttpJson(`${cacheRoot}/home-layout.json`, extraHosts, fetchImpl) : null) ??
        (api ? await readHttpJson(`${api}/wp-json/wp/v2/pages/home/sections`, extraHosts, fetchImpl) : null);

      const heroRest = api ? await readHttpJson(`${api}/wp-json/wp/v2/settings/hero`, extraHosts, fetchImpl) : null;
      const marqueeRest = api ? await readHttpJson(`${api}/wp-json/wp/v2/settings/marquee`, extraHosts, fetchImpl) : null;
      const hero = heroRest ?? extractSection(homeSections, "hero");
      const marquee = marqueeRest ?? extractSection(homeSections, "marquee");

      return {
        menu: piece(menu, menuLocal ? path.join(options.cacheDir, "menu.json") : cacheRoot ? `${cacheRoot}/menu.json` : null),
        home_sections: piece(
          homeSections,
          sectionsLocal ? options.cacheDir : cacheRoot ? `${cacheRoot}/home-sections.json` : null,
        ),
        hero: piece(hero, heroRest ? `${api}/wp-json/wp/v2/settings/hero` : homeSections ? "home_sections.hero" : null),
        marquee: piece(
          marquee,
          marqueeRest ? `${api}/wp-json/wp/v2/settings/marquee` : homeSections ? "home_sections.marquee" : null,
        ),
      };
    },
  };
}
