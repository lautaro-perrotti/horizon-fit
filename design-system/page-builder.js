const PAGE_BUILDER = (() => {
  const textCache = new Map();
  const jsonCache = new Map();

  function rootUrl(url) {
    if (/^(https?:)?\/\//.test(url) || url.startsWith('/')) return url;
    return '/' + url.replace(/^\.?\//, '');
  }

  async function fetchText(url) {
    url = rootUrl(url);
    if (textCache.has(url)) return textCache.get(url);
    const promise = fetch(url, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`Fetch failed: ${url} ${r.status}`);
      return r.text();
    });
    textCache.set(url, promise);
    return promise;
  }

  async function fetchJson(url) {
    url = rootUrl(url);
    if (jsonCache.has(url)) return jsonCache.get(url);
    const promise = fetch(url, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`Fetch failed: ${url} ${r.status}`);
      return r.json();
    });
    jsonCache.set(url, promise);
    return promise;
  }

  // WordPress se sirve en el MISMO host que el SPA pero en el puerto 8089.
  // Derivamos la base dinÃ¡micamente del host actual: funciona en local
  // (localhost:8088 -> localhost:8089) y en la VPS (IP:8088 -> IP:8089)
  // sin hardcodear nada ni depender de archivos estÃ¡ticos.
  const WP_PORT = '8089';
  const WP_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${WP_PORT}`;
  const WOO_STORE_API_BASE = `${WP_BASE_URL}/wp-json/wc/store/v1`;
  const HF_REST_BASE = `${WP_BASE_URL}/wp-json/hf/v1`;
  const STORE_CHECKOUT_URL = `${window.location.origin}/checkout/`;
  const STORE_ACCOUNT_URL = `${window.location.origin}/mi-cuenta/`;
  const CART_TOKEN_STORAGE_KEY = 'hf-woo-cart-token';
  // Cache estÃ¡tica de settings de secciones (rÃ¡pida). Fallback al REST.
  const WP_SECTIONS_CACHE_URL = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/home-sections.json`;
  const WP_SECTIONS_URL = `${WP_BASE_URL}/wp-json/wp/v2/pages/home/sections`;

  // Productos: cache estÃ¡tica de WordPress como fuente primaria (instantÃ¡nea,
  // ~15ms, sin queries en runtime). Host dinÃ¡mico, URLs correctas por entorno.
  // CORS se resuelve activando mod_headers en Apache (config del contenedor).
  // Fallback al REST solo si el archivo no estuviera disponible.
  const PRODUCT_DATA_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-products.json`;
  const PRODUCT_DATA_FALLBACK_SRC = `${WP_BASE_URL}/wp-json/wp/v2/pages/home/products`;
  const PRODUCT_DETAIL_COMPONENT = '/design-system/components/sections/product-detail.html';
  const ACCOUNT_COMPONENT = '/design-system/components/sections/account.html';
  const CHECKOUT_COMPONENT = '/design-system/components/sections/checkout.html';
  const LOST_PASSWORD_COMPONENT = '/design-system/components/sections/lost-password.html';
  const INFO_PAGE_COMPONENT = '/design-system/components/sections/info-page.html';

  // Cache de una colecciÃ³n concreta (featured-row-1, featured-row-2, ...).
  const productCollectionSrc = (slug) =>
    `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-products-${slug}.json`;

  // Cache de "Conjuntos destacados": colecciones marcadas "Mostrar en home".
  const FEATURED_SETS_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-sets.json`;

  // Cache de "Compra por categorÃ­a": categorÃ­as marcadas "Mostrar en home".
  const FEATURED_CATEGORIES_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-categories.json`;

  // Cache del menÃº de la navbar: items de menÃº + categorÃ­as "Mostrar en menÃº".
  const MENU_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/menu.json`;
  // Páginas del footer (Envíos, Cambios, etc.): título + contenido HTML editable
  // desde el panel. El page-builder lo lee para rellenar el cuerpo de cada página.
  const INFO_PAGES_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/info-pages.json`;
  const GLOBAL_SECTION_TYPES = new Set(['marquee', 'navbar', 'footer', 'whatsapp-float']);
  const SECTION_SLOT = {
    BEFORE_ROOT: 'before-root',
    ROOT: 'root',
    AFTER_ROOT: 'after-root'
  };
  const WHATSAPP_DEFAULT_HREF = 'https://wa.me/5491100000000';
  const WHATSAPP_DEFAULT_LABEL = 'Escribinos por WhatsApp';

  // Resuelve una URL de media de WordPress. Acepta absolutas (http...) o
  // relativas ("/assets/..", "assets/..") y las deja servibles desde el SPA.
  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return rootUrl(url);
  };

  const SITE_NAME = 'Horizon Fit';
  const HOME_SEO_TITLE = `${SITE_NAME} | Ropa deportiva y conjuntos`;
  const HOME_SEO_DESCRIPTION = 'Activewear funcional, conjuntos pensados para combinar y una experiencia de compra clara, rápida y móvil.';
  const DEFAULT_SOCIAL_IMAGE = resolveMediaUrl('assets/hero-poster-desktop.jpg');
  const INFO_PAGES = {
    '/envios-y-entregas': {
      title: 'Envíos y entregas',
      description: 'Información de envíos y entregas de Horizon Fit.'
    },
    '/cambios-y-devoluciones': {
      title: 'Cambios y devoluciones',
      description: 'Información de cambios y devoluciones de Horizon Fit.'
    },
    '/guia-de-talles': {
      title: 'Guía de talles',
      description: 'Guía de talles de Horizon Fit.'
    },
    '/medios-de-pago': {
      title: 'Medios de pago',
      description: 'Información de medios de pago de Horizon Fit.'
    },
    '/terminos': {
      title: 'Términos y condiciones',
      description: 'Términos y condiciones de Horizon Fit.'
    },
    '/privacidad': {
      title: 'Política de privacidad',
      description: 'Política de privacidad de Horizon Fit.'
    },
    '/defensa-al-consumidor': {
      title: 'Defensa al consumidor',
      description: 'Información de defensa al consumidor de Horizon Fit.'
    }
  };
  const FOOTER_HELP_DEFAULT_LINKS = [
    { text: 'Envíos y entregas', url: '/envios-y-entregas/' },
    { text: 'Cambios y devoluciones', url: '/cambios-y-devoluciones/' },
    { text: 'Guía de talles', url: '/guia-de-talles/' },
    { text: 'Medios de pago', url: '/medios-de-pago/' }
  ];

  const SEO_TAGS = {
    description: 'hfMetaDescription',
    robots: 'hfMetaRobots',
    canonical: 'hfCanonicalLink',
    ogSiteName: 'hfOgSiteName',
    ogTitle: 'hfOgTitle',
    ogDescription: 'hfOgDescription',
    ogUrl: 'hfOgUrl',
    ogType: 'hfOgType',
    ogImage: 'hfOgImage',
    twitterCard: 'hfTwitterCard',
    twitterTitle: 'hfTwitterTitle',
    twitterDescription: 'hfTwitterDescription',
    twitterImage: 'hfTwitterImage',
    jsonLd: 'hfSeoJsonLd'
  };

  const ensureHeadNode = (tagName, id, attrs = {}) => {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement(tagName);
      node.id = id;
      document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        node.removeAttribute(key);
      } else {
        node.setAttribute(key, `${value}`);
      }
    });
    return node;
  };

  const ensureSeoLink = (id, href) => ensureHeadNode('link', id, { rel: 'canonical', href });

  const normalizeSeoDescription = (value, fallback = HOME_SEO_DESCRIPTION, maxLength = 160) => {
    const text = `${value || ''}`.trim();
    const source = text || fallback;
    if (source.length <= maxLength) return source;
    return `${source.slice(0, maxLength - 1).trimEnd()}…`;
  };

  const routeBaseUrl = (pathname, search = '') => {
    const url = new URL(window.location.href);
    url.pathname = pathname;
    url.search = search;
    url.hash = '';
    return url.href;
  };

  const updateSeo = ({
    title = HOME_SEO_TITLE,
    description = HOME_SEO_DESCRIPTION,
    canonical = routeBaseUrl('/'),
    robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    ogType = 'website',
    ogImage = DEFAULT_SOCIAL_IMAGE,
    schema = []
  } = {}) => {
    document.title = title;
    ensureHeadNode('meta', SEO_TAGS.description, { name: 'description', content: normalizeSeoDescription(description) });
    ensureHeadNode('meta', SEO_TAGS.robots, { name: 'robots', content: robots });
    ensureSeoLink(SEO_TAGS.canonical, canonical);
    ensureHeadNode('meta', SEO_TAGS.ogSiteName, { property: 'og:site_name', content: SITE_NAME });
    ensureHeadNode('meta', SEO_TAGS.ogTitle, { property: 'og:title', content: title });
    ensureHeadNode('meta', SEO_TAGS.ogDescription, { property: 'og:description', content: normalizeSeoDescription(description) });
    ensureHeadNode('meta', SEO_TAGS.ogUrl, { property: 'og:url', content: canonical });
    ensureHeadNode('meta', SEO_TAGS.ogType, { property: 'og:type', content: ogType });
    ensureHeadNode('meta', SEO_TAGS.twitterCard, { name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' });
    ensureHeadNode('meta', SEO_TAGS.twitterTitle, { name: 'twitter:title', content: title });
    ensureHeadNode('meta', SEO_TAGS.twitterDescription, { name: 'twitter:description', content: normalizeSeoDescription(description) });
    if (ogImage) {
      ensureHeadNode('meta', SEO_TAGS.ogImage, { property: 'og:image', content: ogImage });
      ensureHeadNode('meta', SEO_TAGS.twitterImage, { name: 'twitter:image', content: ogImage });
    }
    const schemaNode = ensureHeadNode('script', SEO_TAGS.jsonLd, { type: 'application/ld+json' });
    const graph = Array.isArray(schema) ? schema.filter(Boolean) : [];
    if (graph.length) {
      schemaNode.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    } else {
      schemaNode.textContent = '';
    }
  };

  const organizationSchema = () => ({
    '@type': 'Organization',
    '@id': routeBaseUrl('/#organization'),
    name: SITE_NAME,
    url: routeBaseUrl('/')
  });

  const websiteSchema = (description = HOME_SEO_DESCRIPTION) => ({
    '@type': 'WebSite',
    '@id': routeBaseUrl('/#website'),
    name: SITE_NAME,
    url: routeBaseUrl('/'),
    description: normalizeSeoDescription(description),
    potentialAction: {
      '@type': 'SearchAction',
      target: routeBaseUrl('/?s={search_term_string}'),
      'query-input': 'required name=search_term_string'
    }
  });

  const breadcrumbSchema = (items) => ({
    '@type': 'BreadcrumbList',
    itemListElement: (Array.isArray(items) ? items : []).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  });

  const productSchema = (product, canonical, imageUrl = '') => {
    const availability = getVisibleProductAvailability(product);
    const priceValue = getProductPriceValue(product);
    const minorUnit = getProductPriceMinorUnit(product);
    const canPurchase = Boolean(availability.canPurchase);
    const offers = {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: product?.prices?.currency_code || product?.currency || 'ARS',
      availability: canPurchase ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    };
    if (Number.isFinite(priceValue) && priceValue > 0) {
      offers.price = `${priceValue / Math.pow(10, minorUnit)}`;
    }
    const schema = {
      '@type': 'Product',
      '@id': `${canonical}#product`,
      name: product?.name || SITE_NAME,
      description: normalizeSeoDescription(plainTextFromHtml(product?.shortDescription || product?.description || product?.excerpt || ''), HOME_SEO_DESCRIPTION),
      offers
    };
    if (imageUrl) schema.image = [imageUrl];
    if (product?.sku) schema.sku = `${product.sku}`;
    schema.brand = { '@type': 'Brand', name: SITE_NAME };
    return schema;
  };

  const isUtilityRoute = () => {
    const path = window.location.pathname.replace(/\/+$/, '');
    return ['/cart', '/checkout', '/mi-cuenta', '/my-account'].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  };

  const getInfoPageForRoute = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return INFO_PAGES[path] ? { ...INFO_PAGES[path], path } : null;
  };

  const isAccountRoute = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/mi-cuenta' || path.startsWith('/mi-cuenta/') || path === '/my-account' || path.startsWith('/my-account/');
  };

  const isLostPasswordRoute = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/mi-cuenta/lost-password' || path.startsWith('/mi-cuenta/lost-password/') || path === '/my-account/lost-password' || path.startsWith('/my-account/lost-password/');
  };

  const isCheckoutRoute = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/checkout' || path.startsWith('/checkout/');
  };

  // Trae el mapa type -> settings de las secciones. Lee primero la cache
  // estÃ¡tica (instantÃ¡nea); si falta, cae al REST. Si nada responde, Map vacÃ­o
  // y el sitio sigue con la config de home.json.
  const fetchWpSectionSettings = async () => {
    const map = new Map();
    const buildMap = (data) => {
      if (!Array.isArray(data)) return;
      for (const section of data) {
        if (section?.type && section.settings && !Array.isArray(section.settings)) {
          map.set(section.type, section.settings);
        }
      }
    };
    try {
      const data = await fetchJson(WP_SECTIONS_CACHE_URL);
      buildMap(data);
      return map;
    } catch (e) { /* sin cache estÃ¡tica, probar REST */ }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(WP_SECTIONS_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) buildMap(await res.json());
    } catch (e) {
      console.warn('[HF PB] WordPress section settings unavailable, using local config:', e.message);
    }
    return map;
  };

  const isProductRoute = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return params.get('view') === 'product' || path === '/producto' || path.startsWith('/producto/');
  };

  const isCollectionRoute = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/\/+$/, '');
    return params.get('view') === 'collection' || path === '/coleccion' || path.startsWith('/coleccion/');
  };

  const isGlobalSection = (section) => GLOBAL_SECTION_TYPES.has(section?.type);

  const shouldRenderSection = (section, productRoute, collectionRoute, utilityRoute, accountLikeRoute) => {
    if (utilityRoute || accountLikeRoute) return isGlobalSection(section);
    if (!productRoute && !collectionRoute) return true;
    return isGlobalSection(section);
  };

  const getSectionSlot = (section) => {
    switch (section?.type) {
      case 'marquee':
      case 'navbar':
        return SECTION_SLOT.BEFORE_ROOT;
      case 'footer':
      case 'whatsapp-float':
        return SECTION_SLOT.AFTER_ROOT;
      default:
        return SECTION_SLOT.ROOT;
    }
  };

  // Fuentes de la pÃ¡gina de colecciÃ³n.
  const categoryCollectionSrc = (slug) =>
    `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/collection-${slug}.json`;
  const COLLECTION_SETTINGS_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/collection-settings.json`;
  const COLLECTION_COMPONENT = '/design-system/components/sections/collection.html';
  const COLLECTION_DEFAULTS = { colsDesktop: 4, colsMobile: 2 };

  const getCollectionSlugFromUrl = (url) => {
    if (!url) return null;
    try {
      const parsed = new URL(url, window.location.origin);
      const path = parsed.pathname.replace(/\/+$/, '');
      const pathMatch = path.match(/^\/coleccion\/([^/]+)$/);
      const isCollectionPath = path === '/coleccion' || path.startsWith('/coleccion/');
      const isCollectionView = parsed.searchParams.get('view') === 'collection';
      if (!isCollectionPath && !isCollectionView) return null;
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1]).trim();
      }
      return (parsed.searchParams.get('cat') || '').trim();
    } catch (e) {
      return null;
    }
  };

  const buildCollectionUrl = (slug = '') => {
    const cleanSlug = String(slug || '').trim();
    if (!cleanSlug) return routeBaseUrl('/coleccion/');
    return routeBaseUrl(`/coleccion/${encodeURIComponent(cleanSlug)}/`);
  };

  const getCollectionSlugFromLocation = () => getCollectionSlugFromUrl(window.location.href) || '';

  const collectionHasProducts = async (slug) => {
    if (!slug) return false;
    try {
      const products = await fetchJson(categoryCollectionSrc(slug));
      return Array.isArray(products) && products.length > 0;
    } catch (e) {
      return false;
    }
  };

  const filterValidCollectionLinks = async (items) => {
    if (!Array.isArray(items)) return [];
    const checked = await Promise.all(items.map(async item => {
      const slug = getCollectionSlugFromUrl(item?.url || item?.link || '');
      if (slug === null) return item;
      return await collectionHasProducts(slug) ? item : null;
    }));
    return checked.filter(Boolean);
  };

  const redirectToHome = () => {
    window.location.replace('/');
  };

  const stripDuplicateSlugSuffix = (value) => String(value || '')
    .replace(/\s*\(\s*(?:copia|copy)(?:\s*\d+)?\s*\)\s*$/i, '')
    .replace(/(?:[._\-\s]*(?:copia|copy)(?:[._\-\s]*\d+)?)$/i, '')
    .trim();

  const slugifyText = (value) => stripDuplicateSlugSuffix(decodeEntities(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const getProductPermalinkSlug = (product) => {
    let permalinkSlug = '';
    try {
      const permalink = product?.permalink ? new URL(product.permalink, WP_BASE_URL) : null;
      permalinkSlug = permalink ? permalink.pathname.replace(/\/$/, '').split('/').pop() : '';
    } catch (error) {
      permalinkSlug = `${product?.permalink || ''}`.split('?')[0].replace(/\/$/, '').split('/').pop();
    }
    return permalinkSlug || '';
  };

  const normalizeProductSlug = (value) => slugifyText(value);

  const getProductCanonicalSlug = (product) => {
    const candidates = [
      product?.slug,
      getProductPermalinkSlug(product),
      product?.post_name,
      product?.handle,
      product?.name
    ];

    for (const candidate of candidates) {
      const slug = normalizeProductSlug(candidate);
      if (slug) return slug;
    }
    return '';
  };

  const productUrl = (product) => {
    const slug = getProductCanonicalSlug(product);
    return slug ? `/producto/${encodeURIComponent(slug)}/` : '#';
  };

  const collectProducts = (source, map) => {
    if (Array.isArray(source)) {
      source.forEach(item => collectProducts(item, map));
      return;
    }

    if (!source || typeof source !== 'object') return;

    if (Array.isArray(source.products)) {
      source.products.forEach(item => collectProducts(item, map));
    }

    if (source.id && source.slug && !map.has(source.slug)) {
      map.set(source.slug, source);
    }
  };

  const fetchProductCatalog = async (pageConfig = null) => {
    const sources = new Set([
      PRODUCT_DATA_SRC,
      FEATURED_SETS_SRC
    ]);

    const configuredCollections = (pageConfig?.sections || [])
      .filter(section => section?.type === 'featured-products' && section.config?.collection)
      .map(section => section.config.collection);
    configuredCollections.forEach(slug => sources.add(productCollectionSrc(slug)));

    // Keep the PDP resilient even if home.json is stale or a row is renamed later.
    ['featured-row-1', 'featured-row-2'].forEach(slug => sources.add(productCollectionSrc(slug)));

    const featuredCategories = await fetchJson(FEATURED_CATEGORIES_SRC).catch(() => []);
    if (Array.isArray(featuredCategories)) {
      featuredCategories
        .map(category => category?.slug)
        .filter(Boolean)
        .forEach(slug => sources.add(categoryCollectionSrc(slug)));
    }

    const productMap = new Map();
    const datasets = await Promise.all(
      Array.from(sources).map(src => fetchJson(src).catch(() => []))
    );
    datasets.forEach(dataset => collectProducts(dataset, productMap));

    if (productMap.size === 0) {
      collectProducts(await fetchJson(PRODUCT_DATA_FALLBACK_SRC).catch(() => []), productMap);
    }

    return filterVisibleProducts(Array.from(productMap.values()));
  };

  const init = async () => {
    const startedAt = performance.now();
    const root = document.getElementById('hfPageBuilderRoot');
    if (!root) return;

    const pageSrc = root.getAttribute('data-page-src');
    if (!pageSrc) return;

    try {
      const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
      if (currentPath === '/my-account' || currentPath.startsWith('/my-account/')) {
        const targetPath = currentPath.replace(/^\/my-account/, '/mi-cuenta');
        const normalizedTarget = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
        window.location.replace(routeBaseUrl(normalizedTarget, window.location.search));
        return;
      }

      const productRoute = isProductRoute();
      const collectionRoute = !productRoute && isCollectionRoute();
      const lostPasswordRoute = !productRoute && !collectionRoute && isLostPasswordRoute();
      const accountRoute = !productRoute && !collectionRoute && !lostPasswordRoute && isAccountRoute();
      const checkoutRoute = !productRoute && !collectionRoute && isCheckoutRoute();
      const infoPage = !productRoute && !collectionRoute && !accountRoute && !checkoutRoute && !lostPasswordRoute
        ? getInfoPageForRoute()
        : null;
      const utilityRoute = isUtilityRoute() || Boolean(infoPage);
      const productPageTemplatePromise = productRoute ? fetchText(PRODUCT_DETAIL_COMPONENT) : null;
      const accountPageTemplatePromise = accountRoute ? fetchText(ACCOUNT_COMPONENT) : null;
      const checkoutPageTemplatePromise = checkoutRoute ? fetchText(CHECKOUT_COMPONENT) : null;
      const lostPasswordPageTemplatePromise = lostPasswordRoute ? fetchText(LOST_PASSWORD_COMPONENT) : null;
      const infoPageTemplatePromise = infoPage ? fetchText(INFO_PAGE_COMPONENT) : null;
      // Contenido editable de las páginas del footer (título + HTML).
      const infoPagesDataPromise = infoPage ? fetchJson(INFO_PAGES_SRC).catch(() => null) : null;

      if (checkoutRoute) {
        updateSeo({
          title: `Checkout | ${SITE_NAME}`,
          description: 'Completa tus datos y pagá sin salir de Horizon Fit.',
          canonical: routeBaseUrl('/checkout/'),
          robots: 'noindex,nofollow',
          ogType: 'website',
          schema: []
        });
      } else if (lostPasswordRoute) {
        updateSeo({
          title: `Recuperar contraseña | ${SITE_NAME}`,
          description: 'Recuperá el acceso a tu cuenta de Horizon Fit desde 8088.',
          canonical: routeBaseUrl('/mi-cuenta/lost-password/'),
          robots: 'noindex,nofollow',
          ogType: 'website',
          schema: []
        });
      } else if (accountRoute) {
        updateSeo({
          title: `Mi cuenta | ${SITE_NAME}`,
          description: 'Acceso a tu cuenta de Horizon Fit, con la navegación quedándose en la tienda.',
          canonical: routeBaseUrl('/mi-cuenta/'),
          robots: 'noindex,nofollow',
          ogType: 'website',
          schema: []
        });
      } else if (infoPage) {
        updateSeo({
          title: `${infoPage.title} | ${SITE_NAME}`,
          description: infoPage.description,
          canonical: routeBaseUrl(`${infoPage.path}/`),
          ogType: 'website',
          schema: [
            organizationSchema(),
            websiteSchema(infoPage.description),
            breadcrumbSchema([
              { name: 'Inicio', url: routeBaseUrl('/') },
              { name: infoPage.title, url: routeBaseUrl(`${infoPage.path}/`) }
            ])
          ]
        });
      } else if (utilityRoute) {
        updateSeo({
          title: `${SITE_NAME} | Acceso`,
          description: 'Ruta operativa del sitio, no destinada a indexación.',
          canonical: routeBaseUrl('/'),
          robots: 'noindex,nofollow',
          ogType: 'website',
          schema: []
        });
      } else if (!productRoute && !collectionRoute) {
        updateSeo({
          title: HOME_SEO_TITLE,
          description: HOME_SEO_DESCRIPTION,
          canonical: routeBaseUrl('/'),
          ogType: 'website',
          schema: [
            organizationSchema(),
            websiteSchema(HOME_SEO_DESCRIPTION)
          ]
        });
      }

      // PÃ¡gina de colecciÃ³n: productos de la categorÃ­a + settings + componente.
      const collectionParams = new URLSearchParams(window.location.search);
      const collectionCat = collectionRoute ? getCollectionSlugFromLocation() : '';
      const hasLegacyCollectionQuery = collectionRoute && collectionParams.has('cat');
      if (collectionRoute && collectionCat && (hasLegacyCollectionQuery || window.location.pathname.replace(/\/+$/, '') === '/coleccion')) {
        window.location.replace(buildCollectionUrl(collectionCat));
        return;
      }
      const collectionPageSourcesPromise = collectionRoute ? Promise.all([
        collectionCat
          ? fetchJson(categoryCollectionSrc(collectionCat))
            .catch(async () => fetchJson(productCollectionSrc(collectionCat)))
            .catch(() => null)
          : fetchJson(PRODUCT_DATA_SRC).catch(() => null),
        fetchJson(COLLECTION_SETTINGS_SRC).catch(() => COLLECTION_DEFAULTS),
        fetchText(COLLECTION_COMPONENT)
      ]) : null;

      // Settings editables desde wp-admin (mensajes del marquee, footer, hero).
      // Se piden SIEMPRE (tambiÃ©n en producto/colecciÃ³n): el marquee y el footer
      // son secciones comunes a todas las pÃ¡ginas y necesitan sus settings, sino
      // quedan vacÃ­os (el marquee no mostraba nada en la PDP).
      const wpSettingsPromise = fetchWpSectionSettings();

      // MenÃº de la navbar (items + categorÃ­as), administrado desde wp-admin.
      // Se pide en paralelo; si falla, el menÃº queda vacÃ­o sin romper el resto.
      const menuPromise = fetchJson(MENU_SRC).catch(() => []);

      const t0 = performance.now();
      const pageConfig = await fetchJson(pageSrc);
      console.log(`[HF PB] fetch home.json: ${Math.round(performance.now() - t0)}ms`);

      if (!pageConfig.sections) return;

      let sections = pageConfig.sections
        .filter(s => s.visible !== false)
        .filter(section => shouldRenderSection(section, productRoute, collectionRoute, utilityRoute, accountRoute || checkoutRoute || lostPasswordRoute))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // Load all components and data in parallel
      const t1 = performance.now();
      const [componentEntries, dataEntries] = await Promise.all([
        Promise.all(sections.map(async s => {
          const html = await fetchText(s.component);
          return [s.id, html];
        })),
        Promise.all(sections.filter(s => s.data || s.type === 'featured-sets' || s.type === 'categorias').map(async s => {
          // featured-products: cada fila trae SU colecciÃ³n (config.collection),
          // administrada desde wp-admin (taxonomÃ­a hf_collection). Cache por
          // colecciÃ³n; fallback a la cache general y luego al REST.
          if (s.type === 'featured-products') {
            const sources = Array.isArray(s.config?.sources) ? s.config.sources : [];
            if (sources.length) {
              const sourceLists = await Promise.all(sources.map(async source => {
                const type = `${source?.type || 'category'}`.toLowerCase();
                const slug = `${source?.slug || ''}`.trim();
                if (!slug) return [];
                const src = type === 'featured'
                  ? productCollectionSrc(slug)
                  : categoryCollectionSrc(slug);
                return fetchJson(src).catch(() => []);
              }));
              return [s.id, sourceLists.flat()];
            }
            const collection = s.config?.collection;
            const src = collection ? productCollectionSrc(collection) : PRODUCT_DATA_SRC;
            const data = await fetchJson(src)
              .catch(async () => fetchJson(PRODUCT_DATA_SRC))
              .catch(async () => fetchJson(PRODUCT_DATA_FALLBACK_SRC));
            return [s.id, data];
          }
          // featured-sets: slider de conjuntos (colecciones "Mostrar en home").
          if (s.type === 'featured-sets') {
            const data = await fetchJson(FEATURED_SETS_SRC).catch(() => []);
            return [s.id, data];
          }
          // categorias: grid "Compra por categorÃ­a" (categorÃ­as "Mostrar en home").
          if (s.type === 'categorias') {
            const data = await fetchJson(FEATURED_CATEGORIES_SRC).catch(() => []);
            return [s.id, data];
          }
          const data = await fetchJson(s.data);
          return [s.id, data];
        }))
      ]);
      console.log(`[HF PB] fetch all components & data: ${Math.round(performance.now() - t1)}ms`);

      const componentMap = new Map(componentEntries);
      const dataMap = new Map(dataEntries);

      // Render sections in order
      const t2 = performance.now();
      const sectionElements = new Map();
      const tailSectionEls = [];
      let hasProductsAnchor = false;
      let hasSetsAnchor = false;
      for (const section of sections) {
        const componentHtml = componentMap.get(section.id);
        if (!componentHtml) continue;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = componentHtml;
        const sectionEl = wrapper.firstElementChild;
        sectionElements.set(section.id, sectionEl);

        if (!productRoute && section.type === 'featured-products' && !hasProductsAnchor) {
          sectionEl.id = 'productos-destacados';
          hasProductsAnchor = true;
        }

        if (!productRoute && section.type === 'featured-sets' && !hasSetsAnchor) {
          sectionEl.id = 'conjuntos-destacados';
          hasSetsAnchor = true;
        }

        // Handle optional title
        if (section.config?.title) {
          const titleEl = sectionEl.querySelector('[data-section-title]');
          if (titleEl) titleEl.textContent = section.config.title;
        } else {
          const headEl = sectionEl.querySelector('.hf-section-head');
          if (headEl) headEl.style.display = 'none';
        }

        const slot = getSectionSlot(section);
        if (slot === SECTION_SLOT.BEFORE_ROOT) {
          document.body.insertBefore(sectionEl, root);
        } else if (slot === SECTION_SLOT.AFTER_ROOT) {
          // Footer y WhatsApp flotante comparten el mismo shell global y se
          // montan al final del body, independientemente de la ruta.
          tailSectionEls.push(sectionEl);
        } else {
          root.appendChild(sectionEl);
        }

        // For navbar: also insert drawers/overlay to body
        if (section.type === 'navbar') {
          let child = wrapper.firstElementChild;
          while (child) {
            const next = child.nextElementSibling;
            document.body.appendChild(child);
            child = next;
          }
        }
      }

      const wpSettings = await wpSettingsPromise;
      let productPageProducts = null;
      let productPageTemplate = null;
      if (productRoute) {
        [productPageProducts, productPageTemplate] = await Promise.all([
          fetchProductCatalog(pageConfig),
          productPageTemplatePromise
        ]);
        await renderProductPage(root, productPageProducts, productPageTemplate, wpSettings);
      }

      if (collectionRoute) {
        const [products, settings, html] = await collectionPageSourcesPromise;
        renderCollectionPage(root, collectionCat, products, settings, html);
      }

      if (accountRoute) {
        renderAccountPage(root, await accountPageTemplatePromise);
      } else if (checkoutRoute) {
        renderCheckoutPage(root, await checkoutPageTemplatePromise);
      } else if (lostPasswordRoute) {
        renderLostPasswordPage(root, await lostPasswordPageTemplatePromise);
      } else if (infoPage) {
        // Mergear el contenido editable (título + HTML) cargado desde el admin.
        const infoData = await infoPagesDataPromise;
        const saved = infoData && infoData[infoPage.path];
        if (saved) {
          if (saved.title) infoPage.title = saved.title;
          if (saved.content) infoPage.content = saved.content;
        }
        renderInfoPage(root, infoPage, await infoPageTemplatePromise);
      }

      tailSectionEls.forEach(sectionEl => {
        if (sectionEl && !sectionEl.isConnected) {
          document.body.appendChild(sectionEl);
        }
      });
      console.log(`[HF PB] render HTML: ${Math.round(performance.now() - t2)}ms`);

      // Hydrate sections with data
      const t3 = performance.now();
      if (!productRoute && !collectionRoute && !utilityRoute) {
        const footerCopy = wpSettings.get('footer')?.copy || HOME_SEO_DESCRIPTION;
        updateSeo({
          title: HOME_SEO_TITLE,
          description: footerCopy,
          canonical: routeBaseUrl('/'),
          ogType: 'website',
          schema: [
            organizationSchema(),
            websiteSchema(footerCopy)
          ]
        });
      }
      const localHeroSection = sections.find(section => section.type === 'hero');
      const heroConfigForVideoTiles = {
        ...(localHeroSection?.config || {}),
        ...(wpSettings.get('hero') || {})
      };
      const featuredProductsRenderState = { usedKeys: new Set() };
      for (const section of sections) {
        if (!productRoute && section.type === 'featured-products' && section.data) {
          const data = dataMap.get(section.id);
          const sectionEl = sectionElements.get(section.id);
          if (data && sectionEl) await renderFeaturedProducts(sectionEl, section, data, featuredProductsRenderState);
        }

        if (!productRoute && section.type === 'hero') {
          const sectionEl = sectionElements.get(section.id);
          // wp-admin manda: si la SecciÃ³n hero tiene settings de video, ganan;
          // si no, se usa la config local de home.json.
          if (sectionEl) setupHero(sectionEl, heroConfigForVideoTiles);
        }

        if (!productRoute && section.type === 'featured-sets') {
          const sets = dataMap.get(section.id) || [];
          const sectionEl = sectionElements.get(section.id);
          const variant = section.component.includes('mobile') ? 'mobile' : 'desktop';
          if (sectionEl) renderFeaturedSets(sectionEl, sets, variant);
        }

        if (!productRoute && section.type === 'categorias') {
          const cats = dataMap.get(section.id) || [];
          const sectionEl = sectionElements.get(section.id);
          if (sectionEl) await renderCategories(sectionEl, cats);
        }

        if (section.type === 'marquee') {
          const sectionEl = sectionElements.get(section.id);
          // Mensajes administrables desde wp-admin (SecciÃ³n marquee). Si no hay,
          // se conserva el texto del HTML.
          const messages = wpSettings.get('marquee')?.messages;
          if (sectionEl) setupMarquee(sectionEl, messages);
        }

        if (section.type === 'footer') {
          // Footer administrable desde wp-admin. Aparece en todas las pÃ¡ginas.
          const sectionEl = sectionElements.get(section.id);
          if (sectionEl) setupFooter(sectionEl, wpSettings.get('footer'));
        }

        if (section.type === 'whatsapp-float') {
          const sectionEl = sectionElements.get(section.id);
          if (sectionEl) setupWhatsAppFloat(sectionEl, wpSettings.get('whatsapp-float'), section.config);
        }

        if (!productRoute && !collectionRoute && section.type === 'trust-bar') {
          const sectionEl = sectionElements.get(section.id);
          if (sectionEl) setupTrustBar(sectionEl, wpSettings.get('trust-bar'));
        }

        if (!productRoute && !collectionRoute && section.type === 'style-edit') {
          const sectionEl = sectionElements.get(section.id);
          if (sectionEl) setupStyleEdit(sectionEl, wpSettings.get('style-edit'), heroConfigForVideoTiles);
        }

        if (!productRoute && !collectionRoute && section.type === 'social-strip') {
          const sectionEl = sectionElements.get(section.id);
          if (sectionEl) setupSocialStrip(sectionEl, wpSettings.get('social-strip'));
        }
      }
      console.log(`[HF PB] hydrate sections: ${Math.round(performance.now() - t3)}ms`);

      // Rellenar el menÃº de la navbar ANTES de cablear los drawers, asÃ­
      // initNavbarAndMenuDrawer toma los [data-menu-link] reciÃ©n inyectados.
      await renderNavMenu(await menuPromise);

      initNavbarAndMenuDrawer();
      initStorefrontCommerce({
        getProducts: () => fetchProductCatalog(pageConfig)
      });
      initNavbarScroll();
      initBrandSwap();
      console.log(`[HF PB] TOTAL: ${Math.round(performance.now() - startedAt)}ms`);
      document.documentElement.dataset.pageBuilderReady = 'true';
    } catch (e) {
      console.error('Page builder error:', e);
      document.documentElement.dataset.pageBuilderReady = 'error';
    }
  };

  const PRODUCT_CARD_TEMPLATE_HTML = `
    <article class="hf-product-item hf-product-item--slider">
      <a class="hf-product-item__link" href="#">
        <div class="hf-product-item__media">
          <span class="hf-product-item__badge"></span>
          <div class="hf-product-item__slider" data-slider>
            <div class="hf-product-item__slide"><img src="" alt=""></div>
            <div class="hf-product-item__slide"><img src="" alt=""></div>
            <div class="hf-product-item__slide"><img src="" alt=""></div>
          </div>
          <div class="hf-product-item__dots">
            <button class="hf-product-item__dot is-active" data-slide="0" type="button"></button>
            <button class="hf-product-item__dot" data-slide="1" type="button"></button>
            <button class="hf-product-item__dot" data-slide="2" type="button"></button>
          </div>
        </div>
        <div class="hf-product-item__body">
          <div class="hf-product-item__sizes"></div>
          <h3 class="hf-product-item__title"></h3>
          <div class="hf-product-item__pricing">
            <div class="hf-product-item__price-row">
              <span class="hf-product-item__price"></span>
              <span class="hf-product-item__price-original"></span>
            </div>
            <p class="hf-product-item__installments"></p>
            <p class="hf-product-item__transfer"></p>
          </div>
        </div>
      </a>
    </article>`;

  const createProductCardTemplate = () => {
    const template = document.createElement('template');
    template.innerHTML = PRODUCT_CARD_TEMPLATE_HTML;
    return template;
  };

  const renderProductCardHtml = (product, options = {}) => {
    const wrapper = document.createElement('div');
    wrapper.appendChild(fillProductCard(createProductCardTemplate(), product, options));
    return wrapper.innerHTML;
  };

  const renderCardInstallmentsHtml = (text) => {
    const clean = `${text || ''}`.trim();
    if (!clean) return '';

    const match = clean.match(/^\s*(\$?\s*[\d.,]+)\s+en\s+(\d+)\s+cuotas/i);
    if (match) {
      return `${escapeHtml(match[2])} cuotas de: <span class="hf-product-item__installments-value">${escapeHtml(match[1].trim())}</span>`;
    }

    return escapeHtml(clean);
  };

  const renderCardTransferHtml = (text) => {
    const clean = `${text || ''}`.trim();
    if (!clean) return '';

    const match = clean.match(/^\s*(\$?\s*[\d.,]+)\s+(.*)$/);
    if (match) {
      return `<span class="hf-product-item__transfer-value">${escapeHtml(match[1].trim())}</span> <span class="hf-product-item__transfer-label">${escapeHtml(match[2].trim())}</span>`;
    }

    return escapeHtml(clean);
  };

  // Clona el template de card y lo rellena con los datos del producto.
  // Reusado por featured-products, colecciones y "Compralo con".
  const fillProductCard = (template, product, options = {}) => {
    const { showSizes = true } = options;
    const clone = template.content.cloneNode(true);
    const availability = getVisibleProductAvailability(product);

    const link = clone.querySelector('.hf-product-item__link');
    if (link) link.href = productUrl(product);

    const title = clone.querySelector('.hf-product-item__title');
    if (title) title.textContent = product.name || '';

    const price = clone.querySelector('.hf-product-item__price');
    if (price) price.textContent = availability.priceText || '';

    const priceRow = clone.querySelector('.hf-product-item__price-row');
    if (priceRow) priceRow.hidden = !availability.priceText;

    const priceOrig = clone.querySelector('.hf-product-item__price-original');
    if (priceOrig) {
      const compareText = availability.compareText && availability.compareText !== availability.priceText
        ? availability.compareText
        : '';
      priceOrig.textContent = compareText;
      priceOrig.hidden = !compareText;
    }

    const badge = clone.querySelector('.hf-product-item__badge');
    if (badge) badge.textContent = availability.badge || '';

    const images = product.imageObjects || product.images || [];
    const imgElements = clone.querySelectorAll('.hf-product-item__slide img');
    imgElements.forEach((img, idx) => {
      if (images[idx]) {
        const imgUrl = typeof images[idx] === 'string' ? images[idx] : images[idx].url;
        img.src = imgUrl;
        img.alt = product.name || '';
      }
    });

    const sizesEl = clone.querySelector('.hf-product-item__sizes');
    if (sizesEl && !showSizes) {
      sizesEl.remove();
    } else if (sizesEl && product.sizes && product.sizes.length > 0) {
      sizesEl.innerHTML = product.sizes.map(s => '<span>' + s + '</span>').join('');
    }

    const installments = clone.querySelector('.hf-product-item__installments');
    if (installments) {
      if (availability.canPurchase) {
        installments.innerHTML = renderCardInstallmentsHtml(availability.installmentsText);
        installments.hidden = !installments.innerHTML;
      } else {
        installments.textContent = availability.label || '';
        installments.hidden = !installments.textContent;
      }
    }

    const transfer = clone.querySelector('.hf-product-item__transfer');
    if (transfer) {
      transfer.innerHTML = availability.canPurchase ? renderCardTransferHtml(availability.transferText) : '';
      transfer.hidden = !transfer.innerHTML;
    }

    return clone;
  };

  const getProductRenderKey = (product) =>
    `${product?.id || product?.slug || product?.permalink || product?.url || product?.name || ''}`;

  const renderFeaturedProducts = async (sectionEl, section, products, renderState = null) => {
    try {
      const limit = Number(section.config?.limit || 0);
      const offset = Math.max(0, Number(section.config?.offset || 0));
      const excludePreviouslyRendered = Boolean(section.config?.excludePreviouslyRendered);
      const excludeCollections = Array.isArray(section.config?.excludeCollections)
        ? section.config.excludeCollections.map(slug => `${slug || ''}`.toLowerCase()).filter(Boolean)
        : [];
      const excludeNameContains = Array.isArray(section.config?.excludeNameContains)
        ? section.config.excludeNameContains.map(text => `${text || ''}`.toLowerCase()).filter(Boolean)
        : [];
      const requireImage = Boolean(section.config?.requireImage);
      const getCollectionSlugs = (product) => {
        const collections = product?.collections || product?.collection || [];
        return (Array.isArray(collections) ? collections : [collections])
          .map(collection => typeof collection === 'string' ? collection : collection?.slug)
          .map(slug => `${slug || ''}`.toLowerCase())
          .filter(Boolean);
      };
      const seenCandidateKeys = new Set();
      const sourceProducts = filterVisibleProducts(products)
        .filter(product => {
          const renderKey = getProductRenderKey(product);
          if (seenCandidateKeys.has(renderKey)) return false;
          seenCandidateKeys.add(renderKey);
          const collectionSlugs = getCollectionSlugs(product);
          if (excludeCollections.some(slug => collectionSlugs.includes(slug))) return false;
          const productName = `${product?.name || ''}`.toLowerCase();
          if (excludeNameContains.some(text => productName.includes(text))) return false;
          if (requireImage && !getProductImages(product)[0]?.url) return false;
          if (excludePreviouslyRendered && renderState?.usedKeys?.has(renderKey)) return false;
          return true;
        });
      const visibleProducts = limit > 0 ? sourceProducts.slice(offset, offset + limit) : sourceProducts.slice(offset);

      const grid = sectionEl.querySelector('[data-products-slot]') || sectionEl.querySelector('[data-products-grid]');
      if (!grid) return;

      const template = sectionEl.querySelector('[data-product-template]');
      if (!template) return;

      visibleProducts.forEach(product => grid.appendChild(fillProductCard(template, product)));
      if (renderState?.usedKeys) {
        visibleProducts.forEach(product => renderState.usedKeys.add(getProductRenderKey(product)));
      }

      console.log('Rendered ' + visibleProducts.length + ' featured products');
    } catch (e) {
      console.error('Featured products error:', e);
    }
  };

  const MARQUEE_MESSAGE = '3 Y 6 CUOTAS SIN INTERÉS';

  // El marquee debe mostrar solo el mensaje comercial principal, repetido
  // las veces necesarias para completar el loop.
  const setupMarquee = (sectionEl, messages) => {
    const content = sectionEl.querySelector('.hf-marquee__content');
    if (!content) return;
    const marqueeMessages = Array.from({ length: 8 }, () => MARQUEE_MESSAGE);

    // Si el motor ya clonÃ³ el contenido para el loop, destruir esa instancia
    // (borra los clones) antes de reemplazar el contenido. AsÃ­ evitamos clones
    // con el texto viejo y un loop mal medido.
    if (sectionEl._hfMarquee && typeof sectionEl._hfMarquee.destroy === 'function') {
      sectionEl._hfMarquee.destroy();
      sectionEl._hfMarquee = null;
    }

    content.innerHTML = marqueeMessages.map(msg =>
      `<span class="hf-marquee__item">${escapeHtml(msg)}</span>` +
      `<span class="hf-marquee__separator" aria-hidden="true"></span>`
    ).join('');

    // Inicializar el motor desde cero: clona el contenido ya con los mensajes
    // nuevos y arma el scroll infinito.
    if (window.HFMarquee && typeof window.HFMarquee.init === 'function') {
      sectionEl._hfMarquee = window.HFMarquee.init(sectionEl);
    }
  };

  // Rellena el footer con los datos administrados desde wp-admin. Cada campo
  // que falte conserva el texto/href del HTML (fallback). Todo opcional.
  const setupFooter = (sectionEl, settings) => {
    if (!settings || typeof settings !== 'object') return;

    const setText = (sel, value) => {
      if (value == null || value === '') return;
      const el = sectionEl.querySelector(sel);
      if (el) el.textContent = value;
    };
    const setAttr = (sel, attr, value) => {
      if (value == null || value === '') return;
      const el = sectionEl.querySelector(sel);
      if (el) el.setAttribute(attr, value);
    };

    setText('[data-footer-badge]', settings.badge);
    setText('[data-footer-title]', settings.title);
    setText('[data-footer-copy]', settings.copy);
    setAttr('[data-footer-news-placeholder]', 'placeholder', settings.newsPlaceholder);
    setText('[data-footer-news-btn]', settings.newsBtn);

    (settings.chips || []).forEach((chip, i) => setText(`[data-footer-chip="${i}"]`, chip));

    setText('[data-footer-help-title]', settings.helpTitle);
    const helpLinks = FOOTER_HELP_DEFAULT_LINKS.map((fallback, i) => {
      const saved = settings.helpLinks?.[i] || {};
      const savedUrl = `${saved.url || ''}`.trim();
      const url = savedUrl && savedUrl !== '#' && savedUrl !== '#components'
        ? savedUrl
        : fallback.url;
      return {
        text: saved.text || fallback.text,
        url
      };
    });
    helpLinks.forEach((link, i) => {
      setText(`[data-footer-help-link="${i}"]`, link.text);
      setAttr(`[data-footer-help-link="${i}"]`, 'href', link.url);
    });

    setText('[data-footer-contact-title]', settings.contactTitle);
    (settings.contactLines || []).forEach((line, i) => setText(`[data-footer-contact="${i}"]`, line));

    const social = { ...SOCIAL_DEFAULT_LINKS, ...(settings.social || {}) };
    ['instagram', 'tiktok', 'facebook', 'spotify'].forEach(net => {
      setAttr(`[data-footer-social="${net}"]`, 'href', social[net]);
    });

    setText('[data-footer-copyright]', settings.copyright);
    (settings.legalLinks || []).forEach((link, i) => {
      setText(`[data-footer-legal-link="${i}"]`, link?.text);
      setAttr(`[data-footer-legal-link="${i}"]`, 'href', link?.url);
    });
  };

  const setupWhatsAppFloat = (sectionEl, settings = {}, fallback = {}) => {
    if (!sectionEl) return;

    const config = { ...(fallback || {}), ...(settings || {}) };
    const href = `${config.href || ''}`.trim()
      || (config.phone ? `https://wa.me/${`${config.phone}`.replace(/[^\d]/g, '')}` : '')
      || WHATSAPP_DEFAULT_HREF;
    const label = `${config.label || config.ariaLabel || ''}`.trim() || WHATSAPP_DEFAULT_LABEL;

    const link = sectionEl.querySelector('.whatsapp-float') || sectionEl;
    if (link) {
      link.setAttribute('href', href);
      link.setAttribute('aria-label', label);
      link.setAttribute('title', label);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }

    const icon = sectionEl.querySelector('img');
    if (icon) {
      if (config.icon) icon.src = resolveMediaUrl(config.icon);
      icon.alt = config.iconAlt || 'WhatsApp';
    }
  };

  // Rellena la barra de confianza (4 items: tÃ­tulo + descripciÃ³n cada uno) con
  // los datos de wp-admin, y reinicializa el slider (dots + autoplay mobile).
  const setupTrustBar = (sectionEl, settings) => {
    if (settings && Array.isArray(settings.items)) {
      settings.items.forEach((item, i) => {
        const titleEl = sectionEl.querySelector(`[data-trust-title="${i}"]`);
        const descEl = sectionEl.querySelector(`[data-trust-desc="${i}"]`);
        if (titleEl && item?.title) titleEl.textContent = item.title;
        if (descEl && item?.description) descEl.textContent = item.description;
      });
    }
    if (typeof window.initTrustBar === 'function') window.initTrustBar();
  };

  // "ElegÃ­ tu estilo": tÃ­tulos y links editables desde wp-admin.
  // Los videos espejan siempre el video activo del hero.
  const setupStyleEdit = (sectionEl, settings, heroConfig = {}) => {
    const desktopVideo = heroConfig.videoDesktop ? resolveMediaUrl(heroConfig.videoDesktop) : '';
    const mobileVideo = heroConfig.videoMobile ? resolveMediaUrl(heroConfig.videoMobile) : desktopVideo;

    const setHeroVideoSources = (videoEl) => {
      if (!videoEl || (!desktopVideo && !mobileVideo)) return;
      videoEl.removeAttribute('src');
      videoEl.innerHTML = '';

      if (mobileVideo) {
        const sourceMobile = document.createElement('source');
        sourceMobile.src = mobileVideo;
        sourceMobile.type = 'video/mp4';
        sourceMobile.media = '(max-width: 768px)';
        videoEl.appendChild(sourceMobile);
      }

      if (desktopVideo) {
        const sourceDesktop = document.createElement('source');
        sourceDesktop.src = desktopVideo;
        sourceDesktop.type = 'video/mp4';
        sourceDesktop.media = '(min-width: 769px)';
        videoEl.appendChild(sourceDesktop);
      }

      videoEl.load();
    };

    sectionEl.querySelectorAll('[data-style-video]').forEach(setHeroVideoSources);

    if (settings && Array.isArray(settings.tiles)) {
      settings.tiles.forEach((tile, i) => {
        const titleEl = sectionEl.querySelector(`[data-style-title="${i}"]`);
        const linkEl = sectionEl.querySelector(`[data-style-tile="${i}"]`);
        if (titleEl && tile?.title) titleEl.textContent = tile.title;
        if (linkEl && tile?.link) linkEl.setAttribute('href', tile.link);
      });
    }

    initStyleEditVideos(sectionEl);
  };

  const initStyleEditVideos = (sectionEl) => {
    const videos = Array.from(sectionEl.querySelectorAll('[data-style-video]'));
    if (!videos.length) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const prepare = (video) => {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
    };

    const play = (video) => {
      if (prefersReducedMotion) return;
      prepare(video);
      video.play().catch(() => {});
    };

    const pause = (video) => {
      video.pause();
    };

    if (!('IntersectionObserver' in window)) {
      videos.forEach(play);
      return;
    }

    videos.forEach((video) => {
      prepare(video);
      if (video.dataset.styleObserverReady === 'true') {
        play(video);
        return;
      }

      video.dataset.styleObserverReady = 'true';
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) play(entry.target);
          else pause(entry.target);
        });
      }, { rootMargin: '220px 0px', threshold: 0.18 });

      observer.observe(video);

      const rect = video.getBoundingClientRect();
      const isNearViewport = rect.bottom >= -220 && rect.top <= window.innerHeight + 220;
      if (isNearViewport) play(video);
    });
  };

  const SOCIAL_DEFAULT_LINKS = {
    instagram: 'https://www.instagram.com/',
    tiktok: 'https://www.tiktok.com/',
    facebook: 'https://www.facebook.com/',
    spotify: 'https://www.spotify.com/'
  };

  // "#HorizonFit": textos, posts y redes editables desde wp-admin/cache.
  const setupSocialStrip = (sectionEl, settings) => {
    const cfg = settings && typeof settings === 'object' ? settings : {};

    const setText = (sel, value) => {
      if (value == null || value === '') return;
      const el = sectionEl.querySelector(sel);
      if (el) el.textContent = value;
    };
    const setAttr = (sel, attr, value) => {
      if (value == null || value === '') return;
      const el = sectionEl.querySelector(sel);
      if (el) el.setAttribute(attr, value);
    };

    setText('[data-social-kicker]', cfg.kicker);
    setText('[data-social-title]', cfg.title);
    setAttr('[data-social-viewport]', 'aria-label', cfg.viewportLabel);
    setText('[data-social-foot-label]', cfg.footLabel);
    setText('[data-social-foot-handle]', cfg.footHandle);
    setAttr('[data-social-foot-icon-alt]', 'alt', cfg.footIconAlt);
    setAttr('[data-social-foot-link]', 'href', cfg.footLink || SOCIAL_DEFAULT_LINKS.instagram);
    setAttr('[data-social-foot-link]', 'aria-label', cfg.footLinkLabel || cfg.footIconAlt);
    setAttr('[data-social-links-label]', 'aria-label', cfg.linksLabel);

    if (Array.isArray(cfg.posts)) {
      cfg.posts.forEach((post, i) => {
        const imgEl = sectionEl.querySelector(`[data-social-img="${i}"]`);
        const userEl = sectionEl.querySelector(`[data-social-user="${i}"]`);
        const cardEl = sectionEl.querySelector(`[data-social-card="${i}"]`);
        if (imgEl && post?.image) imgEl.setAttribute('src', resolveMediaUrl(post.image));
        if (imgEl && post?.alt) imgEl.setAttribute('alt', post.alt);
        if (userEl && post?.user) userEl.textContent = post.user;
        if (cardEl) cardEl.setAttribute('href', post?.link || SOCIAL_DEFAULT_LINKS.instagram);
        if (cardEl && post?.label) cardEl.setAttribute('aria-label', post.label);
      });
    }

    const socialLinks = { ...SOCIAL_DEFAULT_LINKS, ...(cfg.social || cfg.links || {}) };
    const socialLabels = cfg.socialLabels || {};
    ['instagram', 'tiktok', 'facebook', 'spotify'].forEach(net => {
      setAttr(`[data-social-link="${net}"]`, 'href', socialLinks[net]);
      setAttr(`[data-social-link="${net}"]`, 'aria-label', socialLabels[net]);
      setAttr(`[data-social-icon-alt="${net}"]`, 'alt', socialLabels[net]);
    });
  };

  const setupHero = (sectionEl, config = {}) => {
    const video = sectionEl.querySelector('#heroVideo');
    if (!video) return;

    // Las URLs de los videos vienen de wp-admin (SecciÃ³n hero) o de home.json.
    // Si no estÃ¡n, se usan los atributos data-* del HTML como fallback.
    if (config.videoDesktop) video.setAttribute('data-desktop', resolveMediaUrl(config.videoDesktop));
    if (config.videoMobile) video.setAttribute('data-mobile', resolveMediaUrl(config.videoMobile));

    // Posters por breakpoint: el de mobile cae al de desktop si no se define.
    if (config.poster) video.setAttribute('data-poster-desktop', resolveMediaUrl(config.poster));
    if (config.posterMobile) video.setAttribute('data-poster-mobile', resolveMediaUrl(config.posterMobile));
    const hasPoster = !!(config.poster || config.posterMobile);

    // Fondo oscuro para evitar flash blanco. Con poster el video se muestra de
    // una (el navegador pinta el poster hasta que reproduce). Sin poster, fade-in.
    video.style.backgroundColor = '#0b0b0f';
    if (!hasPoster) {
      video.style.opacity = '0';
      video.style.transition = 'opacity .5s ease';
      const reveal = () => { video.style.opacity = '1'; };
      video.addEventListener('loadeddata', reveal, { once: true });
      video.addEventListener('canplay', reveal, { once: true });
      if (video.readyState >= 2) reveal();
    }

    const setVideoSrc = () => {
      const isMobile = window.innerWidth <= 768;
      const src = isMobile ? video.getAttribute('data-mobile') : video.getAttribute('data-desktop');
      const nextSrc = resolveMediaUrl(src || '');

      // Poster segÃºn breakpoint (mobile cae a desktop si no hay).
      const posterDesktop = video.getAttribute('data-poster-desktop') || '';
      const posterMobile = video.getAttribute('data-poster-mobile') || posterDesktop;
      const poster = isMobile ? posterMobile : posterDesktop;
      if (poster && video.getAttribute('poster') !== poster) {
        video.setAttribute('poster', poster);
      }

      if (video.src !== nextSrc) {
        video.src = nextSrc;
        video.load();
      }
    };

    setVideoSrc();
    window.addEventListener('resize', setVideoSrc);
  };

  // Resuelve el href de un item de menÃº. Las anclas (#seccion) sÃ³lo resuelven
  // en la home; si estamos en otra ruta, las prefijamos con index.html para
  // volver a la home y hacer scroll (igual que los links originales).
  const resolveMenuHref = (url) => {
    if (!url) return '#';
    if (url.startsWith('#')) {
      const isHome = window.location.pathname === '/' ||
        /\/index\.html$/.test(window.location.pathname);
      return isHome ? url : `/${url}`;
    }
    if (/^https?:\/\//.test(url)) return url;
    return rootUrl(url);
  };

  // Rellena ambos menÃºs de la navbar (desktop menu__grid y mobile
  // menu-drawer__nav) con los items administrados desde wp-admin (menu.json).
  const renderNavMenu = async (items) => {
    if (!Array.isArray(items)) items = [];
    items = await filterValidCollectionLinks(items);

    const desktopGrid = document.querySelector('[data-menu-grid]');
    const mobileNav = document.querySelector('[data-menu-drawer-nav]');

    // Desktop: insertar <a role="menuitem"> ANTES del botÃ³n "Abrir carrito".
    if (desktopGrid) {
      const cartBtn = desktopGrid.querySelector('#openCartBtn');
      items.forEach(item => {
        const a = document.createElement('a');
        a.setAttribute('role', 'menuitem');
        a.href = resolveMenuHref(item.url);
        a.textContent = item.label || '';
        desktopGrid.insertBefore(a, cartBtn || null);
      });
    }

    // Mobile: <a class="menu-drawer__link" data-menu-link><strong>..</strong></a>
    if (mobileNav) {
      mobileNav.innerHTML = items.map(item =>
        `<a class="menu-drawer__link" href="${escapeHtml(resolveMenuHref(item.url))}" data-menu-link><strong>${escapeHtml(item.label || '')}</strong></a>`
      ).join('');
    }
  };

  const initNavbarAndMenuDrawer = () => {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => root.querySelectorAll(sel);

    const overlay = $("#overlay");
    const menuBtn = $("#hamburgerBtn") || $("#menuBtn");
    const menuDrawer = $("#menuDrawer");
    const drawer = $("#drawer");
    const searchDrawer = $("#searchDrawer");

    if (!overlay || !menuDrawer || !drawer || !searchDrawer) return;

    let lastFocus = null;

    menuBtn?.setAttribute("aria-controls", "menuDrawer");
    menuBtn?.setAttribute("aria-expanded", "false");

    function openOverlay() {
      overlay.classList.add("is-on");
      overlay.setAttribute("aria-hidden", "false");
    }
    function closeOverlay() {
      overlay.classList.remove("is-on");
      overlay.setAttribute("aria-hidden", "true");
    }

    function openMenuDrawer() {
      lastFocus = document.activeElement;
      openOverlay();
      menuDrawer?.classList.add("is-on");
      menuDrawer?.setAttribute("aria-hidden", "false");
      menuBtn?.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      setTimeout(() => menuDrawer?.querySelector(".menu-drawer__link")?.focus(), 20);
    }
    function closeMenuDrawer() {
      menuDrawer?.classList.remove("is-on");
      menuDrawer?.setAttribute("aria-hidden", "true");
      menuBtn?.setAttribute("aria-expanded", "false");
      closeOverlay();
      document.body.style.overflow = "";
      lastFocus?.focus?.();
    }

    function openDrawer() {
      lastFocus = document.activeElement;
      openOverlay();
      drawer.classList.add("is-on");
      drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function closeDrawer() {
      drawer.classList.remove("is-on");
      drawer.setAttribute("aria-hidden", "true");
      closeOverlay();
      document.body.style.overflow = "";
      lastFocus?.focus?.();
    }

    function openSearchDrawer() {
      lastFocus = document.activeElement;
      openOverlay();
      searchDrawer.classList.add("is-on");
      searchDrawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      setTimeout(() => $("#searchInput")?.focus(), 50);
    }
    function closeSearchDrawer() {
      searchDrawer.classList.remove("is-on");
      searchDrawer.setAttribute("aria-hidden", "true");
      closeOverlay();
      document.body.style.overflow = "";
      lastFocus?.focus?.();
    }

    menuBtn?.addEventListener("click", () => {
      const isOpen = menuDrawer?.getAttribute("aria-hidden") === "false";
      if (isOpen) {
        closeMenuDrawer();
      } else {
        openMenuDrawer();
      }
    });

    $("#cartBtn")?.addEventListener("click", openDrawer);
    $("#openCartBtn")?.addEventListener("click", openDrawer);
    $("#openCartBtn2")?.addEventListener("click", openDrawer);
    $("#searchBtn")?.addEventListener("click", openSearchDrawer);
    $("#searchBtnMobile")?.addEventListener("click", openSearchDrawer);

    $$("[data-menu-link]").forEach(link => {
      link.addEventListener("click", () => closeMenuDrawer());
    });

    $$("[data-close-menu-drawer]").forEach(b => b.addEventListener("click", closeMenuDrawer));
    $$("[data-close-drawer]").forEach(b => b.addEventListener("click", closeDrawer));
    $$("[data-close-search]").forEach(b => b.addEventListener("click", closeSearchDrawer));

    const closeFromBackdrop = (event) => {
      if (event.target !== event.currentTarget) return;
      if (menuDrawer?.classList.contains("is-on")) closeMenuDrawer();
      if (drawer.classList.contains("is-on")) closeDrawer();
      if (searchDrawer.classList.contains("is-on")) closeSearchDrawer();
    };

    overlay.addEventListener("click", closeFromBackdrop);
    [menuDrawer, drawer, searchDrawer].forEach(layer => layer?.addEventListener("click", closeFromBackdrop));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (menuDrawer?.classList.contains("is-on")) closeMenuDrawer();
        if (drawer.classList.contains("is-on")) closeDrawer();
        if (searchDrawer.classList.contains("is-on")) closeSearchDrawer();
      }
    });
  };

  const getProductImages = (product) => {
    const images = product?.imageObjects || product?.images || [];
    return images
      .map((image) => {
        if (typeof image === 'string') return { url: image, alt: product?.name || '' };
        return {
          url: image.large || image.url || image.medium || '',
          fullUrl: image.url || image.large || image.medium || '',
          alt: image.alt || product?.name || ''
        };
      })
      .filter(image => image.url);
  };

  const DEFAULT_CATEGORY_SLUG = 'uncategorized';
  const isDefaultCategory = (category) => `${category?.slug || ''}`.toLowerCase() === DEFAULT_CATEGORY_SLUG;
  const getVisibleCategories = (categories) => Array.isArray(categories)
    ? categories.filter(category => !isDefaultCategory(category))
    : [];

  const getAttributeValues = (product, label) => {
    const attr = product?.attributes?.find(item => {
      const name = `${item.label || item.name || ''}`.toLowerCase();
      return name.includes(label);
    });
    return attr?.values?.map(value => value.name || value.slug).filter(Boolean) || [];
  };

  const normalizeSku = (value) => `${value || ''}`.trim();

  // Clave de "familia" para agrupar las variantes de color de un mismo modelo.
  // Soporta los formatos de SKU estructurado, con o sin espacios alrededor de
  // los guiones (ej. "001-TOP-BLA-S" o "001 - CAL - NEG"): la familia es
  // "NNN-TIPO" (número de modelo + tipo), así TODOS los colores del mismo modelo
  // quedan juntos sin importar la longitud del tipo ni si hay talle.
  // Si el SKU no tiene esa estructura, cae a los primeros 7 caracteres (formato
  // anterior).
  const skuFamilyKey = (value) => {
    const sku = normalizeSku(value).toUpperCase();
    if (!sku) return '';
    // Trim de cada segmento para tolerar "001 - CAL - NEG".
    const segments = sku.split('-').map(s => s.trim()).filter(Boolean);
    if (segments.length >= 3 && /^\d+$/.test(segments[0])) {
      return `${segments[0]}-${segments[1]}`;
    }
    return sku.replace(/\s+/g, '').slice(0, 7);
  };

  const productSkuPrefix = (product) => {
    const skuCandidates = [
      product?.sku,
      ...(Array.isArray(product?.variations) ? product.variations.map(variation => variation?.sku).filter(Boolean) : []),
    ];

    for (const candidate of skuCandidates) {
      const key = skuFamilyKey(candidate);
      if (key) return key;
    }

    return '';
  };

  const skuParts = (value) => {
    const sku = normalizeSku(value).toUpperCase();
    if (!sku) return null;
    const segments = sku.split('-').map(s => s.trim()).filter(Boolean);
    if (segments.length < 2 || !/^\d+$/.test(segments[0])) return null;
    return {
      set: segments[0],
      type: segments[1],
      color: segments[2] || ''
    };
  };

  const productSkuParts = (product) => {
    const skuCandidates = [
      product?.sku,
      ...(Array.isArray(product?.variations) ? product.variations.map(variation => variation?.sku).filter(Boolean) : []),
    ];

    for (const candidate of skuCandidates) {
      const parts = skuParts(candidate);
      if (parts) return parts;
    }

    return null;
  };

  const pushUniqueProduct = (target, item) => {
    if (!item || target.some(existing => existing?.slug === item.slug)) return;
    target.push(item);
  };

  const normalizeMerchToken = (value) => `${value || ''}`
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  const productColorKey = (product) => {
    const attrColor = product?.attributes
      ?.find(item => `${item.label || item.name || ''}`.toLowerCase().includes('color')
        || `${item.label || item.name || ''}`.toLowerCase().includes('colour'))
      ?.values?.[0];
    const rawColor = attrColor?.name || attrColor?.slug || '';
    const text = normalizeMerchToken(rawColor || product?.name || product?.slug || '');
    const colorAliases = {
      NEGRO: 'NEG', NEGRA: 'NEG', BLACK: 'NEG',
      BLANCO: 'BLA', BLANCA: 'BLA', WHITE: 'BLA',
      AZUL: 'AZU', BLUE: 'AZU',
      CELESTE: 'CEL',
      VERDE: 'VER', GREEN: 'VER',
      ROJO: 'ROJ', ROJA: 'ROJ', RED: 'ROJ',
      ROSA: 'ROS', PINK: 'ROS',
      GRIS: 'GRI', GREY: 'GRI', GRAY: 'GRI',
      ARENA: 'ARE', BEIGE: 'BEI', NUDE: 'NUD', CAMEL: 'CAM',
      BORDO: 'BOR', BORDEAUX: 'BOR',
      MARRON: 'MAR', BROWN: 'MAR',
      LILA: 'LIL', VIOLETA: 'VIO', PURPLE: 'VIO',
      NARANJA: 'NAR', AMARILLO: 'AMA', MOSTAZA: 'MOS', TURQUESA: 'TUR'
    };

    for (const word of text.split(/\s+/)) {
      if (colorAliases[word]) return colorAliases[word];
    }
    return '';
  };

  const productTypeKey = (product) => {
    const text = normalizeMerchToken(`${product?.name || ''} ${product?.slug || ''} ${(product?.categories || []).map(item => item.name || item.slug).join(' ')}`);
    const typeAliases = {
      TOP: 'TOP', BRA: 'TOP', CORPINO: 'TOP',
      CALZA: 'CAL', CALSAS: 'CAL', CALSA: 'CAL', LEGGING: 'CAL', LEGGINGS: 'CAL',
      SHORT: 'SHO', SHORTS: 'SHO', BIKER: 'SHO',
      CAMPERA: 'CAM', CAMPERAS: 'CAM',
      BUZO: 'BUZ', BUZOS: 'BUZ', HOODIE: 'BUZ',
      REMERA: 'REM', REMERAS: 'REM', TANK: 'REM',
      PANTALON: 'PAN', PANTALONES: 'PAN', JOGGER: 'PAN',
      SET: 'SET', CONJUNTO: 'SET'
    };

    for (const word of text.split(/\s+/)) {
      if (typeAliases[word]) return typeAliases[word];
    }
    return '';
  };

  const productDescriptorKeys = (product) => {
    const text = normalizeMerchToken(`${product?.name || ''} ${product?.slug || ''}`);
    const typeWords = new Set(['TOP', 'BRA', 'CORPINO', 'CALZA', 'CALSA', 'CALSAS', 'LEGGING', 'LEGGINGS', 'SHORT', 'SHORTS', 'BIKER', 'CAMPERA', 'CAMPERAS', 'BUZO', 'BUZOS', 'HOODIE', 'REMERA', 'REMERAS', 'TANK', 'PANTALON', 'PANTALONES', 'JOGGER', 'SET', 'CONJUNTO']);
    const colorWords = new Set(['NEGRO', 'NEGRA', 'BLACK', 'BLANCO', 'BLANCA', 'WHITE', 'AZUL', 'BLUE', 'CELESTE', 'VERDE', 'GREEN', 'ROJO', 'ROJA', 'RED', 'ROSA', 'PINK', 'GRIS', 'GREY', 'GRAY', 'ARENA', 'BEIGE', 'NUDE', 'CAMEL', 'BORDO', 'BORDEAUX', 'MARRON', 'BROWN', 'LILA', 'VIOLETA', 'PURPLE', 'NARANJA', 'AMARILLO', 'MOSTAZA', 'TURQUESA']);
    const ignored = new Set(['LARGO', 'LARGA', 'CORTO', 'CORTA']);
    const descriptorAliases = {
      LISO: 'LISO', LISA: 'LISO', LISOS: 'LISO', LISAS: 'LISO',
      RUSTICO: 'RUSTICO', RUSTICA: 'RUSTICO',
      TIRA: 'TIRAS', TIRAS: 'TIRAS',
      FRUNCE: 'FRUNCE', CRUZADO: 'CRUZADO', CRUZADA: 'CRUZADO',
      SEAMLESS: 'SEAMLESS', PUSH: 'PUSH', UP: 'UP'
    };

    return new Set(text.split(/\s+/)
      .map(word => descriptorAliases[word] || word)
      .filter(word => word && !typeWords.has(word) && !colorWords.has(word) && !ignored.has(word)));
  };

  const shareDescriptor = (product, candidate) => {
    const currentDescriptors = productDescriptorKeys(product);
    const candidateDescriptors = productDescriptorKeys(candidate);
    if (!currentDescriptors.size || !candidateDescriptors.size) return false;
    return Array.from(currentDescriptors).some(token => candidateDescriptors.has(token));
  };

  const buyWithTypeRank = (currentType, item) => {
    const candidateType = productTypeKey(item);
    const preferences = {
      TOP: ['CAL', 'SHO', 'PAN', 'CAM', 'BUZ', 'REM'],
      CAL: ['TOP', 'CAM', 'BUZ', 'REM', 'SHO'],
      SHO: ['TOP', 'REM', 'CAM', 'BUZ', 'CAL'],
      CAM: ['CAL', 'TOP', 'SHO', 'PAN'],
      BUZ: ['CAL', 'TOP', 'SHO', 'PAN'],
      REM: ['CAL', 'SHO', 'TOP'],
      PAN: ['TOP', 'REM', 'CAM', 'BUZ']
    };
    const rank = preferences[currentType]?.indexOf(candidateType) ?? -1;
    return rank === -1 ? 99 : rank;
  };

  const sortBuyWithItems = (items, currentType) => {
    return [...items].sort((a, b) => {
      const rankDiff = buyWithTypeRank(currentType, a) - buyWithTypeRank(currentType, b);
      if (rankDiff) return rankDiff;
      return `${a?.name || ''}`.localeCompare(`${b?.name || ''}`, 'es');
    });
  };

  const getBuyWithProducts = (product, products) => {
    const related = (products || []).filter(item => item?.slug !== product?.slug);
    const currentParts = productSkuParts(product);
    const currentType = productTypeKey(product);
    const selected = [];
    const skuSetItems = [];
    const skuColorItems = [];

    if (currentParts) {
      related.forEach(item => {
        const parts = productSkuParts(item);
        if (!parts) return;
        const sameSet = parts.set === currentParts.set;
        const sameColor = !currentParts.color || parts.color === currentParts.color;
        if (sameSet && sameColor) pushUniqueProduct(skuSetItems, item);
      });

      related.forEach(item => {
        const parts = productSkuParts(item);
        if (!parts) return;
        const sameType = parts.type === currentParts.type;
        const otherColor = !currentParts.color || parts.color !== currentParts.color;
        if (sameType && otherColor) pushUniqueProduct(skuColorItems, item);
      });
    }

    sortBuyWithItems(skuSetItems, currentType).forEach(item => pushUniqueProduct(selected, item));

    const currentCollections = (product?.collections || []).map(c => c.slug);
    const currentCategories = (product?.categories || [])
      .map(c => c.slug)
      .filter(slug => slug && slug !== 'uncategorized');

    const collectionItems = currentCollections.length
      ? related.filter(item => (item.collections || []).some(c => currentCollections.includes(c.slug)))
      : [];
    collectionItems.forEach(item => pushUniqueProduct(selected, item));

    const currentColor = productColorKey(product);
    const inferredSetItems = [];

    related.forEach(item => {
      const sameColor = currentColor && productColorKey(item) === currentColor;
      const differentType = currentType && productTypeKey(item) && productTypeKey(item) !== currentType;
      if (sameColor && differentType && shareDescriptor(product, item)) {
        pushUniqueProduct(inferredSetItems, item);
      }
    });

    sortBuyWithItems(inferredSetItems, currentType).forEach(item => pushUniqueProduct(selected, item));

    related.forEach(item => {
      const sameType = currentType && productTypeKey(item) === currentType;
      const otherColor = currentColor && productColorKey(item) && productColorKey(item) !== currentColor;
      if (sameType && otherColor && shareDescriptor(product, item)) {
        pushUniqueProduct(selected, item);
      }
    });

    skuColorItems.forEach(item => pushUniqueProduct(selected, item));

    if (selected.length) return selected;

    return currentCategories.length
      ? related.filter(item => (item.categories || []).some(c => currentCategories.includes(c.slug)))
      : [];
  };

  const normalizeCollectionText = (value) => `${value || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const isSetCollection = (collection) => {
    const text = normalizeCollectionText(`${collection?.name || ''} ${collection?.slug || ''}`);
    return /\b(conjunto|set)\b/.test(text);
  };

  const PDP_SET_TYPE_ORDER = ['TOP', 'SHO', 'FAL', 'CAL', 'CAM'];

  const sortSetLineProducts = (items) => [...items].sort((a, b) => {
    const aParts = productSkuParts(a);
    const bParts = productSkuParts(b);
    if (aParts && bParts) {
      const typeDiff = getTokenOrder(PDP_SET_TYPE_ORDER, aParts.type) - getTokenOrder(PDP_SET_TYPE_ORDER, bParts.type);
      if (typeDiff) return typeDiff;
    }
    return `${a?.name || ''}`.localeCompare(`${b?.name || ''}`, 'es');
  });

  const getPdpSetLineProducts = (product, products) => {
    const related = (products || []).filter(item => item?.slug !== product?.slug);
    const currentParts = productSkuParts(product);
    const currentType = currentParts?.type || productTypeKey(product);
    const selected = [];
    const skuSameTypeItems = [];
    const inferredSameTypeItems = [];

    if (!currentType) return [];

    related.forEach(item => {
      const parts = productSkuParts(item);
      if (parts?.type === currentType) pushUniqueProduct(skuSameTypeItems, item);
    });

    related.forEach(item => {
      const parts = productSkuParts(item);
      if (parts?.type) return;
      if (productTypeKey(item) === currentType) pushUniqueProduct(inferredSameTypeItems, item);
    });

    sortSetLineProducts(skuSameTypeItems).forEach(item => pushUniqueProduct(selected, item));
    inferredSameTypeItems
      .sort((a, b) => `${a?.name || ''}`.localeCompare(`${b?.name || ''}`, 'es'))
      .forEach(item => pushUniqueProduct(selected, item));

    if (selected.length) return selected;

    const currentCategories = (product?.categories || [])
      .map(category => category.slug)
      .filter(slug => slug && slug !== DEFAULT_CATEGORY_SLUG);

    return currentCategories.length
      ? related.filter(item => (item.categories || []).some(category => currentCategories.includes(category.slug)))
      : [];
  };

  const productFamilyKey = (product) => {
    const slug = `${product?.slug || ''}`.toLowerCase().trim();
    if (!slug) return '';

    const colorWords = ['blanco', 'negro', 'bordo', 'bordó', 'bordeaux', 'azul', 'celeste', 'verde', 'gris', 'arena', 'nude', 'rojo', 'rosa', 'fucsia', 'naranja', 'amarillo', 'mostaza', 'beige', 'crema', 'camel', 'turquesa', 'marron', 'marrón', 'lila', 'violeta'];
    let family = slug;
    colorWords.forEach(color => {
      family = family.replace(new RegExp(`(^|[-_])${color}($|[-_])`, 'g'), '$1$2');
    });

    return family.replace(/[-_]{2,}/g, '-').replace(/[-_]+$/g, '').replace(/^[-_]+/g, '');
  };

  const sameColorFamily = (product, candidate) => {
    if (!product || !candidate || product.slug === candidate.slug) return false;

    const productPrefix = productSkuPrefix(product);
    const candidatePrefix = productSkuPrefix(candidate);
    if (productPrefix && candidatePrefix) {
      return productPrefix === candidatePrefix;
    }

    const productFamily = productFamilyKey(product);
    const candidateFamily = productFamilyKey(candidate);
    return !!productFamily && productFamily === candidateFamily;
  };

  const getColorVariants = (product, products) => {
    return (products || []).filter(candidate => sameColorFamily(product, candidate));
  };

  const productMatchesSlug = (product, slug) => {
    const targetSlug = normalizeProductSlug(slug);
    if (!targetSlug) return false;
    return [product?.slug, product?.post_name, product?.handle, getProductPermalinkSlug(product), product?.name]
      .map(normalizeProductSlug)
      .filter(Boolean)
      .some(value => value === targetSlug);
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

  const decodeEntities = (value) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  };

  const plainTextFromHtml = (value) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = decodeEntities(value);
    return wrapper.textContent || wrapper.innerText || '';
  };

  const splitSentences = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

  const productDescriptionHtml = (value) => {
    const text = plainTextFromHtml(value)
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) {
      return '<p>Diseño, textura y comodidad en equilibrio. Este producto está pensado para acompañar cada movimiento sin perder estilo ni confort.</p>';
    }

    const sentences = splitSentences(text)
      .map(sentence => sentence.trim())
      .filter(Boolean);
    const selected = sentences.slice(0, 4);

    if (!selected.length) {
      return `<p>${escapeHtml(text)}</p>`;
    }

    const paragraphs = [
      selected.slice(0, 1).join(' '),
      selected.slice(1, 3).join(' '),
      selected.slice(3, 4).join(' ')
    ].filter(Boolean);

    return paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
  };

  const careDescriptionHtml = () => {
    const paragraphs = [
      'Para conservar el calce, el color y la suavidad, lavá la prenda con agua fría y jabón neutro, cuidando la tela para que mantenga su forma en cada uso.',
      'Su cuidado combina lavado delicado, separación de tonos y secado paciente para que puedas usarla tanto en entrenamiento como en momentos cotidianos sin afectar elasticidad, textura ni terminación.',
      'Evitá lavandina, remojos largos, secadora y calor directo; secala a la sombra, sin retorcer, y no planches logos, estampas o avíos para preservar el acabado.'
    ];

    return paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
  };

  const normalizeSearchText = (value) => decodeEntities(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  const normalizeStatus = (value, fallback = 'publish') => {
    const status = `${value ?? fallback}`.trim().toLowerCase();
    return status || fallback;
  };

  const normalizeStockStatus = (value) => {
    const status = `${value ?? ''}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!status) return '';
    if (['outofstock', 'soldout', 'agotado'].includes(status)) return 'outofstock';
    if (['instock', 'available', 'disponible'].includes(status)) return 'instock';
    if (['onbackorder', 'backorder'].includes(status)) return 'onbackorder';
    return status;
  };

  const hasPositiveNumber = (value) => {
    if (value === null || value === undefined || value === '') return false;
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  };

  const getProductStatus = (product) => normalizeStatus(product?.status || product?.post_status || product?.postStatus, 'publish');

  const getProductStockStatus = (product) => normalizeStockStatus(
    product?.stockStatus
    || product?.stock_status
    || product?.stockAvailability?.class
    || product?.stock_availability?.class
    || product?.stock_availability?.text
  );

  const getProductPriceValue = (product) => {
    const candidates = [
      product?.price,
      product?.prices?.price,
      product?.regularPrice,
      product?.salePrice,
      product?.price_amount,
      product?.priceAmount
    ];

    for (const candidate of candidates) {
      if (hasPositiveNumber(candidate)) return Number(candidate);
    }

    if (Array.isArray(product?.variations)) {
      for (const variation of product.variations) {
        const variationPrice = getProductPriceValue(variation);
        if (hasPositiveNumber(variationPrice)) return Number(variationPrice);
      }
    }

    return null;
  };

  const formatMajorMoney = (amount, currency = {}) => {
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));
    return `${currency.currency_prefix || '$ '}${formatted}${currency.currency_suffix || ''}`.trim();
  };

  const getSetTotalPriceValue = (setOrItems) => {
    const items = Array.isArray(setOrItems) ? setOrItems : setOrItems?.products;
    if (!Array.isArray(items)) return null;
    const total = items.reduce((sum, item) => {
      const availability = getVisibleProductAvailability(item);
      return availability.hasPrice ? sum + availability.priceValue : sum;
    }, 0);
    return total > 0 ? total : null;
  };

  const getSetTotalPriceText = (setOrItems) => {
    const total = getSetTotalPriceValue(setOrItems);
    return Number.isFinite(total) && total > 0 ? formatMajorMoney(total) : '';
  };

  const getProductPriceMinorUnit = (product) => {
    const minorUnit = Number(product?.prices?.currency_minor_unit);
    if (Number.isFinite(minorUnit) && minorUnit >= 0) return minorUnit;
    return 2;
  };

  const getProductDisplayPriceText = (product) => {
    const text = plainTextFromHtml(product?.priceText || product?.price_html || '').trim();
    if (text) return text;
    if (product?.prices && hasPositiveNumber(product?.prices?.price)) {
      return formatStoreMoney(product.prices.price, product.prices);
    }
    return '';
  };

  const getProductCompareText = (product) => {
    const text = plainTextFromHtml(product?.priceOriginal || product?.regularPriceText || '').trim();
    if (text) return text;
    if (product?.prices && hasPositiveNumber(product?.prices?.regular_price)) {
      return formatStoreMoney(product.prices.regular_price, product.prices);
    }
    return '';
  };

  const getProductInstallmentsText = (product) => {
    return `${product?.installmentsText || ''}`.trim();
  };

  const getProductTransferText = (product) => {
    return `${product?.transferText || ''}`.trim();
  };

  const getVisibleProductAvailability = (product) => {
    if (!product || typeof product !== 'object') {
      return {
        status: 'draft',
        stockStatus: '',
        priceValue: null,
        hasPrice: false,
        priceText: '',
        compareText: '',
        installmentsText: '',
        transferText: '',
        isVisible: false,
        canPurchase: false,
        label: '',
        badge: ''
      };
    }
    const status = getProductStatus(product);
    const stockStatus = getProductStockStatus(product);
    const priceValue = getProductPriceValue(product);
    const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
    const isVisible = status === 'publish';
    const canPurchase = isVisible && hasPrice && stockStatus !== 'outofstock';
    return {
      status,
      stockStatus,
      priceValue,
      hasPrice,
      priceText: hasPrice ? getProductDisplayPriceText(product) : '',
      compareText: hasPrice ? getProductCompareText(product) : '',
      installmentsText: hasPrice ? getProductInstallmentsText(product) : '',
      transferText: hasPrice ? getProductTransferText(product) : '',
      isVisible,
      canPurchase,
      label: !isVisible ? '' : stockStatus === 'outofstock' ? 'Agotado' : !hasPrice ? 'Sin precio' : 'Disponible',
      badge: !isVisible ? '' : stockStatus === 'outofstock' ? 'Agotado' : !hasPrice ? 'Sin precio' : `${product?.badge || ''}`.trim()
    };
  };

  const getSelectedProductAvailability = (product, variation = null) => {
    if (!product || typeof product !== 'object') {
      return {
        status: 'draft',
        stockStatus: '',
        priceValue: null,
        hasPrice: false,
        priceText: '',
        compareText: '',
        installmentsText: '',
        transferText: '',
        canPurchase: false,
        label: ''
      };
    }
    const status = getProductStatus(product);
    const stockStatus = getProductStockStatus(variation || product);
    const priceValue = getProductPriceValue(variation || product);
    const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
    const isVariableProduct = Array.isArray(product?.variations) && product.variations.length > 0;
    const canPurchase = status === 'publish' && hasPrice && stockStatus !== 'outofstock' && (!isVariableProduct || Boolean(variation));
    const pricedProduct = variation || product;
    const selectedPriceText = `${variation?.priceText || variation?.price_html || product?.priceText || product?.price_html || ''}`.trim()
      || getProductDisplayPriceText(pricedProduct);
    return {
      status,
      stockStatus,
      priceValue,
      hasPrice,
      priceText: hasPrice ? selectedPriceText : '',
      compareText: hasPrice ? `${variation?.priceOriginal || variation?.regularPriceText || variation?.salePriceText || ''}`.trim() : '',
      installmentsText: hasPrice ? getProductInstallmentsText(pricedProduct) : '',
      transferText: hasPrice ? getProductTransferText(pricedProduct) : '',
      canPurchase,
      label: status !== 'publish' ? '' : !Boolean(variation) && isVariableProduct ? 'Elegi una variante' : stockStatus === 'outofstock' ? 'Agotado' : !hasPrice ? 'Sin precio' : 'Disponible'
    };
  };

  const filterVisibleProducts = (items) => Array.isArray(items)
    ? items.filter(product => product && typeof product === 'object' && getVisibleProductAvailability(product).isVisible)
    : [];

  const commerceState = {
    cart: null,
    nonce: '',
    cartToken: (() => {
      try {
        return window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) || '';
      } catch (error) {
        return '';
      }
    })(),
    busy: false,
    productsPromise: null,
    searchCatalogPromise: null,
    searchIndexPromise: null
  };

  const rememberCartHeaders = (response) => {
    const nonce = response.headers.get('Nonce');
    const cartToken = response.headers.get('Cart-Token');
    if (nonce) commerceState.nonce = nonce;
    if (cartToken) {
      commerceState.cartToken = cartToken;
      try {
        window.localStorage.setItem(CART_TOKEN_STORAGE_KEY, cartToken);
      } catch (error) {
        // Storage can be unavailable in private browsing; Woo cookies still carry the session.
      }
    }
  };

  const storeApiFetch = async (path, options = {}) => {
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (commerceState.nonce) headers.Nonce = commerceState.nonce;
    if (commerceState.cartToken) headers['Cart-Token'] = commerceState.cartToken;

    const response = await fetch(`${WOO_STORE_API_BASE}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    rememberCartHeaders(response);

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || data?.errors?.[0]?.message || `Woo Store API error ${response.status}`;
      throw new Error(decodeEntities(message));
    }
    return data;
  };

  const hfRestFetch = async (path, body, options = {}) => {
    const method = (options.method || 'POST').toUpperCase();
    const requestInit = {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    };
    if (!['GET', 'HEAD'].includes(method)) {
      requestInit.headers['Content-Type'] = requestInit.headers['Content-Type'] || 'application/json';
      requestInit.body = JSON.stringify(body || {});
    }

    const response = await fetch(`${HF_REST_BASE}${path}`, requestInit);
    if (options.skipBody) {
      if (!response.ok) {
        throw new Error(`Horizon Fit API error ${response.status}`);
      }
      return {};
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(decodeEntities(data?.message || `Horizon Fit API error ${response.status}`));
    }
    return data;
  };

  const formatStoreMoney = (rawValue, currency = {}) => {
    const minorUnit = Number.isFinite(Number(currency.currency_minor_unit)) ? Number(currency.currency_minor_unit) : 2;
    const amount = Number(rawValue || 0) / Math.pow(10, minorUnit);
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: minorUnit,
      maximumFractionDigits: minorUnit
    }).format(amount);
    return `${currency.currency_prefix || '$ '}${formatted}${currency.currency_suffix || ''}`.trim();
  };

  const getCartCurrency = (cart) => cart?.totals || cart?.items?.[0]?.prices || {
    currency_symbol: '$',
    currency_prefix: '$ ',
    currency_suffix: '',
    currency_minor_unit: 2
  };

  const getCartItemImage = (item) => {
    const image = Array.isArray(item?.images) ? item.images[0] : null;
    return image?.thumbnail || image?.src || '';
  };

  const getCartItemDetails = (item) => {
    const variation = Array.isArray(item?.variation) ? item.variation : [];
    return variation
      .map(entry => [entry.attribute, entry.value].filter(Boolean).join(': '))
      .filter(Boolean)
      .join(' / ');
  };

  const setCartBusy = (isBusy) => {
    commerceState.busy = isBusy;
    document.querySelectorAll('[data-cart-action], #applyCouponBtn, #goCheckoutBtn')
      .forEach(el => {
        if (isBusy) el.setAttribute('disabled', '');
        else el.removeAttribute('disabled');
      });
  };

  const renderCartDrawer = (cart = commerceState.cart, message = '') => {
    const drawer = document.querySelector('#drawer');
    if (!drawer) return;

    const body = drawer.querySelector('.drawer__bd');
    const field = drawer.querySelector('.field');
    const empty = drawer.querySelector('[data-cart-empty]');
    const subtotal = drawer.querySelector('#cartSubtotal');
    const couponHint = drawer.querySelector('#couponHint');
    if (!body) return;

    let list = drawer.querySelector('[data-cart-list]');
    if (!list) {
      list = document.createElement('div');
      list.setAttribute('data-cart-list', '');
      body.insertBefore(list, field || body.firstChild || null);
    }

    const items = Array.isArray(cart?.items) ? cart.items : [];
    if (empty) empty.hidden = items.length > 0;
    if (subtotal) subtotal.textContent = formatStoreMoney(cart?.totals?.total_items || cart?.totals?.total_price || 0, getCartCurrency(cart));
    if (couponHint) couponHint.textContent = message || 'Tip: proba HF-15';

    if (!items.length) {
      list.innerHTML = '';
      list.hidden = true;
      return;
    }

    list.hidden = false;
    const currency = getCartCurrency(cart);
    const coupons = Array.isArray(cart?.coupons) ? cart.coupons : [];
    list.innerHTML = `
      <div class="hf-cart-list">
        ${items.map(item => {
          const image = getCartItemImage(item);
          const details = getCartItemDetails(item);
          return `
            <article class="hf-cart-item">
              <a class="hf-cart-item__media" href="${productUrl(item)}" aria-label="Ver ${escapeHtml(decodeEntities(item.name || 'producto'))}">
                ${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}
              </a>
              <div class="hf-cart-item__body">
                <a class="hf-cart-item__title" href="${productUrl(item)}">${escapeHtml(decodeEntities(item.name || 'Producto'))}</a>
                ${details ? `<div class="hf-cart-item__meta">${escapeHtml(decodeEntities(details))}</div>` : ''}
                <div class="hf-cart-item__row">
                  <div class="hf-cart-item__qty" aria-label="Cantidad">
                    <button type="button" data-cart-action="qty" data-key="${escapeHtml(item.key)}" data-quantity="${Math.max(0, Number(item.quantity || 1) - 1)}" aria-label="Restar">-</button>
                    <span>${Number(item.quantity || 0)}</span>
                    <button type="button" data-cart-action="qty" data-key="${escapeHtml(item.key)}" data-quantity="${Number(item.quantity || 0) + 1}" aria-label="Sumar">+</button>
                  </div>
                  <strong>${formatStoreMoney(item?.totals?.line_total || 0, currency)}</strong>
                </div>
                <button class="hf-cart-item__remove" type="button" data-cart-action="remove" data-key="${escapeHtml(item.key)}">Eliminar</button>
              </div>
            </article>`;
        }).join('')}
        ${coupons.length ? `
          <div class="hf-cart-coupons" aria-label="Cupones aplicados">
            ${coupons.map(coupon => `
              <button type="button" data-cart-action="remove-coupon" data-code="${escapeHtml(coupon.code || '')}">
                ${escapeHtml(coupon.code || '')} <span>quitar</span>
              </button>
            `).join('')}
          </div>` : ''}
      </div>`;
  };

  const refreshCart = async (message = '') => {
    const cart = await storeApiFetch('/cart');
    commerceState.cart = cart;
    renderCartDrawer(cart, message);
    return cart;
  };

  const ensureCartSession = async () => {
    if (commerceState.nonce && commerceState.cartToken) {
      return commerceState.cart;
    }

    try {
      return await refreshCart();
    } catch (error) {
      if (commerceState.cart) {
        return commerceState.cart;
      }
      throw error;
    }
  };

  const mutateCart = async (path, body, message = '', retry = true) => {
    setCartBusy(true);
    try {
      commerceState.cart = await storeApiFetch(path, { method: 'POST', body });
      renderCartDrawer(commerceState.cart, message);
      return commerceState.cart;
    } catch (error) {
      if (retry && /nonce/i.test(error.message || '')) {
        try {
          await refreshCart();
          return await mutateCart(path, body, message, false);
        } catch (retryError) {
          renderCartDrawer(commerceState.cart, retryError.message || 'No pudimos actualizar el carrito.');
          throw retryError;
        }
      }
      renderCartDrawer(commerceState.cart, error.message || 'No pudimos actualizar el carrito.');
      throw error;
    } finally {
      setCartBusy(false);
    }
  };

  const cartItemsForCheckoutSync = (cart = commerceState.cart) => {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    return items.map(item => ({
      id: Number(item.id || 0),
      quantity: Number(item.quantity || 1),
      variation: Array.isArray(item.variation) ? item.variation.map(entry => ({
        attribute: entry.attribute || '',
        value: entry.value || ''
      })) : []
    })).filter(item => item.id && item.quantity > 0);
  };

  const cartCouponsForCheckoutSync = (cart = commerceState.cart) => {
    const coupons = Array.isArray(cart?.coupons) ? cart.coupons : [];
    return coupons
      .map(coupon => `${coupon?.code || ''}`.trim())
      .filter(Boolean);
  };

  const syncCartForCheckout = async () => {
    const items = cartItemsForCheckoutSync();
    if (!items.length) {
      throw new Error('Agrega un producto para ir al checkout.');
    }
    return STORE_CHECKOUT_URL;
  };

  const storeProductToSearchItem = (item) => {
    const priceValue = hasPositiveNumber(item?.prices?.price) ? Number(item.prices.price) : null;
    const regularPriceValue = hasPositiveNumber(item?.prices?.regular_price) ? Number(item.prices.regular_price) : null;
    const salePriceValue = hasPositiveNumber(item?.prices?.sale_price) ? Number(item.prices.sale_price) : null;
    const priceText = plainTextFromHtml(item?.price_html || '') || (priceValue ? formatStoreMoney(priceValue, item?.prices || {}) : '');
    const regularPriceText = regularPriceValue ? formatStoreMoney(regularPriceValue, item?.prices || {}) : '';
    const salePriceText = salePriceValue ? formatStoreMoney(salePriceValue, item?.prices || {}) : '';
    return {
      id: item?.id,
      slug: item?.slug,
      name: decodeEntities(item?.name || ''),
      status: item?.status || 'publish',
      stockStatus: normalizeStockStatus(item?.stock_status || item?.stock_availability?.class || item?.stock_availability?.text),
      price: priceValue,
      regularPrice: regularPriceValue,
      salePrice: salePriceValue,
      priceText,
      priceOriginal: regularPriceText && regularPriceText !== priceText ? regularPriceText : '',
      regularPriceText,
      salePriceText,
      categories: item?.categories || [],
      hasOptions: Boolean(item?.has_options),
      isPurchasable: item?.is_purchasable !== false,
      images: (item?.images || []).map(image => image?.thumbnail || image?.src).filter(Boolean),
      imageObjects: (item?.images || []).map(image => ({
        url: image?.thumbnail || image?.src || '',
        large: image?.src || image?.thumbnail || '',
        alt: image?.alt || item?.name || ''
      })),
      searchText: normalizeSearchText([
        item?.name,
        item?.sku,
        item?.slug,
        ...(item?.categories || []).map(entry => entry?.name || entry?.slug),
        ...(item?.collections || []).map(entry => entry?.name || entry?.slug),
        ...(item?.tags || []).map(entry => entry?.name || entry?.slug)
      ].filter(Boolean).join(' '))
    };
  };

  const productSearchHaystack = (product) => product?.searchText || normalizeSearchText([
    product?.name,
    product?.sku,
    product?.slug,
    ...(product?.categories || []).map(item => item.name || item.slug),
    ...(product?.collections || []).map(item => item.name || item.slug),
    ...(product?.tags || []).map(item => item.name || item.slug)
  ].filter(Boolean).join(' '));

  const buildSearchIndex = (products) => (Array.isArray(products) ? products : [])
    .reduce((index, product) => {
      if (!product || typeof product !== 'object') return index;
      if (!getVisibleProductAvailability(product).isVisible) return index;
      index.push({
        product,
        searchText: productSearchHaystack(product)
      });
      return index;
    }, []);

  const getSearchCatalog = () => {
    if (!commerceState.searchCatalogPromise) {
      commerceState.searchCatalogPromise = Promise.resolve()
        .then(() => fetchJson(PRODUCT_DATA_SRC))
        .then(data => {
          const productMap = new Map();
          collectProducts(data, productMap);
          return filterVisibleProducts(Array.from(productMap.values()));
        })
        .catch(() => []);
    }
    return commerceState.searchCatalogPromise;
  };

  const getSearchProducts = async (getProducts) => {
    if (!commerceState.searchIndexPromise) {
      commerceState.searchIndexPromise = getSearchCatalog()
        .then(buildSearchIndex)
        .then(index => {
          if (index.length) return index;
          if (!commerceState.productsPromise) {
            commerceState.productsPromise = Promise.resolve(getProducts()).catch(() => []);
          }
          return commerceState.productsPromise
            .then(buildSearchIndex)
            .catch(() => []);
        })
        .catch(() => []);
    }
    return commerceState.searchIndexPromise;
  };

  const renderSearchResults = (results, query, isLoading = false) => {
    const target = document.querySelector('#searchResults');
    if (!target) return;
    if (isLoading) {
      target.innerHTML = '<div class="hf-search-state">Buscando...</div>';
      return;
    }
    if (!query) {
      target.innerHTML = '<div class="hf-search-state">Escribi para encontrar productos.</div>';
      return;
    }
    if (!results.length) {
      target.innerHTML = '<div class="hf-search-state">No encontramos productos para esa busqueda.</div>';
      return;
    }
    const visibleResults = filterVisibleProducts(results);
    if (!visibleResults.length) {
      target.innerHTML = '<div class="hf-search-state">No encontramos productos para esa busqueda.</div>';
      return;
    }
    target.innerHTML = `
      <div class="hf-search-results">
        ${visibleResults.map(product => {
          const availability = getVisibleProductAvailability(product);
          const image = getProductImages(product)[0]?.url || '';
          const category = getVisibleCategories(product.categories).map(item => item.name).filter(Boolean)[0] || '';
          return `
            <a class="hf-search-result" href="${productUrl(product)}">
              <span class="hf-search-result__media">${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}</span>
              <span class="hf-search-result__body">
                <strong>${escapeHtml(decodeEntities(product.name || 'Producto'))}</strong>
                ${category ? `<small>${escapeHtml(decodeEntities(category))}</small>` : ''}
                ${!availability.canPurchase && availability.label ? `<small>${escapeHtml(decodeEntities(availability.label))}</small>` : ''}
              </span>
              ${availability.priceText ? `<span class="hf-search-result__price">${escapeHtml(decodeEntities(availability.priceText))}</span>` : ''}
            </a>`;
        }).join('')}
      </div>`;
  };

  const initStorefrontCommerce = ({ getProducts }) => {
    const drawer = document.querySelector('#drawer');
    const searchInput = document.querySelector('#searchInput');
    const searchSubmit = document.querySelector('#searchSubmitBtn');
    const couponInput = document.querySelector('[data-cart-coupon]');
    const applyCoupon = document.querySelector('#applyCouponBtn');
    const checkoutButton = document.querySelector('#goCheckoutBtn');
    const userButton = document.querySelector('#userBtn');
    let searchTimer = null;
    let searchRunToken = 0;

    if (drawer) {
      drawer.addEventListener('click', async (event) => {
        const action = event.target.closest('[data-cart-action]');
        if (!action || commerceState.busy) return;
        event.preventDefault();
        const key = action.getAttribute('data-key');
        const code = action.getAttribute('data-code');
        try {
          if (action.dataset.cartAction === 'qty' && key) {
            await mutateCart('/cart/update-item', { key, quantity: Number(action.dataset.quantity || 0) }, 'Carrito actualizado.');
          }
          if (action.dataset.cartAction === 'remove' && key) {
            await mutateCart('/cart/remove-item', { key }, 'Producto eliminado.');
          }
          if (action.dataset.cartAction === 'remove-coupon' && code) {
            await mutateCart('/cart/remove-coupon', { code }, 'Cupon eliminado.');
          }
        } catch (error) {
          console.warn('[HF PB] Cart mutation failed:', error.message);
        }
      });
    }

    applyCoupon?.addEventListener('click', async (event) => {
      event.preventDefault();
      const code = `${couponInput?.value || ''}`.trim();
      if (!code) {
        renderCartDrawer(commerceState.cart, 'Ingresa un codigo para aplicar.');
        return;
      }
      try {
        await mutateCart('/cart/apply-coupon', { code }, 'Descuento aplicado.');
        if (couponInput) couponInput.value = '';
      } catch (error) {
        console.warn('[HF PB] Coupon failed:', error.message);
      }
    });

    checkoutButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!commerceState.cart || Number(commerceState.cart.items_count || 0) === 0) {
        renderCartDrawer(commerceState.cart, 'Agrega un producto para ir al checkout.');
        return;
      }
      setCartBusy(true);
      try {
        const checkoutUrl = await syncCartForCheckout();
        window.location.assign(checkoutUrl);
      } catch (error) {
        renderCartDrawer(commerceState.cart, error.message || 'No pudimos preparar el checkout.');
        setCartBusy(false);
      }
    });

    userButton?.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.assign(STORE_ACCOUNT_URL);
    });

    const runSearch = async () => {
      const runToken = ++searchRunToken;
      const query = `${searchInput?.value || ''}`.trim();
      const normalizedQuery = normalizeSearchText(query);
      if (!normalizedQuery) {
        renderSearchResults([], '');
        return;
      }
      let loadingTimer = window.setTimeout(() => {
        if (runToken === searchRunToken) {
          renderSearchResults([], query, true);
        }
      }, 160);

      const searchIndex = await getSearchProducts(getProducts);
      window.clearTimeout(loadingTimer);
      if (runToken !== searchRunToken) return;

      let results = (Array.isArray(searchIndex) ? searchIndex : [])
        .filter(entry => entry?.searchText && entry.searchText.includes(normalizedQuery))
        .slice(0, 8)
        .map(entry => entry.product);

      if (!results.length && normalizedQuery.length >= 3) {
        loadingTimer = window.setTimeout(() => {
          if (runToken === searchRunToken) {
            renderSearchResults([], query, true);
          }
        }, 160);
        try {
          const remote = await storeApiFetch(`/products?per_page=8&search=${encodeURIComponent(query)}`);
          if (runToken !== searchRunToken) return;
          results = (Array.isArray(remote) ? remote : []).map(storeProductToSearchItem);
        } catch (error) {
          console.warn('[HF PB] Store search fallback failed:', error.message);
        }
      }

      window.clearTimeout(loadingTimer);
      if (runToken !== searchRunToken) return;
      renderSearchResults(results, query);
    };

    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 120);
    });
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });
    searchSubmit?.addEventListener('click', (event) => {
      event.preventDefault();
      runSearch();
    });
    document.querySelectorAll('[data-search-term]').forEach(button => {
      button.addEventListener('click', () => {
        if (searchInput) searchInput.value = button.getAttribute('data-search-term') || '';
        runSearch();
      });
    });

    getSearchProducts(getProducts).catch(error => {
      console.warn('[HF PB] Search index unavailable:', error.message);
    });
    renderSearchResults([], '');
    refreshCart().catch(error => {
      console.warn('[HF PB] Cart unavailable:', error.message);
      renderCartDrawer(null, 'No pudimos cargar el carrito.');
    });
  };

  const DEFAULT_CARE = {
    title: 'Lavado y cuidado',
    text: 'Para conservar el calce, el color y la suavidad, lavá la prenda con agua fría y jabón neutro, cuidando la tela para que mantenga su forma en cada uso. Su cuidado combina lavado delicado, separación de tonos y secado paciente para que puedas usarla tanto en entrenamiento como en momentos cotidianos sin afectar elasticidad, textura ni terminación. Evitá lavandina, remojos largos, secadora y calor directo; secala a la sombra, sin retorcer, y no planches logos, estampas o avíos para preservar el acabado.',
    bullets: [
      'Lavar con agua fría y jabón neutro.',
      'Usar lavado a mano o ciclo delicado.',
      'Secar a la sombra, sin retorcer.',
      'No usar lavandina, secadora ni calor directo.'
    ]
  };

  const DEFAULT_SIZE_TABLE = {
    title: 'Tabla de talles',
    headers: ['Talle', 'Busto', 'Cintura', 'Cadera'],
    rows: [
      ['S', '84-90', '64-70', '90-96'],
      ['M', '90-96', '70-76', '96-102'],
      ['L', '96-104', '76-84', '102-110']
    ]
  };

  const normalizeCare = (product) => {
    const care = product?.care || {};
    return {
      title: care.title || product?.careTitle || DEFAULT_CARE.title,
      text: care.text || product?.careText || DEFAULT_CARE.text,
      bullets: Array.isArray(care.bullets) && care.bullets.length
        ? care.bullets
        : Array.isArray(product?.careBullets) && product.careBullets.length
          ? product.careBullets
          : DEFAULT_CARE.bullets
    };
  };

  const normalizeSizeTable = (product) => {
    const sizeTable = product?.sizeTable || {};
    return {
      title: sizeTable.title || product?.sizeTableTitle || DEFAULT_SIZE_TABLE.title,
      headers: Array.isArray(sizeTable.headers) && sizeTable.headers.length
        ? sizeTable.headers
        : Array.isArray(product?.sizeTableHeaders) && product.sizeTableHeaders.length
          ? product.sizeTableHeaders
          : DEFAULT_SIZE_TABLE.headers,
      rows: Array.isArray(sizeTable.rows) && sizeTable.rows.length
        ? sizeTable.rows
        : Array.isArray(product?.sizeTableRows) && product.sizeTableRows.length
          ? product.sizeTableRows
          : DEFAULT_SIZE_TABLE.rows
    };
  };

  const renderLookItem = (item) => {
    const image = getProductImages(item)[0];
    return `
          <article class="hf-pdp-look__item">
            <a class="hf-pdp-look__thumb" href="${productUrl(item)}" aria-label="Ver ${escapeHtml(item.name || 'producto')}">
              <img src="${escapeHtml(image?.url || '')}" alt="">
            </a>
            <div class="hf-pdp-look__meta">
              <h3 class="hf-pdp-look__name">${escapeHtml(item.name || '')}</h3>
              <p class="hf-pdp-look__price">${escapeHtml(item.priceText || item.regularPriceText || '')}</p>
              <a class="hf-pdp-look__button" href="${productUrl(item)}">Comprar</a>
            </div>
          </article>`;
  };

  // Card del componente "Compralo con": usa la estructura simple de
  // "Conjuntos destacados" (imagen + titulo), sin precio/talles/cuotas.
  const renderBuyWithCard = (item) => {
    const image = getProductImages(item)[0];
    return `
          <a class="hf-product-item" href="${productUrl(item)}" aria-label="Ver ${escapeHtml(item.name || 'producto')}" style="box-shadow:none;filter:none;">
            <div class="productMedia" style="background:none;">
              <img src="${escapeHtml(image?.url || '')}" alt="${escapeHtml(item.name || '')}">
            </div>
            <div class="hf-product-item__body">
              <h3 class="hf-product-item__title">${escapeHtml(item.name || '')}</h3>
              <p class="small" style="margin-bottom: 8px;"></p>
              ${renderProductCardDivider()}
            </div>
          </a>`;
  };

  const renderProductCardDivider = () => `
              <div class="hf-product-item__pricing hf-product-item__pricing--divider-only" aria-hidden="true">
                <div class="hf-product-item__price-row" hidden>
                  <span class="hf-product-item__price"></span>
                  <span class="hf-product-item__price-original" hidden></span>
                </div>
                <p class="hf-product-item__installments" hidden></p>
                <p class="hf-product-item__transfer" hidden></p>
              </div>`;

  const renderSetPriceBlock = (priceText) => priceText ? `
              <div class="hf-product-item__pricing">
                <div class="hf-product-item__price-row">
                  <span class="hf-product-item__price">${escapeHtml(priceText)}</span>
                </div>
                <p class="hf-product-item__installments" hidden></p>
                <p class="hf-product-item__transfer" hidden></p>
              </div>` : renderProductCardDivider();

  const renderSizeTableHeader = (headers) => headers.map(header => `<th>${escapeHtml(header)}</th>`).join('');

  const renderSizeTableRows = (rows) => rows.map(row => {
    const cells = Array.isArray(row) ? row : [];
    return `<tr>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
  }).join('');

  // `meta` (opcional) permite sobreescribir tÃ­tulo/copy/imagen del conjunto
  // (vienen de la colecciÃ³n en wp-admin). Si no se pasa, se infieren del
  // primer producto (comportamiento usado por la PDP).
  const normalizeSetText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const SET_COLOR_PATTERNS = [
    { label: 'Bordeaux', regex: /\b(bordeaux|bordo|bordó|bor)\b/i },
    { label: 'Azul', regex: /\b(azul|azu)\b/i },
    { label: 'Negro', regex: /\b(negro|negra|neg)\b/i },
    { label: 'Blanco', regex: /\b(blanco|blanca|bla)\b/i },
    { label: 'Celeste', regex: /\b(celeste|cel)\b/i },
    { label: 'Rosa', regex: /\b(rosa|ros)\b/i },
    { label: 'Rojo', regex: /\b(rojo|roja|roj)\b/i },
    { label: 'Verde', regex: /\b(verde|ver)\b/i }
  ];

  const getSetColorLabel = (set) => {
    const haystack = `${set?.name || ''} ${set?.slug || ''}`;
    const match = SET_COLOR_PATTERNS.find(item => item.regex.test(haystack));
    return match?.label || set?.name || 'Color';
  };

  // Color sólido para los circulitos (selector de color de la card mobile).
  const SET_COLOR_HEX = {
    Bordeaux: '#6d2233',
    Azul: '#274690',
    Negro: '#1a1a1a',
    Blanco: '#ffffff',
    Celeste: '#a8d0e6',
    Rosa: '#e8a0c0',
    Rojo: '#c62828',
    Verde: '#3f7d4e'
  };

  const getSetColorHex = (set) => SET_COLOR_HEX[getSetColorLabel(set)] || '#cccccc';

  const getSetFamilyKey = (set) => {
    const base = normalizeSetText(set?.name || set?.slug || '');
    const withoutColors = SET_COLOR_PATTERNS
      .reduce((text, item) => text.replace(item.regex, ' '), base)
      .replace(/\b(conjunto|set)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return withoutColors || normalizeSetText(set?.copy || set?.name || set?.slug);
  };

  const getSetPreviewImage = (set) => {
    const firstProduct = set?.products?.[0];
    return set?.imageMobile?.url || set?.image?.url || getProductImages(firstProduct)[0]?.url || '';
  };

  const getSetHeroImage = (set) => {
    const firstProduct = set?.products?.[0];
    return set?.image?.url || getProductImages(firstProduct)[0]?.url || getSetPreviewImage(set);
  };

  const getSetFirstSkuParts = (set) => {
    const products = Array.isArray(set?.products) ? set.products : [];
    for (const product of products) {
      const parts = productSkuParts(product);
      if (parts) return parts;
    }
    return null;
  };

  const SET_COLOR_ORDER = ['BLA', 'NEG', 'AZU', 'CEL', 'VER', 'ROS', 'ROJ', 'BOR'];
  const SET_TYPE_ORDER = ['TOP', 'SHO', 'FAL', 'CAL', 'CAM'];

  const getTokenOrder = (list, value) => {
    const index = list.indexOf(`${value || ''}`.toUpperCase());
    return index === -1 ? list.length : index;
  };

  const compareFeaturedSetsBySku = (a, b) => {
    const aParts = getSetFirstSkuParts(a);
    const bParts = getSetFirstSkuParts(b);

    if (aParts && bParts) {
      const modelDiff = Number(aParts.set) - Number(bParts.set);
      if (modelDiff) return modelDiff;

      const typeDiff = getTokenOrder(SET_TYPE_ORDER, aParts.type) - getTokenOrder(SET_TYPE_ORDER, bParts.type);
      if (typeDiff) return typeDiff;

      const colorDiff = getTokenOrder(SET_COLOR_ORDER, aParts.color) - getTokenOrder(SET_COLOR_ORDER, bParts.color);
      if (colorDiff) return colorDiff;
    }

    if (aParts && !bParts) return -1;
    if (!aParts && bParts) return 1;

    return `${a?.name || a?.slug || ''}`.localeCompare(`${b?.name || b?.slug || ''}`, 'es');
  };

  const sortFeaturedSetsBySku = (sets = []) => [...sets].sort(compareFeaturedSetsBySku);

  const renderSetColorPreviews = (variants = [], currentSlug = '', extraClass = '') => {
    const unique = [];
    const seen = new Set();
    variants.forEach(set => {
      const key = set?.slug || set?.name;
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(set);
    });
    if (unique.length <= 1) return '';

    const items = unique.map(set => {
      const label = getSetColorLabel(set);
      const imageUrl = getSetPreviewImage(set);
      const current = set.slug === currentSlug;
      const inner = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}">`
        : `<span>${escapeHtml(label.slice(0, 1))}</span>`;
      return `<button class="hf-pdp-view__color" type="button" data-set-color-slug="${escapeHtml(set.slug || '')}" aria-current="${current ? 'true' : 'false'}" aria-label="${escapeHtml(label)}">${inner}</button>`;
    }).join('');

    return `
                <div class="hf-pdp-view__option-head hf-pdp-look__color-head"><span>Colores disponibles:</span></div>
                <div class="hf-pdp-view__color-row hf-pdp-look__color-row ${escapeHtml(extraClass)}" aria-label="Seleccionar color">${items}</div>`;
  };

  const renderProductSetSlide = (items, index, total, meta = null) => {
    const heroProduct = items[0];
    const heroImage = getProductImages(heroProduct)[0];
    const title = meta?.title || heroProduct?.collections?.[0]?.name || `Conjunto ${index + 1}`;
    const tag = meta?.copy || getVisibleCategories(heroProduct?.categories).map(item => item.name).filter(Boolean).join(' / ') || `Conjunto ${index + 1} de ${total}`;
    const heroUrl = meta?.image || heroImage?.url || '';
    const collectionUrl = meta?.slug ? buildCollectionUrl(meta.slug) : '';
    const variants = meta?.variants || [];
    const setPriceText = getSetTotalPriceText(items);
    const colorPreviews = renderSetColorPreviews(variants, meta?.slug || '');
    const titleMarkup = collectionUrl
      ? `<a href="${escapeHtml(collectionUrl)}" aria-label="Ver todos los productos de ${escapeHtml(title)}"><h2 class="hf-pdp-look__title">${escapeHtml(title)}</h2></a>`
      : `<h2 class="hf-pdp-look__title">${escapeHtml(title)}</h2>`;
    const visualMarkup = collectionUrl
      ? `<a class="hf-pdp-look__visual" href="${escapeHtml(collectionUrl)}" aria-label="Ver todos los productos de ${escapeHtml(title)}">
          <img class="hf-pdp-look__hero" src="${escapeHtml(heroUrl)}" alt="${escapeHtml(title)} look principal">
        </a>`
      : `<div class="hf-pdp-look__visual">
          <img class="hf-pdp-look__hero" src="${escapeHtml(heroUrl)}" alt="${escapeHtml(title)} look principal">
        </div>`;
    return `
          <div class="hf-carousel__slide">
            <section class="hf-pdp-look" aria-label="${escapeHtml(title)}" data-current-set-slug="${escapeHtml(meta?.slug || '')}">
              <div class="hf-pdp-look__panel">
                ${titleMarkup}
                ${setPriceText ? `<p class="hf-pdp-look__set-price">${escapeHtml(setPriceText)}</p>` : ''}
                ${colorPreviews}
                <div class="hf-pdp-look__list" tabindex="0" role="region" aria-label="Lista de productos del look completo">
                  ${items.map(renderLookItem).join('')}
                </div>
              </div>
              ${visualMarkup}
            </section>
          </div>`;
  };

  // Imagen mobile del conjunto (vertical); si no hay, cae a la desktop o a la
  // del primer producto.
  const getSetMobileImage = (set) =>
    set?.imageMobile?.url || set?.image?.url || getProductImages(set?.products?.[0])[0]?.url || '';

  // Riel compacto de circulitos de color para la card mobile: sólo los
  // círculos (sin el header "Colores disponibles:") y sólo si hay >1 variante.
  const renderSetMobileColorRail = (variants = [], currentSlug = '') => {
    const unique = [];
    const seen = new Set();
    variants.forEach(set => {
      const key = set?.slug || set?.name;
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(set);
    });
    if (unique.length <= 1) return '';

    const items = unique.map(set => {
      const label = getSetColorLabel(set);
      const hex = getSetColorHex(set);
      const current = set.slug === currentSlug;
      return `<button class="hf-pdp-view__color hf-set-mobile-card__color" type="button" data-set-color-slug="${escapeHtml(set.slug || '')}" aria-current="${current ? 'true' : 'false'}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span class="hf-set-mobile-card__dot" style="background:${escapeHtml(hex)}"></span></button>`;
    }).join('');

    return `<div class="hf-set-mobile-card__colors" aria-label="Seleccionar color">${items}</div>`;
  };

  // Card de un conjunto para la vista mobile (carousel de cards).
  // `variants` son las variantes de color de la misma familia; si hay más de
  // una, se muestra a la derecha un riel de circulitos que cambian el conjunto.
  const renderSetMobileCard = (set, variants = []) => {
    const href = buildCollectionUrl(set.slug);
    const imageUrl = getSetMobileImage(set);
    const priceText = getSetTotalPriceText(set);
    return `
            <div class="hf-carousel__slide">
              <div class="hf-set-mobile-card" data-current-set-slug="${escapeHtml(set.slug || '')}">
                <a class="hf-product-item" href="${escapeHtml(href)}" aria-label="Ver todos los productos de ${escapeHtml(set.name || 'conjunto')}">
                  <div class="productMedia" style="background:none;">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(set.name || '')}">
                  </div>
                  <div class="hf-product-item__body">
                    <h3 class="hf-product-item__title">${escapeHtml(set.name || '')}</h3>
                    <p class="small" style="margin-bottom: 8px;">${escapeHtml(set.copy || '')}</p>
                    ${renderSetPriceBlock(priceText)}
                  </div>
                </a>
                ${renderSetMobileColorRail(variants, set.slug)}
              </div>
            </div>`;
  };

  // Swap de una card mobile al tocar un circulito de color: actualiza imagen,
  // nombre, copy, precio, link y el estado activo de los círculos.
  const updateSetMobileCard = (cardEl, set) => {
    if (!cardEl || !set) return;
    const title = set.name || '';
    const href = buildCollectionUrl(set.slug);
    const priceText = getSetTotalPriceText(set);

    cardEl.dataset.currentSetSlug = set.slug || '';

    const linkEl = cardEl.querySelector('a.hf-product-item');
    if (linkEl) {
      linkEl.href = href;
      linkEl.setAttribute('aria-label', `Ver todos los productos de ${title}`);
    }

    const imgEl = cardEl.querySelector('.productMedia img');
    if (imgEl) {
      imgEl.src = getSetMobileImage(set);
      imgEl.alt = title;
    }

    const titleEl = cardEl.querySelector('.hf-product-item__title');
    if (titleEl) titleEl.textContent = title;

    const copyEl = cardEl.querySelector('.hf-product-item__body .small');
    if (copyEl) copyEl.textContent = set.copy || '';

    const priceEl = cardEl.querySelector('.hf-product-item__price');
    if (priceEl) priceEl.textContent = priceText || '';

    cardEl.querySelectorAll('[data-set-color-slug]').forEach(button => {
      button.setAttribute('aria-current', button.getAttribute('data-set-color-slug') === set.slug ? 'true' : 'false');
    });
  };

  const updateFeaturedSetCard = (lookEl, set) => {
    if (!lookEl || !set) return;
    const title = set.name || '';
    const href = buildCollectionUrl(set.slug);
    const heroUrl = getSetHeroImage(set);
    const priceText = getSetTotalPriceText(set);

    lookEl.setAttribute('aria-label', title);
    lookEl.dataset.currentSetSlug = set.slug || '';

    const titleEl = lookEl.querySelector('.hf-pdp-look__title');
    if (titleEl) titleEl.textContent = title;
    const titleLink = titleEl?.closest('a');
    if (titleLink) {
      titleLink.href = href;
      titleLink.setAttribute('aria-label', `Ver todos los productos de ${title}`);
    }

    const priceEl = lookEl.querySelector('.hf-pdp-look__set-price');
    if (priceEl) {
      priceEl.textContent = priceText;
      priceEl.hidden = !priceText;
    }

    lookEl.querySelectorAll('[data-set-color-slug]').forEach(button => {
      button.setAttribute('aria-current', button.getAttribute('data-set-color-slug') === set.slug ? 'true' : 'false');
    });

    const listEl = lookEl.querySelector('.hf-pdp-look__list');
    if (listEl) listEl.innerHTML = (set.products || []).map(renderLookItem).join('');

    const visualEl = lookEl.querySelector('.hf-pdp-look__visual');
    if (visualEl && visualEl.tagName === 'A') {
      visualEl.href = href;
      visualEl.setAttribute('aria-label', `Ver todos los productos de ${title}`);
    }

    const heroEl = lookEl.querySelector('.hf-pdp-look__hero');
    if (heroEl) {
      heroEl.src = heroUrl || '';
      heroEl.alt = `${title} look principal`;
    }
  };

  const bindFeaturedSetColorControls = (sectionEl, sets) => {
    if (!sectionEl || !Array.isArray(sets)) return;
    const setsBySlug = new Map(sets.map(set => [set.slug, set]).filter(([slug]) => Boolean(slug)));

    if (sectionEl._hfSetColorHandler) {
      sectionEl.removeEventListener('click', sectionEl._hfSetColorHandler);
    }

    sectionEl._hfSetColorHandler = (event) => {
      const button = event.target.closest('[data-set-color-slug]');
      if (!button || !sectionEl.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();

      const nextSet = setsBySlug.get(button.getAttribute('data-set-color-slug'));
      const lookEl = button.closest('.hf-pdp-look');
      if (!nextSet || !lookEl) return;

      updateFeaturedSetCard(lookEl, nextSet);
    };

    sectionEl.addEventListener('click', sectionEl._hfSetColorHandler);
  };

  // Igual que bindFeaturedSetColorControls pero para la card mobile
  // (.hf-set-mobile-card en vez de .hf-pdp-look).
  const bindFeaturedSetMobileColorControls = (sectionEl, sets) => {
    if (!sectionEl || !Array.isArray(sets)) return;
    const setsBySlug = new Map(sets.map(set => [set.slug, set]).filter(([slug]) => Boolean(slug)));

    if (sectionEl._hfSetColorHandler) {
      sectionEl.removeEventListener('click', sectionEl._hfSetColorHandler);
    }

    sectionEl._hfSetColorHandler = (event) => {
      const button = event.target.closest('[data-set-color-slug]');
      if (!button || !sectionEl.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();

      const nextSet = setsBySlug.get(button.getAttribute('data-set-color-slug'));
      const cardEl = button.closest('.hf-set-mobile-card');
      if (!nextSet || !cardEl) return;

      updateSetMobileCard(cardEl, nextSet);
    };

    sectionEl.addEventListener('click', sectionEl._hfSetColorHandler);
  };

  // Renderiza el slider "Conjuntos destacados" en su variante (desktop/mobile).
  // VacÃ­a el track del carousel, inyecta los slides de cada conjunto y
  // reinicializa el carousel. Si no hay conjuntos, oculta la secciÃ³n.
  const renderFeaturedSets = (sectionEl, sets, variant) => {
    const track = sectionEl.querySelector('.hf-carousel__track');
    if (!track) return;

    if (!Array.isArray(sets) || sets.length === 0) {
      sectionEl.style.display = 'none';
      return;
    }

    const sortedSets = sortFeaturedSetsBySku(sets);
    const setsByFamily = sortedSets.reduce((acc, set) => {
      const key = getSetFamilyKey(set);
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(set);
      return acc;
    }, new Map());
    const groupedSets = Array.from(setsByFamily.values()).map(group => sortFeaturedSetsBySku(group));
    const representativeSets = groupedSets.map(group => group[0]).filter(Boolean);
    const total = representativeSets.length;

    if (variant === 'mobile') {
      track.innerHTML = groupedSets.map(group => renderSetMobileCard(group[0], group)).join('');
      bindFeaturedSetMobileColorControls(sectionEl, sortedSets);
    } else {
      track.innerHTML = groupedSets.map((group, i) => {
        const set = group[0];
        if (!set) return '';
        return (
        renderProductSetSlide(set.products || [], i, total, {
          slug: set.slug,
          title: set.name,
          copy: set.copy,
          image: set.image?.url,
          variants: group
        })
        );
      }).join('');
      bindFeaturedSetColorControls(sectionEl, sortedSets);
    }

    // Ajustar config del carousel segÃºn la cantidad de conjuntos:
    // - 1 solo: sin flechas, sin loop, sin autoplay (no tiene sentido).
    // - 2 o mÃ¡s: autoplay infinito cada 5s con loop. Se pausa al hover/touch/
    //   focus y vuelve a arrancar tras 10s sin interacciÃ³n.
    const carousel = track.closest('[data-hf="carousel"]');
    if (carousel) {
      const base = safeParseCarouselConfig(carousel.getAttribute('data-hf-carousel'));
      const multiple = total > 1;
      const config = {
        ...base,
        arrows: multiple,
        loop: multiple,
        seamlessLoop: multiple,
        autoplay: multiple,
        autoplayDelay: 5000,
        resumeDelay: 10000,
        pauseOnHover: true,
        pauseOnFocus: true
      };
      carousel.setAttribute('data-hf-carousel', JSON.stringify(config));
      carousel._hfCarousel = null;
    }
    if (typeof window.initDataCarousels === 'function') window.initDataCarousels();
  };

  const safeParseCarouselConfig = (raw) => {
    try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
  };

  // Card de una categorÃ­a para el grid "Compra por categorÃ­a".
  const renderCategoryCard = (cat) => {
    const imageUrl = cat.image?.url || '';
    const slug = getCollectionSlugFromUrl(cat.url || cat.link || '') || '';
    const href = slug ? buildCollectionUrl(slug) : (cat.link || cat.url || '#');
    return `
        <a href="${escapeHtml(href)}" class="hf-category-card" aria-label="Ver ${escapeHtml(cat.name || '')}">
          <img src="${escapeHtml(imageUrl)}" alt="Categoria ${escapeHtml(cat.name || '')}">
          <div class="hf-category-card__overlay">
            <div>
              <h3 class="hf-category-card__title">${escapeHtml(cat.name || '')}</h3>
              <span class="hf-category-card__cta">Quiero ver</span>
            </div>
            <span class="hf-category-card__arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14"></path>
                <path d="M13 6l6 6-6 6"></path>
              </svg></span>
          </div>
        </a>`;
  };

  // Renderiza el grid "Compra por categorÃ­a" con las categorÃ­as de wp-admin.
  // Si no hay categorÃ­as marcadas "Mostrar en home", oculta la secciÃ³n.
  const renderCategories = async (sectionEl, cats) => {
    const grid = sectionEl.querySelector('[data-categories-grid]');
    if (!grid) return;
    const visibleCats = await filterValidCollectionLinks(getVisibleCategories(cats));
    if (visibleCats.length === 0) {
      sectionEl.style.display = 'none';
      return;
    }
    grid.innerHTML = visibleCats.map(renderCategoryCard).join('');
  };

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  const renderInfoPage = (root, page, html) => {
    if (!page || !html) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl) return;

    sectionEl.hidden = false;
    root.appendChild(sectionEl);

    const titleEl = sectionEl.querySelector('[data-info-title]');
    if (titleEl) titleEl.textContent = page.title || '';

    const kickerEl = sectionEl.querySelector('[data-info-kicker]');
    if (kickerEl) kickerEl.textContent = 'Ayuda';

    const contentEl = sectionEl.querySelector('[data-info-content]');
    if (contentEl && page.content) contentEl.innerHTML = page.content;
  };

  // Renderiza la pÃ¡gina de colecciÃ³n: tÃ­tulo centrado + grid de TODOS los
  // productos de la categorÃ­a (sin paginaciÃ³n). Columnas configurables desde
  // wp-admin.
  const renderCollectionPage = (root, cat, products, settings, html) => {
    const list = filterVisibleProducts(products);
    const normalizedCat = `${cat || ''}`.trim().toLowerCase();

    if (normalizedCat && list.length === 0) {
      console.warn(`[HF PB] Collection not available: ${cat || '(missing cat)'}`);
      redirectToHome();
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl) return;

    document.body.classList.add('hf-collection-mode');
    sectionEl.hidden = false;
    root.appendChild(sectionEl);

    const cfg = {
      colsDesktop: settings?.colsDesktop || COLLECTION_DEFAULTS.colsDesktop,
      colsMobile: settings?.colsMobile || COLLECTION_DEFAULTS.colsMobile
    };

    // TÃ­tulo: nombre legible de la categorÃ­a (de los productos) o slug capitalizado.
    const catName = normalizedCat
      ? (normalizedCat === DEFAULT_CATEGORY_SLUG
        ? 'Colección'
        : list[0]?.categories?.find(c => c.slug === cat)?.name
          || list[0]?.collections?.find(c => c.slug === cat)?.name
          || capitalize(cat.replace(/-/g, ' ')))
      : 'Colección';
    const titleEl = sectionEl.querySelector('[data-collection-title]');
    if (titleEl) titleEl.textContent = catName;
    const canonical = normalizedCat ? buildCollectionUrl(normalizedCat) : routeBaseUrl('/coleccion/');
    const description = normalizedCat
      ? normalizeSeoDescription(`Explorá ${catName} de ${SITE_NAME}: prendas y sets listos para comprar el look completo.`)
      : normalizeSeoDescription(`Explorá la colección de ${SITE_NAME}: prendas y sets listos para comprar el look completo.`);
    updateSeo({
      title: normalizedCat ? `${catName} | ${SITE_NAME}` : `Colección | ${SITE_NAME}`,
      description,
      canonical,
      ogType: 'website',
      ogImage: (list[0] && getProductImages(list[0])[0]?.url) || DEFAULT_SOCIAL_IMAGE,
      schema: [
        organizationSchema(),
        websiteSchema(description),
        breadcrumbSchema([
          { name: 'Inicio', url: routeBaseUrl('/') },
          { name: 'Tienda', url: routeBaseUrl('/coleccion/') },
          { name: catName, url: canonical }
        ])
      ]
    });

    // Grid: TODOS los productos, columnas configurables vÃ­a CSS vars.
    const grid = sectionEl.querySelector('[data-collection-grid]');
    const template = sectionEl.querySelector('[data-product-template]');
    if (grid && template) {
      grid.style.setProperty('--collection-cols-desktop', cfg.colsDesktop);
      grid.style.setProperty('--collection-cols-mobile', cfg.colsMobile);
      list.forEach(product => grid.appendChild(fillProductCard(template, product, { showSizes: false })));
    }
  };

  const renderAccountPage = (root, html) => {
    if (!html) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl) return;

    document.body.classList.add('hf-account-mode');
    sectionEl.hidden = false;
    root.appendChild(sectionEl);

    const loginUrl = `${WP_BASE_URL}/wp-login.php`;
    const redirectUrl = routeBaseUrl('/mi-cuenta/');
    const lostPasswordUrl = routeBaseUrl('/mi-cuenta/lost-password/');

    const form = sectionEl.querySelector('[data-account-login-shell]');
    if (form) form.setAttribute('action', loginUrl);

    const redirectInput = sectionEl.querySelector('[name="redirect_to"]');
    if (redirectInput) redirectInput.value = redirectUrl;

    const forgotLink = sectionEl.querySelector('[data-account-forgot]');
    if (forgotLink) forgotLink.setAttribute('href', lostPasswordUrl);

    const shopLink = sectionEl.querySelector('[data-account-shop]');
    if (shopLink) shopLink.setAttribute('href', routeBaseUrl('/'));

    const loginShell = sectionEl.querySelector('[data-account-login-shell]');
    const sessionShell = sectionEl.querySelector('[data-account-session-shell]');
    const sessionName = sectionEl.querySelector('[data-account-session-name]');
    const sessionEmail = sectionEl.querySelector('[data-account-session-email]');
    const sessionStatus = sectionEl.querySelector('[data-account-session-status]');
    const logoutLink = sectionEl.querySelector('[data-account-logout]');
    const loginStatus = sectionEl.querySelector('[data-account-login-status]');

    const showLoginState = (message = '') => {
      document.body.classList.remove('hf-account-signed-in');
      document.body.classList.add('hf-account-signed-out');
      if (loginShell) loginShell.hidden = false;
      if (sessionShell) sessionShell.hidden = true;
      if (sessionStatus) sessionStatus.textContent = 'Sesión cerrada';
      if (loginStatus) loginStatus.textContent = message;
      if (logoutLink) logoutLink.setAttribute('href', '#');
    };

    const showSessionState = (data) => {
      document.body.classList.add('hf-account-signed-in');
      document.body.classList.remove('hf-account-signed-out');
      if (loginShell) loginShell.hidden = true;
      if (sessionShell) sessionShell.hidden = false;
      if (sessionName) sessionName.textContent = data?.displayName || 'Cliente';
      if (sessionEmail) sessionEmail.textContent = data?.email || '';
      if (sessionStatus) sessionStatus.textContent = 'Sesión activa';
      if (logoutLink && data?.logoutUrl) logoutLink.setAttribute('href', data.logoutUrl);
      if (loginStatus) loginStatus.textContent = '';
    };

    hfRestFetch('/account/session', null, { method: 'GET' })
      .then(data => {
        if (data?.loggedIn) {
          showSessionState(data);
        } else {
          showLoginState('No hay una sesión activa.');
        }
      })
      .catch(error => {
        console.warn('[HF PB] Account session unavailable:', error.message);
        showLoginState('No pudimos verificar la sesión.');
      });
  };

  const renderCheckoutPage = async (root, html) => {
    if (!html) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl) return;

    document.body.classList.add('hf-checkout-mode');
    sectionEl.hidden = false;
    root.appendChild(sectionEl);

    const checkoutForm = sectionEl.querySelector('[data-checkout-form]');
    const sessionName = sectionEl.querySelector('[data-checkout-session-name]');
    const sessionEmail = sectionEl.querySelector('[data-checkout-session-email]');
    const sessionStatus = sectionEl.querySelector('[data-checkout-session-status]');
    const paymentList = sectionEl.querySelector('[data-checkout-payment-methods]');
    const paymentHint = sectionEl.querySelector('[data-checkout-payment-hint]');
    const orderList = sectionEl.querySelector('[data-checkout-order-items]');
    const subtotalEl = sectionEl.querySelector('[data-checkout-subtotal]');
    const totalEl = sectionEl.querySelector('[data-checkout-total]');
    const shippingEl = sectionEl.querySelector('[data-checkout-shipping]');
    const emptyState = sectionEl.querySelector('[data-checkout-empty]');
    const submitBtn = sectionEl.querySelector('[data-checkout-submit]');
    const statusEl = sectionEl.querySelector('[data-checkout-status]');
    const sameAddressToggle = sectionEl.querySelector('[data-checkout-same-address]');
    const billingSection = sectionEl.querySelector('[data-checkout-billing]');
    const shippingSection = sectionEl.querySelector('[data-checkout-shipping-fields]');
    const createAccountRow = sectionEl.querySelector('[data-checkout-create-account-row]');
    const createAccountToggle = sectionEl.querySelector('[data-checkout-create-account]');
    const passwordRow = sectionEl.querySelector('[data-checkout-password-row]');
    const paymentMethodInput = sectionEl.querySelector('[data-checkout-payment-method]');
    const fields = new Map();
    sectionEl.querySelectorAll('[data-checkout-field]').forEach(input => {
      const key = input.getAttribute('data-checkout-field');
      if (key) fields.set(key, input);
    });

    const setFieldValues = (prefix, values = {}) => {
      Object.entries(values || {}).forEach(([key, value]) => {
        const input = fields.get(`${prefix}.${key}`);
        if (input && value !== undefined && value !== null) {
          input.value = `${value}`;
        }
      });
    };

    const collectFieldValues = (prefix) => {
      const data = {};
      fields.forEach((input, key) => {
        if (!key.startsWith(`${prefix}.`)) return;
        const fieldName = key.replace(`${prefix}.`, '');
        data[fieldName] = input.value.trim();
      });
      return data;
    };

    const renderPaymentMethods = (methods = [], defaultId = '') => {
      if (!paymentList) return;
      if (!methods.length) {
        paymentList.innerHTML = '<p class="hf-checkout-view__empty-note">No hay metodos de pago disponibles.</p>';
        if (paymentHint) paymentHint.textContent = 'Revisamos esto desde WooCommerce.';
        return;
      }
      paymentList.innerHTML = methods.map((method, index) => {
        const checked = defaultId ? method.id === defaultId : index === 0;
        return `
          <label class="hf-checkout-view__payment">
            <input type="radio" name="payment_method" value="${escapeHtml(method.id || '')}" ${checked ? 'checked' : ''}>
            <span>
              <strong>${escapeHtml(method.title || method.id || 'Pago')}</strong>
              ${method.description ? `<small>${escapeHtml(method.description)}</small>` : ''}
            </span>
          </label>
        `;
      }).join('');
      const current = paymentList.querySelector('input[type="radio"]:checked');
      if (paymentMethodInput && current) {
        paymentMethodInput.value = current.value;
      }
      paymentList.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', () => {
          if (paymentMethodInput) paymentMethodInput.value = input.value;
        });
      });
    };

    const updateOrderSummary = (cart) => {
      const items = Array.isArray(cart?.items) ? cart.items : [];
      if (!orderList) return;
      if (!items.length) {
        orderList.innerHTML = '<p class="hf-checkout-view__empty-note">Tu carrito esta vacio.</p>';
        if (emptyState) emptyState.hidden = false;
        if (submitBtn) submitBtn.disabled = true;
      } else {
        orderList.innerHTML = items.map(item => {
          const image = getCartItemImage(item);
          return `
            <div class="hf-checkout-view__order-item">
              <div class="hf-checkout-view__order-media">${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}</div>
              <div class="hf-checkout-view__order-body">
                <strong>${escapeHtml(decodeEntities(item.name || 'Producto'))}</strong>
                <span>${escapeHtml(getCartItemDetails(item) || `Cantidad: ${item.quantity || 1}`)}</span>
              </div>
              <strong class="hf-checkout-view__order-price">${escapeHtml(formatStoreMoney(item?.totals?.line_total || 0, getCartCurrency(cart)))}</strong>
            </div>
          `;
        }).join('');
        if (emptyState) emptyState.hidden = true;
        if (submitBtn) submitBtn.disabled = false;
      }
      if (subtotalEl) subtotalEl.textContent = formatStoreMoney(cart?.totals?.total_items || 0, getCartCurrency(cart));
      if (shippingEl) {
        const shippingValue = cart?.totals?.total_shipping;
        shippingEl.textContent = shippingValue === null || shippingValue === undefined ? 'Se calcula despues' : formatStoreMoney(shippingValue || 0, getCartCurrency(cart));
      }
      if (totalEl) totalEl.textContent = formatStoreMoney(cart?.totals?.total_price || 0, getCartCurrency(cart));
    };

    const refreshCheckout = async () => {
      const [cart, options, session] = await Promise.all([
        refreshCart(),
        hfRestFetch('/checkout/options', null, { method: 'GET' }).catch(() => ({})),
        hfRestFetch('/account/session', null, { method: 'GET' }).catch(() => ({}))
      ]);

      updateOrderSummary(cart);
      renderPaymentMethods(options.paymentMethods || [], options.defaultMethodId || '');
      const syncAccountCreationUI = () => {
        if (passwordRow) {
          passwordRow.hidden = Boolean(session?.loggedIn) || !Boolean(createAccountToggle?.checked);
        }
      };
      if (session?.loggedIn) {
        if (sessionName) sessionName.textContent = session.displayName || 'Cliente';
        if (sessionEmail) sessionEmail.textContent = session.email || '';
        if (sessionStatus) sessionStatus.textContent = 'Sesion activa';
        if (createAccountRow) createAccountRow.hidden = true;
        if (passwordRow) passwordRow.hidden = true;
      } else {
        if (sessionStatus) sessionStatus.textContent = 'Sesion de invitado';
        if (createAccountRow) createAccountRow.hidden = false;
        if (createAccountToggle) {
          createAccountToggle.checked = false;
          createAccountToggle.addEventListener('change', syncAccountCreationUI);
        }
        syncAccountCreationUI();
      }

      const billing = cart?.billing_address || {};
      const shipping = cart?.shipping_address || billing;
      setFieldValues('billing', billing);
      setFieldValues('shipping', shipping);
      if (paymentMethodInput && options.defaultMethodId) {
        paymentMethodInput.value = options.defaultMethodId;
      }

      if (sameAddressToggle) {
        sameAddressToggle.checked = true;
        const syncShippingVisibility = () => {
          if (billingSection && shippingSection) {
            shippingSection.hidden = sameAddressToggle.checked;
          }
        };
        sameAddressToggle.addEventListener('change', syncShippingVisibility);
        syncShippingVisibility();
      }
    };

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (statusEl) statusEl.textContent = 'Procesando pedido...';
        if (submitBtn) submitBtn.disabled = true;

        const billing_address = collectFieldValues('billing');
        const shipping_address = sameAddressToggle?.checked ? billing_address : collectFieldValues('shipping');
        const paymentMethod = paymentMethodInput?.value || paymentList?.querySelector('input[type="radio"]:checked')?.value || '';
        const body = {
          billing_address,
          shipping_address,
          payment_method: paymentMethod,
          order_notes: `${sectionEl.querySelector('[name="order_notes"]')?.value || ''}`.trim(),
          create_account: Boolean(createAccountToggle?.checked)
        };
        const customerPassword = `${sectionEl.querySelector('[name="customer_password"]')?.value || ''}`.trim();
        if (customerPassword) {
          body.customer_password = customerPassword;
        }

        try {
          const response = await storeApiFetch('/checkout', { method: 'POST', body });
          const redirectUrl = response?.payment_result?.redirect_url || '';
          if (redirectUrl) {
            window.location.assign(redirectUrl);
            return;
          }
          if (statusEl) {
            statusEl.textContent = `Pedido ${response?.order_number || response?.order_id || ''} creado.`;
          }
          if (submitBtn) submitBtn.disabled = false;
        } catch (error) {
          if (statusEl) statusEl.textContent = error.message || 'No pudimos completar el checkout.';
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    await refreshCheckout();
    if (statusEl && !statusEl.textContent) {
      statusEl.textContent = 'Checkout listo.';
    }
  };

  const renderLostPasswordPage = (root, html) => {
    if (!html) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl) return;

    document.body.classList.add('hf-account-mode');
    sectionEl.hidden = false;
    root.appendChild(sectionEl);

    const form = sectionEl.querySelector('[data-lost-password-form]');
    const loginLink = sectionEl.querySelector('[data-lost-password-login]');
    const submitBtn = sectionEl.querySelector('[data-lost-password-submit]');
    const statusEl = sectionEl.querySelector('[data-lost-password-status]');

    if (loginLink) {
      loginLink.setAttribute('href', routeBaseUrl('/mi-cuenta/'));
    }

    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = form.querySelector('[name="user_login"]');
        const userLogin = `${input?.value || ''}`.trim();
        if (!userLogin) {
          if (statusEl) statusEl.textContent = 'Ingresá tu usuario o email.';
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Enviando enlace de recuperación...';

        try {
          const result = await hfRestFetch('/account/lost-password', { user_login: userLogin });
          if (statusEl) statusEl.textContent = result?.message || 'Revisá tu casilla para continuar.';
          form.reset();
        } catch (error) {
          if (statusEl) statusEl.textContent = error.message || 'No pudimos enviar el enlace.';
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  };

  const setupPdpTrustItems = (sectionEl, settings) => {
    const items = Array.isArray(settings?.pdpItems) ? settings.pdpItems : [];
    items.slice(0, 3).forEach((item, i) => {
      const titleEl = sectionEl.querySelector(`[data-pdp-trust-title="${i}"]`);
      const descEl = sectionEl.querySelector(`[data-pdp-trust-desc="${i}"]`);
      if (titleEl && item?.title != null) titleEl.textContent = `${item.title || ''}`;
      if (descEl && item?.descriptionHtml != null) descEl.innerHTML = `${item.descriptionHtml || ''}`;
    });
  };

  const renderProductPage = async (root, products, html, wpSettings = null) => {
    if (!products || !html) {
      [products, html] = await Promise.all([
        fetchProductCatalog(),
        fetchText(PRODUCT_DETAIL_COMPONENT)
      ]);
    }

    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const pathSlug = path.startsWith('/producto/')
      ? decodeURIComponent(path.split('/').filter(Boolean).pop() || '')
      : '';
    const slug = params.get('slug') || params.get('product') || pathSlug;
    const list = filterVisibleProducts(products);
    const product = slug ? list.find(item => productMatchesSlug(item, slug)) : list[0];
    if (slug && !product) {
      console.warn(`[HF PB] Product slug not found: ${slug}`);
      redirectToHome();
      return;
    }

    const canonicalSlug = getProductCanonicalSlug(product);
    const requestedSlug = normalizeProductSlug(slug);
    if (canonicalSlug && requestedSlug && canonicalSlug !== requestedSlug) {
      window.location.replace(`/producto/${encodeURIComponent(canonicalSlug)}/`);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl || !product) return;

    document.body.classList.add('hf-product-mode');
    sectionEl.hidden = false;
    setupPdpTrustItems(sectionEl, wpSettings?.get?.('trust-bar'));

    const $ = (sel, base = sectionEl) => base.querySelector(sel);
    const $$ = (sel, base = sectionEl) => Array.from(base.querySelectorAll(sel));
    const images = getProductImages(product);
    const mainImage = $('[data-product-main-image]');
    const mainMedia = $('[data-product-main]');
    const lookImage = $('[data-product-look-image]');
    const lookTag = $('[data-product-look-tag]');
    const lookList = $('[data-product-look-list]');
    const setText = (sel, value) => {
      const elements = $$(sel);
      elements.forEach(el => { el.textContent = value || ''; });
      return elements[0] || null;
    };
    const setHtml = (sel, value) => {
      const elements = $$(sel);
      elements.forEach(el => { el.innerHTML = value || ''; });
      return elements[0] || null;
    };

    setText('.hf-pdp-view__title', product.name || '');
    const transferEl = $('[data-product-transfer]');
    if (transferEl) transferEl.hidden = true;
    $$('[data-product-description-title]').forEach(el => { el.textContent = product.descriptionTitle || 'Descripción'; });
    setHtml('[data-product-description]', productDescriptionHtml(product.description || product.shortDescription));

    const care = normalizeCare(product);
    $$('[data-product-care-title]').forEach(el => { el.textContent = care.title; });
    $$('[data-product-care-text]').forEach(el => { el.innerHTML = careDescriptionHtml(care); });
    $$('[data-product-care-list]').forEach(el => {
      el.innerHTML = '';
      el.hidden = true;
    });

    const sizeTable = normalizeSizeTable(product);
    const sizeTitle = $('[data-product-size-title]');
    const sizeTableHead = $('[data-product-size-table-head]');
    const sizeTableBody = $('[data-product-size-table-body]');
    if (sizeTitle) sizeTitle.textContent = sizeTable.title;
    if (sizeTableHead) sizeTableHead.innerHTML = renderSizeTableHeader(sizeTable.headers);
    if (sizeTableBody) sizeTableBody.innerHTML = renderSizeTableRows(sizeTable.rows);

    const category = getVisibleCategories(product.categories).map(item => item.name).filter(Boolean).join(' / ') || '';
    setText('[data-product-kicker]', category || 'Seamless collection');
    if (lookTag) lookTag.textContent = product.name || '';

    if (images[0] && mainImage) {
      mainImage.src = images[0].url;
      mainImage.alt = images[0].alt || product.name || '';
      if (lookImage) {
        lookImage.src = images[0].url;
        lookImage.alt = `${product.name || 'Producto'} look principal`;
      }
    }

    const productSlug = canonicalSlug || requestedSlug;
    const canonical = productSlug
      ? routeBaseUrl(`/producto/${encodeURIComponent(productSlug)}/`)
      : routeBaseUrl('/producto/');
    const productDescription = normalizeSeoDescription(
      plainTextFromHtml(product.description || product.shortDescription || product.excerpt || ''),
      HOME_SEO_DESCRIPTION
    );
    const productImage = images[0]?.url || DEFAULT_SOCIAL_IMAGE;
    updateSeo({
      title: `${product.name || 'Producto'} | ${SITE_NAME}`,
      description: productDescription,
      canonical,
      ogType: 'product',
      ogImage: productImage,
      schema: [
        organizationSchema(),
        websiteSchema(productDescription),
        breadcrumbSchema([
          { name: 'Inicio', url: routeBaseUrl('/') },
          { name: 'Tienda', url: routeBaseUrl('/coleccion/') },
          { name: product.name || 'Producto', url: canonical }
        ]),
        productSchema(product, canonical, productImage)
      ]
    });

    const thumbs = $('[data-product-thumbs]');
    images.forEach((image, idx) => {
      const btn = document.createElement('button');
      btn.className = 'hf-pdp-view__thumb';
      btn.type = 'button';
      btn.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', `Ver foto ${idx + 1}`);
      btn.style.setProperty('--thumb-delay', `${idx * 70}ms`);
      const img = document.createElement('img');
      img.src = image.url;
      img.alt = '';
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        if (mainImage) {
          mainMedia?.classList.add('is-changing');
          mainImage.src = image.url;
          mainImage.alt = `${product.name || 'Producto'} foto ${idx + 1}`;
          window.setTimeout(() => mainMedia?.classList.remove('is-changing'), 180);
        }
        if (lookImage) {
          lookImage.src = image.url;
          lookImage.alt = `${product.name || 'Producto'} look principal`;
        }
        $$('.hf-pdp-view__thumb').forEach(item => item.setAttribute('aria-current', 'false'));
        btn.setAttribute('aria-current', 'true');
      });
      thumbs?.appendChild(btn);
    });

    const sizes = product.sizes?.length ? product.sizes : getAttributeValues(product, 'talle');
    const sizesSlot = $('.hf-pdp-view__sizes');
    const sizeLabel = $('[data-product-size-label]');
    const sizeButtons = $$('.hf-pdp-view__size', sizesSlot || sectionEl);
    const currentColor = (() => {
      const colorAttr = product?.attributes?.find(item => `${item.label || item.name || ''}`.toLowerCase().includes('color'));
      const value = colorAttr?.values?.[0];
      return value?.name || value?.slug || '';
    })();
    const variationSizeValue = (variation) => `${variation?.attributes?.talle || variation?.attributes?.size || ''}`.trim();
    const getInitialSelectedVariation = () => {
      if (!Array.isArray(product?.variations) || !product.variations.length) {
        return null;
      }
      return product.variations.find(variation => getSelectedProductAvailability(product, variation).canPurchase)
        || product.variations[0]
        || null;
    };
    let selectedSize = variationSizeValue(getInitialSelectedVariation()) || sizes[0] || '';
    if (sizes.length && !sizes.some(size => `${size}`.trim() === selectedSize)) {
      selectedSize = sizes[0] || selectedSize;
    }
    const priceRow = $('.hf-pdp-view__price-row');
    const pricingEl = $('.hf-pdp-view__pricing');
    const availabilityEl = $('[data-product-installments]');
    const actionsEl = $('.hf-pdp-view__actions');
    const addToCartButton = $('[data-product-add-to-cart]') || $('.hf-pdp-view__button--primary');
    const buyNowButton = $('[data-product-buy-now]');

    const findVariationForSelection = () => {
      if (!Array.isArray(product?.variations) || !product.variations.length) {
        return null;
      }

      const normalizedSize = `${selectedSize || ''}`.trim();
      const normalizedColor = `${currentColor || ''}`.trim();

      return product.variations.find(variation => {
        const attrs = variation?.attributes || {};
        const sizeMatch = normalizedSize ? `${attrs.talle || attrs.size || ''}` === normalizedSize : true;
        const colorMatch = normalizedColor ? `${attrs.color || ''}` === normalizedColor : true;
        return sizeMatch && colorMatch;
      }) || null;
    };

    const updatePurchaseState = (variation = null) => {
      const state = getSelectedProductAvailability(product, variation);
      setText('.hf-pdp-view__price', state.priceText || '');
      setText('.hf-pdp-view__compare', '');
      const compareEl = $('.hf-pdp-view__compare');
      if (compareEl) compareEl.hidden = true;
      if (priceRow) priceRow.hidden = !state.priceText;
      if (pricingEl) pricingEl.dataset.stockStatus = state.stockStatus || '';
      if (availabilityEl) availabilityEl.textContent = state.canPurchase ? (state.installmentsText || '') : state.label || '';
      if (transferEl) {
        transferEl.textContent = state.canPurchase ? (state.transferText || '') : '';
        transferEl.hidden = !state.canPurchase || !state.transferText;
      }
      if (actionsEl) actionsEl.hidden = !state.canPurchase;
      [addToCartButton, buyNowButton].filter(Boolean).forEach(button => {
        button.disabled = !state.canPurchase;
        button.setAttribute('aria-disabled', state.canPurchase ? 'false' : 'true');
      });
      return state;
    };

    const buildStoreVariationPayload = (variation) => {
      const attrs = variation?.attributes || {};
      return Object.keys(attrs).map(key => ({
        attribute: key,
        value: attrs[key]
      }));
    };

    const addSelectedProductToCart = async ({ goCheckout = false } = {}) => {
      const variation = findVariationForSelection();
      const state = updatePurchaseState(variation);
      if (!state.canPurchase) {
        renderCartDrawer(commerceState.cart, state.label || 'Este producto no se puede agregar.');
        return;
      }

      const payload = {
        id: Number(variation?.id || product.id),
        quantity: 1
      };
      const variationPayload = buildStoreVariationPayload(variation);
      if (variationPayload.length) payload.variation = variationPayload;

      const buttons = [addToCartButton, buyNowButton].filter(Boolean);
      buttons.forEach(button => button.setAttribute('disabled', ''));
      try {
        await mutateCart('/cart/add-item', payload, 'Producto agregado.');
        if (goCheckout) {
          const checkoutUrl = await syncCartForCheckout();
          window.location.assign(checkoutUrl);
          return;
        }
        if (!document.querySelector('#drawer')?.classList.contains('is-on')) {
          document.querySelector('#cartBtn')?.click();
        }
      } catch (error) {
        renderCartDrawer(commerceState.cart, error.message || 'No pudimos agregar el producto.');
        console.warn('[HF PB] Add to cart failed:', error.message);
      } finally {
        buttons.forEach(button => button.removeAttribute('disabled'));
      }
    };

    sizeButtons.forEach((btn, idx) => {
      const size = sizes[idx] || btn.textContent.trim();
      btn.textContent = size;
      btn.setAttribute('aria-pressed', size === selectedSize ? 'true' : 'false');
      if (size === selectedSize && sizeLabel) {
        sizeLabel.textContent = size;
      }
      btn.addEventListener('click', () => {
        $$('.hf-pdp-view__size', sizesSlot || sectionEl).forEach(item => item.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        selectedSize = size;
        if (sizeLabel) sizeLabel.textContent = size;
        updatePurchaseState(findVariationForSelection());
      });
    });
    if (!sizes.length && sizeLabel) sizeLabel.textContent = '-';

    const colorVariants = getColorVariants(product, list);
    const colors = [product, ...colorVariants.filter(candidate => candidate.slug !== product.slug)];
    const colorsSlot = $('[data-product-colors]');
    colors.forEach((colorProduct, idx) => {
      const colorName = colorProduct?.attributes?.find(item => `${item.label || item.name || ''}`.toLowerCase().includes('color'))?.values?.[0]?.name
        || colorProduct?.attributes?.find(item => `${item.label || item.name || ''}`.toLowerCase().includes('color'))?.values?.[0]?.slug
        || colorProduct?.name
        || '';
      const btn = document.createElement('button');
      btn.className = 'hf-pdp-view__color';
      btn.type = 'button';
      btn.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', colorName);
      const colorImages = getProductImages(colorProduct);
      if (colorImages[0]) {
        const img = document.createElement('img');
        img.src = colorImages[0].url;
        img.alt = colorName;
        btn.appendChild(img);
      } else {
        btn.textContent = colorName;
      }
      btn.addEventListener('click', () => {
        if (colorProduct.slug === product.slug) {
          return;
        }
        const targetUrl = productUrl(colorProduct);
        if (targetUrl && targetUrl !== '#') {
          window.location.assign(targetUrl);
        }
      });
      colorsSlot?.appendChild(btn);
    });
    if (!colors.length) colorsSlot?.closest('.hf-pdp-view__color-row')?.setAttribute('hidden', '');

    updatePurchaseState(getInitialSelectedVariation());

    addToCartButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      await addSelectedProductToCart();
    });

    buyNowButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      await addSelectedProductToCart({ goCheckout: true });
    });

    $$('.hf-pdp-view__tab[data-product-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const name = tab.getAttribute('data-product-tab');
        const details = tab.closest('.hf-pdp-view__details') || sectionEl;
        $$('.hf-pdp-view__tab[data-product-tab]', details).forEach(item => item.setAttribute('aria-selected', item === tab ? 'true' : 'false'));
        $$('.hf-pdp-view__panel', details).forEach(panel => {
          panel.classList.toggle('is-active', panel.getAttribute('data-product-panel') === name);
        });
      });
    });

    sectionEl.querySelector('[data-product-size-guide]')?.addEventListener('click', (event) => {
      event.preventDefault?.();
      const tab = sectionEl.querySelector('[data-product-tab="sizes"]');
      tab?.click();
      sectionEl.querySelector('.hf-pdp-view__details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const buyWithSection = sectionEl.querySelector('[data-buy-with]');
    const detailsSection = sectionEl.querySelector('.hf-pdp-view__details');
    const layoutSection = sectionEl.querySelector('.hf-pdp-view__layout');
    const buyWithMq = window.matchMedia('(max-width: 767px)');
    const topBandDesktopMq = window.matchMedia('(min-width: 1024px)');

    const syncBuyWithPlacement = () => {
      if (!buyWithSection || !detailsSection || !layoutSection) return;
      if (buyWithSection.parentElement !== layoutSection || buyWithSection.previousElementSibling !== detailsSection) {
        detailsSection.insertAdjacentElement('afterend', buyWithSection);
      }
    };

    const syncPdpTopBand = () => {
      if (!layoutSection || !topBandDesktopMq.matches) return;
      const minBand = 44 * parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
      const measured = Math.ceil(layoutSection.getBoundingClientRect().height || 0);
      sectionEl.style.setProperty('--hf-pdp-top-band', `${Math.max(measured, minBand)}px`);
    };

    syncBuyWithPlacement();
    if (typeof buyWithMq.addEventListener === 'function') {
      buyWithMq.addEventListener('change', syncBuyWithPlacement);
    } else if (typeof buyWithMq.addListener === 'function') {
      buyWithMq.addListener(syncBuyWithPlacement);
    }
    if (typeof topBandDesktopMq.addEventListener === 'function') {
      topBandDesktopMq.addEventListener('change', syncPdpTopBand);
    } else if (typeof topBandDesktopMq.addListener === 'function') {
      topBandDesktopMq.addListener(syncPdpTopBand);
    }
    window.addEventListener('load', syncPdpTopBand);
    window.addEventListener('resize', syncBuyWithPlacement, { passive: true });
    window.addEventListener('resize', syncPdpTopBand, { passive: true });

    root.appendChild(sectionEl);
    window.requestAnimationFrame(syncPdpTopBand);

    window.setTimeout(() => {
      const related = list.filter(item => item.slug !== product.slug);

      const buyWithItems = getBuyWithProducts(product, list);

      const buyWithSection = $('[data-buy-with]');
      const buyWithGrid = $('[data-buy-with-grid]');
      if (buyWithSection && buyWithGrid) {
        if (buyWithItems.length) {
          buyWithGrid.innerHTML = buyWithItems.map(renderBuyWithCard).join('');
          buyWithSection.hidden = false;
          // Cablear las flechas del slider sobre las cards reciÃ©n inyectadas.
          if (typeof window.initCarousels === 'function') window.initCarousels();
        } else {
          buyWithSection.hidden = true;
        }
      }

      const setLineItems = getPdpSetLineProducts(product, list);
      const setLineSection = $('[data-pdp-set-line]');
      const setLineGrids = $$('[data-pdp-set-line-grid]');
      if (setLineSection && setLineGrids.length) {
        if (setLineItems.length) {
          const splitAt = setLineGrids.length > 1 ? Math.ceil(setLineItems.length / 2) : setLineItems.length;
          const rows = setLineGrids.length > 1
            ? [setLineItems.slice(0, splitAt), setLineItems.slice(splitAt)]
            : [setLineItems];

          setLineGrids.forEach((grid, index) => {
            const rowItems = rows[index] || [];
            const shell = grid.closest('[data-grid-shell]');
            grid.innerHTML = rowItems.map(item => renderProductCardHtml(item, { showSizes: false })).join('');
            if (shell) {
              shell.hidden = rowItems.length === 0;
              delete shell.dataset.carouselReady;
            }
          });
          setLineSection.hidden = false;
          if (typeof window.initCarousels === 'function') window.initCarousels();
        } else {
          setLineSection.hidden = true;
        }
      }

      if (lookList) {
        lookList.innerHTML = related.slice(0, 3).map(renderLookItem).join('');
      }

      const desktopList = $('[data-product-look-desktop-list]');
      const desktopImage = $('[data-product-look-desktop-image]');
      const desktopTag = $('[data-product-look-desktop-tag]');
      if (desktopList) desktopList.innerHTML = related.slice(0, 4).map(renderLookItem).join('');
      if (desktopImage) {
        desktopImage.src = getProductImages(related[0] || product)[0]?.url || images[0]?.url || '';
        desktopImage.alt = `${product.name || 'Producto'} look principal`;
      }
      if (desktopTag) desktopTag.textContent = product.name || '';

      const setTrack = $('[data-product-set-mobile-track]');
      if (setTrack) {
        const setItems = related.length ? related : list.filter(Boolean);
        const groups = [];
        for (let i = 0; i < setItems.length; i += 3) {
          const group = setItems.slice(i, i + 3);
          if (group.length) groups.push(group);
        }
        setTrack.innerHTML = groups.slice(0, 8).map((group, index, list) => renderProductSetSlide(group, index, list.length)).join('');
      }
    }, 0);
  };

  const initNavbarScroll = () => {
    const navEl = document.querySelector('.nav');
    if (!navEl) return;

    function updateNavState() {
      navEl.classList.toggle('is-scrolled', window.scrollY > 36);
    }

    updateNavState();
    window.addEventListener('load', updateNavState);
    window.addEventListener('scroll', updateNavState, { passive: true });
  };

  // SOLO en mobile (<= 768px): alterna el logo del navbar entre el logotipo
  // "HORIZON FIT" y el isotipo (el sÃ­mbolo) cada ~3.5s. En desktop ambos se ven
  // juntos por CSS, asÃ­ que no se toca.
  const initBrandSwap = () => {
    const isotipo = document.getElementById('brandIsotipo');
    const logotipo = document.getElementById('brandLogotipo');
    if (!isotipo || !logotipo) return;

    const mq = window.matchMedia('(max-width: 768px)');
    let timer = null;
    let showingIsotipo = false;

    const swap = () => {
      showingIsotipo = !showingIsotipo;
      isotipo.classList.toggle('is-visible', showingIsotipo);
      logotipo.classList.toggle('is-hidden', showingIsotipo);
    };

    const reset = () => {
      showingIsotipo = false;
      isotipo.classList.remove('is-visible');
      logotipo.classList.remove('is-hidden');
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(swap, 3500);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
      reset();
    };

    const apply = () => { mq.matches ? start() : stop(); };
    apply();
    mq.addEventListener('change', apply);
  };

  return { init, initNavbarAndMenuDrawer, initNavbarScroll };
})();

if (!window.__HF_PAGE_BUILDER_STARTED__) {
  window.__HF_PAGE_BUILDER_STARTED__ = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PAGE_BUILDER.init(), { once: true });
  } else {
    PAGE_BUILDER.init();
  }
}
