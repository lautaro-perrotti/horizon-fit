#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const baseArg = args.find((arg) => !arg.startsWith('-')) || 'https://horizonfit.com.ar';
const strict = args.includes('--strict');
const all = args.includes('--all') || !args.some((arg) => arg.startsWith('--limit='));
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 25) : Infinity;

const base = new URL(baseArg);
base.pathname = '/';
base.search = '';
base.hash = '';
const baseOrigin = base.origin;

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const reportDir = path.join(process.cwd(), 'reports', 'seo-audit');
const reportPath = path.join(reportDir, `seo-audit-${stamp}.json`);

const USER_AGENT = 'HorizonFitSEOAudit/1.0 (+https://horizonfit.com.ar)';
const CRITICAL = 'critical';
const WARNING = 'warning';

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttr(tag, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const match = tag.match(re);
  return match ? decodeHtml(match[1]) : '';
}

function normalizeUrlForCompare(url) {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString();
}

function severityBucket() {
  return { critical: [], warning: [] };
}

function addIssue(page, severity, message, evidence = undefined) {
  page.issues[severity].push(evidence ? { message, evidence } : { message });
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      redirect: options.redirect || 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml,text/plain,*/*' },
      signal: controller.signal,
    });
    const text = options.noBody ? '' : await response.text();
    return { url, status: response.status, headers: Object.fromEntries(response.headers.entries()), text };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSitemap(xml) {
  const urls = [];
  const locRe = /<loc>([\s\S]*?)<\/loc>/gi;
  let match;
  while ((match = locRe.exec(xml))) {
    const loc = decodeHtml(match[1]);
    if (loc) urls.push(loc);
  }
  return [...new Set(urls)];
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const raw = decodeHtml(match[1]);
    try {
      blocks.push(JSON.parse(raw));
    } catch (error) {
      blocks.push({ __parseError: error.message, __rawStart: raw.slice(0, 160) });
    }
  }
  return blocks;
}

function flattenSchema(node, out = [], seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);

  if (Array.isArray(node)) {
    node.forEach((item) => flattenSchema(item, out, seen));
    return out;
  }

  out.push(node);
  Object.values(node).forEach((value) => {
    if (value && typeof value === 'object') flattenSchema(value, out, seen);
  });
  return out;
}

function schemaTypes(jsonLd) {
  return flattenSchema(jsonLd).flatMap((node) => {
    const type = node['@type'];
    if (!type) return [];
    return Array.isArray(type) ? type : [type];
  });
}

function firstMeta(html, key, value) {
  const re = new RegExp(`<meta\\b(?=[^>]*(?:${key})=["']${value}["'])[^>]*>`, 'i');
  const tag = html.match(re)?.[0] || '';
  return tag ? getAttr(tag, 'content') : '';
}

function firstCanonical(html) {
  const tag = html.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/i)?.[0] || '';
  return tag ? getAttr(tag, 'href') : '';
}

function auditHtml(url, html, status) {
  const page = {
    url,
    status,
    title: '',
    description: '',
    canonical: '',
    h1: [],
    images: 0,
    imagesWithoutAlt: 0,
    schemaTypes: [],
    issues: severityBucket(),
  };

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  page.title = titleMatch ? stripTags(titleMatch[1]) : '';
  page.description = firstMeta(html, 'name', 'description') || firstMeta(html, 'id', 'hfMetaDescription');
  page.canonical = firstCanonical(html);

  const h1Re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let h1Match;
  while ((h1Match = h1Re.exec(html))) page.h1.push(stripTags(h1Match[1]));

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  page.images = imgTags.length;
  page.imagesWithoutAlt = imgTags.filter((tag) => !getAttr(tag, 'alt')).length;

  const jsonLd = extractJsonLd(html);
  page.schemaTypes = [...new Set(schemaTypes(jsonLd))];

  const parsedUrl = new URL(url);
  const isHome = parsedUrl.pathname === '/';
  const isProduct = parsedUrl.pathname.startsWith('/producto/');
  const isCollection = parsedUrl.pathname.startsWith('/coleccion/');

  if (status < 200 || status >= 300) addIssue(page, CRITICAL, 'La URL del sitemap no responde 2xx.', String(status));
  if (!page.title) addIssue(page, CRITICAL, 'Falta <title>.');
  if (page.title && (page.title.length < 20 || page.title.length > 65)) addIssue(page, WARNING, 'El title podría estar fuera del rango ideal 20–65 caracteres.', `${page.title.length} caracteres`);
  if (!page.description) addIssue(page, CRITICAL, 'Falta meta description.');
  if (page.description && (page.description.length < 90 || page.description.length > 165)) addIssue(page, WARNING, 'La meta description podría estar fuera del rango ideal 90–165 caracteres.', `${page.description.length} caracteres`);
  if (!page.canonical) {
    addIssue(page, CRITICAL, 'Falta canonical.');
  } else {
    try {
      const canonicalUrl = new URL(page.canonical, baseOrigin);
      if (canonicalUrl.hostname === 'api.horizonfit.com.ar') addIssue(page, CRITICAL, 'Canonical apunta a la API, no al storefront.', page.canonical);
      if (canonicalUrl.hostname.startsWith('www.')) addIssue(page, WARNING, 'Canonical apunta a www; conviene consolidar sin www.', page.canonical);
      if (page.canonical.includes('%23') || page.canonical.includes('/#')) addIssue(page, CRITICAL, 'Canonical contiene hash codificado o fragmento inválido.', page.canonical);
      if (normalizeUrlForCompare(canonicalUrl.href) !== normalizeUrlForCompare(url)) addIssue(page, WARNING, 'Canonical no coincide exactamente con la URL del sitemap.', page.canonical);
    } catch {
      addIssue(page, CRITICAL, 'Canonical inválido.', page.canonical);
    }
  }

  const robots = firstMeta(html, 'name', 'robots');
  if (/noindex/i.test(robots)) addIssue(page, CRITICAL, 'Una URL del sitemap está marcada como noindex.', robots);

  if (page.h1.length === 0) addIssue(page, CRITICAL, 'El HTML inicial no tiene H1.');
  if (page.h1.length > 1) addIssue(page, WARNING, 'Hay más de un H1 en el HTML inicial.', page.h1.join(' | '));
  if (page.h1.some((h1) => /\(copia\s*\d*\)/i.test(h1))) addIssue(page, CRITICAL, 'El H1 contiene “copia”.', page.h1.join(' | '));

  if ((isHome || isProduct || isCollection) && page.images === 0) addIssue(page, CRITICAL, 'El HTML inicial no incluye imágenes renderizadas.');
  if (page.imagesWithoutAlt > 0) addIssue(page, WARNING, 'Hay imágenes sin alt en el HTML inicial.', `${page.imagesWithoutAlt}/${page.images}`);

  const hasProductSchema = page.schemaTypes.includes('Product') || page.schemaTypes.includes('ProductGroup');
  if (isProduct && !hasProductSchema) addIssue(page, CRITICAL, 'Producto sin schema Product/ProductGroup.');
  if (isCollection && !page.schemaTypes.includes('ItemList')) addIssue(page, WARNING, 'Colección sin schema ItemList.');

  return page;
}

async function run() {
  const sitemapUrl = `${baseOrigin}/sitemap.xml`;
  const robotsUrl = `${baseOrigin}/robots.txt`;

  const checks = [];
  const sitemap = await fetchText(sitemapUrl);
  if (sitemap.status !== 200) {
    throw new Error(`No pude obtener sitemap.xml: HTTP ${sitemap.status}`);
  }

  const urls = parseSitemap(sitemap.text).filter((url) => url.startsWith(baseOrigin));
  const selectedUrls = all ? urls.slice(0, limit) : urls.slice(0, limit);

  const robots = await fetchText(robotsUrl).catch((error) => ({ status: 0, text: '', error: error.message }));
  const siteChecks = severityBucket();
  if (robots.status !== 200) siteChecks.warning.push({ message: 'robots.txt no respondió 200.', evidence: String(robots.status) });
  if (robots.text && !new RegExp(`Sitemap:\\s*${sitemapUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(robots.text)) {
    siteChecks.warning.push({ message: 'robots.txt no declara el sitemap principal.', evidence: sitemapUrl });
  }

  const wwwUrl = baseOrigin.replace('://', '://www.');
  const wwwCheck = await fetchText(`${wwwUrl}/`, { redirect: 'manual', noBody: true }).catch((error) => ({ status: 0, headers: {}, error: error.message }));
  const wwwLocation = wwwCheck.headers?.location || '';
  if (![301, 308].includes(wwwCheck.status) || !wwwLocation.startsWith(baseOrigin)) {
    siteChecks.warning.push({
      message: 'www debería redirigir 301/308 al dominio canónico sin www.',
      evidence: `HTTP ${wwwCheck.status} ${wwwLocation}`,
    });
  }

  for (const url of selectedUrls) {
    try {
      const response = await fetchText(url);
      checks.push(auditHtml(url, response.text, response.status));
      process.stdout.write('.');
    } catch (error) {
      checks.push({
        url,
        status: 0,
        title: '',
        description: '',
        canonical: '',
        h1: [],
        images: 0,
        imagesWithoutAlt: 0,
        schemaTypes: [],
        issues: { critical: [{ message: 'No se pudo auditar la URL.', evidence: error.message }], warning: [] },
      });
      process.stdout.write('!');
    }
  }
  process.stdout.write('\n');

  const titleMap = new Map();
  const descriptionMap = new Map();
  for (const page of checks) {
    if (page.title) titleMap.set(page.title, [...(titleMap.get(page.title) || []), page.url]);
    if (page.description) descriptionMap.set(page.description, [...(descriptionMap.get(page.description) || []), page.url]);
  }

  for (const page of checks) {
    if (page.title && (titleMap.get(page.title) || []).length > 1) addIssue(page, WARNING, 'Title duplicado.', titleMap.get(page.title).join(' | '));
    if (page.description && (descriptionMap.get(page.description) || []).length > 1) addIssue(page, WARNING, 'Meta description duplicada.', descriptionMap.get(page.description).join(' | '));
  }

  const totals = checks.reduce(
    (acc, page) => {
      acc.critical += page.issues.critical.length;
      acc.warning += page.issues.warning.length;
      return acc;
    },
    { critical: siteChecks.critical.length, warning: siteChecks.warning.length },
  );

  const report = {
    generatedAt: now.toISOString(),
    baseUrl: baseOrigin,
    sitemapUrl,
    urlCount: urls.length,
    auditedCount: checks.length,
    strict,
    totals,
    siteChecks,
    pages: checks,
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`SEO audit: ${checks.length}/${urls.length} URLs`);
  console.log(`Críticos: ${totals.critical} | Warnings: ${totals.warning}`);
  console.log(`Reporte: ${reportPath}`);

  const problematic = checks
    .filter((page) => page.issues.critical.length || page.issues.warning.length)
    .slice(0, 12);

  for (const page of problematic) {
    console.log(`\n${page.url}`);
    for (const issue of page.issues.critical) console.log(`  ERROR: ${issue.message}${issue.evidence ? ` (${issue.evidence})` : ''}`);
    for (const issue of page.issues.warning.slice(0, 4)) console.log(`  WARN: ${issue.message}${issue.evidence ? ` (${issue.evidence})` : ''}`);
  }

  if (totals.critical > 0 || (strict && totals.warning > 0)) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
