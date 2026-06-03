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
  // Derivamos la base dinámicamente del host actual: funciona en local
  // (localhost:8088 -> localhost:8089) y en la VPS (IP:8088 -> IP:8089)
  // sin hardcodear nada ni depender de archivos estáticos.
  const WP_PORT = '8089';
  const WP_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${WP_PORT}`;
  const WP_SECTIONS_URL = `${WP_BASE_URL}/wp-json/wp/v2/pages/home/sections`;

  // Productos: cache estática de WordPress como fuente primaria (instantánea,
  // ~15ms, sin queries en runtime). Host dinámico, URLs correctas por entorno.
  // CORS se resuelve activando mod_headers en Apache (config del contenedor).
  // Fallback al REST solo si el archivo no estuviera disponible.
  const PRODUCT_DATA_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-products.json`;
  const PRODUCT_DATA_FALLBACK_SRC = `${WP_BASE_URL}/wp-json/wp/v2/pages/home/products`;
  const PRODUCT_DETAIL_COMPONENT = '/design-system/components/sections/product-detail.html';

  // Cache de una colección concreta (featured-row-1, featured-row-2, ...).
  const productCollectionSrc = (slug) =>
    `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-products-${slug}.json`;

  // Cache de "Conjuntos destacados": colecciones marcadas "Mostrar en home".
  const FEATURED_SETS_SRC = `${WP_BASE_URL}/wp-content/uploads/horizon-fit-cache/featured-sets.json`;

  // Resuelve una URL de media de WordPress. Acepta absolutas (http...) o
  // relativas ("/assets/..", "assets/..") y las deja servibles desde el SPA.
  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return rootUrl(url);
  };

  // Trae el mapa type -> settings desde WordPress. Si WP no responde, devuelve
  // un Map vacío y el sitio sigue funcionando con la config de home.json.
  const fetchWpSectionSettings = async () => {
    const map = new Map();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(WP_SECTIONS_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return map;
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const section of data) {
          if (section?.type && section.settings && !Array.isArray(section.settings)) {
            map.set(section.type, section.settings);
          }
        }
      }
    } catch (e) {
      console.warn('[HF PB] WordPress section settings unavailable, using local config:', e.message);
    }
    return map;
  };

  const isProductRoute = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'product' || window.location.pathname.replace(/\/+$/, '') === '/producto';
  };

  const productUrl = (product) => {
    const slug = product?.slug || '';
    return slug ? `/producto/?slug=${encodeURIComponent(slug)}` : '#';
  };

  const init = async () => {
    const startedAt = performance.now();
    const root = document.getElementById('hfPageBuilderRoot');
    if (!root) return;

    const pageSrc = root.getAttribute('data-page-src');
    if (!pageSrc) return;

    try {
      const productRoute = isProductRoute();
      const productPageSourcesPromise = productRoute ? Promise.all([
        fetchJson(PRODUCT_DATA_SRC).catch(async () => fetchJson(PRODUCT_DATA_FALLBACK_SRC)),
        fetchText(PRODUCT_DETAIL_COMPONENT)
      ]) : null;

      // Settings editables desde wp-admin (video del hero, etc). Se pide en
      // paralelo; si WP no está disponible se usa la config de home.json.
      const wpSettingsPromise = productRoute ? Promise.resolve(new Map()) : fetchWpSectionSettings();

      const t0 = performance.now();
      const pageConfig = await fetchJson(pageSrc);
      console.log(`[HF PB] fetch home.json: ${Math.round(performance.now() - t0)}ms`);

      if (!pageConfig.sections) return;

      let sections = pageConfig.sections
        .filter(s => s.visible !== false)
        .filter(s => !productRoute || s.type === 'marquee' || s.type === 'navbar')
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // Load all components and data in parallel
      const t1 = performance.now();
      const [componentEntries, dataEntries] = await Promise.all([
        Promise.all(sections.map(async s => {
          const html = await fetchText(s.component);
          return [s.id, html];
        })),
        Promise.all(sections.filter(s => s.data || s.type === 'featured-sets').map(async s => {
          // featured-products: cada fila trae SU colección (config.collection),
          // administrada desde wp-admin (taxonomía hf_collection). Cache por
          // colección; fallback a la cache general y luego al REST.
          if (s.type === 'featured-products') {
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
      for (const section of sections) {
        const componentHtml = componentMap.get(section.id);
        if (!componentHtml) continue;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = componentHtml;
        const sectionEl = wrapper.firstElementChild;
        sectionElements.set(section.id, sectionEl);

        // Handle optional title
        if (section.config?.title) {
          const titleEl = sectionEl.querySelector('[data-section-title]');
          if (titleEl) titleEl.textContent = section.config.title;
        } else {
          const headEl = sectionEl.querySelector('.hf-section-head');
          if (headEl) headEl.style.display = 'none';
        }

        if (productRoute && (section.type === 'marquee' || section.type === 'navbar')) {
          document.body.insertBefore(sectionEl, root);
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

      let productPageProducts = null;
      let productPageTemplate = null;
      if (productRoute) {
        [productPageProducts, productPageTemplate] = await productPageSourcesPromise;
        await renderProductPage(root, productPageProducts, productPageTemplate);
      }
      console.log(`[HF PB] render HTML: ${Math.round(performance.now() - t2)}ms`);

      // Hydrate sections with data
      const t3 = performance.now();
      const wpSettings = await wpSettingsPromise;
      for (const section of sections) {
        if (!productRoute && section.type === 'featured-products' && section.data) {
          const data = dataMap.get(section.id);
          const sectionEl = sectionElements.get(section.id);
          if (data && sectionEl) await renderFeaturedProducts(sectionEl, section, data);
        }

        if (!productRoute && section.type === 'hero') {
          const sectionEl = sectionElements.get(section.id);
          // wp-admin manda: si la Sección hero tiene settings de video, ganan;
          // si no, se usa la config local de home.json.
          const heroConfig = { ...(section.config || {}), ...(wpSettings.get('hero') || {}) };
          if (sectionEl) setupHero(sectionEl, heroConfig);
        }

        if (!productRoute && section.type === 'featured-sets') {
          const sets = dataMap.get(section.id) || [];
          const sectionEl = sectionElements.get(section.id);
          const variant = section.component.includes('mobile') ? 'mobile' : 'desktop';
          if (sectionEl) renderFeaturedSets(sectionEl, sets, variant);
        }
      }
      console.log(`[HF PB] hydrate sections: ${Math.round(performance.now() - t3)}ms`);
      initNavbarAndMenuDrawer();
      initNavbarScroll();
      console.log(`[HF PB] TOTAL: ${Math.round(performance.now() - startedAt)}ms`);
      document.documentElement.dataset.pageBuilderReady = 'true';
    } catch (e) {
      console.error('Page builder error:', e);
    }
  };

  const renderFeaturedProducts = async (sectionEl, section, products) => {
    try {
      const limit = Number(section.config?.limit || 0);
      const visibleProducts = limit > 0 ? products.slice(0, limit) : products;

      const grid = sectionEl.querySelector('[data-products-slot]') || sectionEl.querySelector('[data-products-grid]');
      if (!grid) return;

      const template = sectionEl.querySelector('[data-product-template]');
      if (!template) return;

      visibleProducts.forEach(product => {
        const clone = template.content.cloneNode(true);

        const link = clone.querySelector('.hf-product-item__link');
        if (link) link.href = productUrl(product);

        const title = clone.querySelector('.hf-product-item__title');
        if (title) title.textContent = product.name || '';

        const price = clone.querySelector('.hf-product-item__price');
        if (price) price.textContent = product.priceText || '';

        const priceOrig = clone.querySelector('.hf-product-item__price-original');
        if (priceOrig) priceOrig.textContent = product.priceOriginal || '';

        const badge = clone.querySelector('.hf-product-item__badge');
        if (badge) badge.textContent = product.badge || '';

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
        if (sizesEl && product.sizes && product.sizes.length > 0) {
          sizesEl.innerHTML = product.sizes.map(s => '<span>' + s + '</span>').join('');
        }

        grid.appendChild(clone);
      });

      console.log('Rendered ' + visibleProducts.length + ' featured products');
    } catch (e) {
      console.error('Featured products error:', e);
    }
  };

  const setupHero = (sectionEl, config = {}) => {
    const video = sectionEl.querySelector('#heroVideo');
    if (!video) return;

    // Las URLs de los videos vienen de wp-admin (Sección hero) o de home.json.
    // Si no están, se usan los atributos data-* del HTML como fallback.
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

      // Poster según breakpoint (mobile cae a desktop si no hay).
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

    overlay.addEventListener("click", () => {
      if (menuDrawer?.classList.contains("is-on")) closeMenuDrawer();
      if (drawer.classList.contains("is-on")) closeDrawer();
      if (searchDrawer.classList.contains("is-on")) closeSearchDrawer();
    });

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

  const getAttributeValues = (product, label) => {
    const attr = product?.attributes?.find(item => {
      const name = `${item.label || item.name || ''}`.toLowerCase();
      return name.includes(label);
    });
    return attr?.values?.map(value => value.name || value.slug).filter(Boolean) || [];
  };

  const normalizeSku = (value) => `${value || ''}`.trim();

  const skuPrefix = (value, length = 7) => {
    const sku = normalizeSku(value);
    return sku ? sku.slice(0, length) : '';
  };

  const productSkuPrefix = (product) => {
    const skuCandidates = [
      product?.sku,
      ...(Array.isArray(product?.variations) ? product.variations.map(variation => variation?.sku).filter(Boolean) : []),
    ];

    for (const candidate of skuCandidates) {
      const prefix = skuPrefix(candidate);
      if (prefix) return prefix;
    }

    return '';
  };

  const productFamilyKey = (product) => {
    const slug = `${product?.slug || ''}`.toLowerCase().trim();
    if (!slug) return '';

    const colorWords = ['blanco', 'negro', 'bordo', 'bordÃ³', 'bordeaux', 'azul', 'verde', 'gris', 'arena', 'nude', 'rojo', 'rosa', 'marron', 'marrón', 'lila', 'violeta'];
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
    if (!slug) return false;
    const permalinkSlug = `${product?.permalink || ''}`.replace(/\/$/, '').split('/').pop();
    return [product?.slug, product?.post_name, product?.handle, permalinkSlug]
      .filter(Boolean)
      .some(value => value === slug);
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

  const DEFAULT_CARE = {
    title: 'Lavado y cuidado',
    text: 'Lavar a mano o en ciclo delicado con agua fría. Usar jabón neutro y evitar suavizantes para conservar la elasticidad del tejido.',
    bullets: [
      'No usar lavandina.',
      'No centrifugar en caliente.',
      'Secar a la sombra y no planchar sobre estampas o avíos.'
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

  const renderSizeTableHeader = (headers) => headers.map(header => `<th>${escapeHtml(header)}</th>`).join('');

  const renderSizeTableRows = (rows) => rows.map(row => {
    const cells = Array.isArray(row) ? row : [];
    return `<tr>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
  }).join('');

  // `meta` (opcional) permite sobreescribir título/copy/imagen del conjunto
  // (vienen de la colección en wp-admin). Si no se pasa, se infieren del
  // primer producto (comportamiento usado por la PDP).
  const renderProductSetSlide = (items, index, total, meta = null) => {
    const heroProduct = items[0];
    const heroImage = getProductImages(heroProduct)[0];
    const title = meta?.title || heroProduct?.collections?.[0]?.name || `Conjunto ${index + 1}`;
    const tag = meta?.copy || heroProduct?.categories?.map(item => item.name).filter(Boolean).join(' / ') || `Conjunto ${index + 1} de ${total}`;
    const heroUrl = meta?.image || heroImage?.url || '';
    return `
          <div class="hf-carousel__slide">
            <section class="hf-pdp-look" aria-label="${escapeHtml(title)}">
              <div class="hf-pdp-look__panel">
                <p class="hf-pdp-look__eyebrow">Conjunto ${index + 1} de ${total}</p>
                <h2 class="hf-pdp-look__title">${escapeHtml(title)}</h2>
                <div class="hf-pdp-look__list" tabindex="0" role="region" aria-label="Lista de productos del look completo">
                  ${items.map(renderLookItem).join('')}
                </div>
              </div>
              <div class="hf-pdp-look__visual">
                <span class="hf-pdp-look__tag">${escapeHtml(tag)}</span>
                <img class="hf-pdp-look__hero" src="${escapeHtml(heroUrl)}" alt="${escapeHtml(title)} look principal">
              </div>
            </section>
          </div>`;
  };

  // Card de un conjunto para la vista mobile (carousel de cards).
  const renderSetMobileCard = (set) => {
    const firstProduct = set.products?.[0];
    const href = firstProduct ? productUrl(firstProduct) : '#';
    const imageUrl = set.image?.url || getProductImages(firstProduct)[0]?.url || '';
    return `
            <div class="hf-carousel__slide">
              <article class="hf-product-item">
                <div class="productMedia" style="background:none;">
                  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(set.name || '')}">
                </div>
                <div class="hf-product-item__body">
                  <a href="${href}" aria-label="Ver ${escapeHtml(set.name || 'conjunto')}" class="hf-product-item__link">
                    <h3 class="hf-product-item__title">${escapeHtml(set.name || '')}</h3>
                  </a>
                  <p class="small" style="margin-bottom: 8px;">${escapeHtml(set.copy || '')}</p>
                </div>
              </article>
            </div>`;
  };

  // Renderiza el slider "Conjuntos destacados" en su variante (desktop/mobile).
  // Vacía el track del carousel, inyecta los slides de cada conjunto y
  // reinicializa el carousel. Si no hay conjuntos, oculta la sección.
  const renderFeaturedSets = (sectionEl, sets, variant) => {
    const track = sectionEl.querySelector('.hf-carousel__track');
    if (!track) return;

    if (!Array.isArray(sets) || sets.length === 0) {
      sectionEl.style.display = 'none';
      return;
    }

    const total = sets.length;
    if (variant === 'mobile') {
      track.innerHTML = sets.map(renderSetMobileCard).join('');
    } else {
      track.innerHTML = sets.map((set, i) =>
        renderProductSetSlide(set.products || [], i, total, {
          title: set.name,
          copy: set.copy,
          image: set.image?.url
        })
      ).join('');
    }

    // Reinicializar el carousel sobre los slides recién inyectados.
    const carousel = track.closest('[data-hf="carousel"]');
    if (carousel) carousel._hfCarousel = null;
    if (typeof window.initDataCarousels === 'function') window.initDataCarousels();
  };

  const renderProductPage = async (root, products, html) => {
    if (!products || !html) {
      [products, html] = await Promise.all([
        fetchJson(PRODUCT_DATA_SRC).catch(async () => fetchJson(PRODUCT_DATA_FALLBACK_SRC)),
        fetchText(PRODUCT_DETAIL_COMPONENT)
      ]);
    }

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug') || params.get('product');
    const product = products.find(item => productMatchesSlug(item, slug)) || products[0];
    if (slug && product && !productMatchesSlug(product, slug)) {
      console.warn(`[HF PB] Product slug not found: ${slug}. Rendering first product.`);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const sectionEl = wrapper.firstElementChild;
    if (!sectionEl || !product) return;

    document.body.classList.add('hf-product-mode');
    sectionEl.hidden = false;

    const $ = (sel, base = sectionEl) => base.querySelector(sel);
    const $$ = (sel, base = sectionEl) => Array.from(base.querySelectorAll(sel));
    const images = getProductImages(product);
    const mainImage = $('[data-product-main-image]');
    const mainMedia = $('[data-product-main]');
    const lookImage = $('[data-product-look-image]');
    const lookTag = $('[data-product-look-tag]');
    const lookList = $('[data-product-look-list]');
    const setText = (sel, value) => {
      const el = $(sel);
      if (el) el.textContent = value || '';
      return el;
    };

    document.title = `${product.name || 'Producto'} | Horizon Fit`;
    setText('.hf-pdp-view__title', product.name || '');
    setText('.hf-pdp-view__price', product.priceText || product.regularPriceText || '');
    setText('.hf-pdp-view__compare', product.priceOriginal || '');
    setText('[data-product-installments]', product.stockStatus === 'instock' ? 'Disponible' : 'Sin stock');
    const transferEl = $('[data-product-transfer]');
    if (transferEl) transferEl.hidden = true;
    const descriptionTitle = $('[data-product-description-title]');
    if (descriptionTitle) descriptionTitle.textContent = product.descriptionTitle || 'Descripción';
    setText('[data-product-description]', product.description || product.shortDescription || 'Diseño, textura y comodidad en equilibrio. Este producto está pensado para acompañar cada movimiento sin perder estilo ni confort.');

    const care = normalizeCare(product);
    const careTitle = $('[data-product-care-title]');
    const careText = $('[data-product-care-text]');
    const careList = $('[data-product-care-list]');
    if (careTitle) careTitle.textContent = care.title;
    if (careText) careText.textContent = care.text;
    if (careList) {
      careList.innerHTML = care.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    }

    const sizeTable = normalizeSizeTable(product);
    const sizeTitle = $('[data-product-size-title]');
    const sizeTableHead = $('[data-product-size-table-head]');
    const sizeTableBody = $('[data-product-size-table-body]');
    if (sizeTitle) sizeTitle.textContent = sizeTable.title;
    if (sizeTableHead) sizeTableHead.innerHTML = renderSizeTableHeader(sizeTable.headers);
    if (sizeTableBody) sizeTableBody.innerHTML = renderSizeTableRows(sizeTable.rows);

    const category = product.categories?.map(item => item.name).filter(Boolean).join(' / ') || '';
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
    let selectedSize = sizes[0] || '';
    sizeButtons.forEach((btn, idx) => {
      const size = sizes[idx] || btn.textContent.trim();
      btn.textContent = size;
      btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      if (idx === 0) {
        selectedSize = size;
        if (sizeLabel) sizeLabel.textContent = size;
      }
      btn.addEventListener('click', () => {
        $$('.hf-pdp-view__size', sizesSlot).forEach(item => item.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        selectedSize = size;
        if (sizeLabel) sizeLabel.textContent = size;
      });
    });
    if (!sizes.length && sizeLabel) sizeLabel.textContent = '-';

    const colorVariants = getColorVariants(product, products);
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

    const currentColor = (() => {
      const colorAttr = product?.attributes?.find(item => `${item.label || item.name || ''}`.toLowerCase().includes('color'));
      const value = colorAttr?.values?.[0];
      return value?.name || value?.slug || '';
    })();

    const cartDrawer = $("#drawer");
    const cartEmpty = cartDrawer?.querySelector("[data-cart-empty]");
    const cartSubtotal = cartDrawer?.querySelector("#cartSubtotal");
    const cartField = cartDrawer?.querySelector(".field");
    const cartBody = cartDrawer?.querySelector(".drawer__bd");
    const cartSummaryId = "hf-spa-cart-summary";
    const cartFrameId = "hf-cart-submit-frame";

    const readSpaCartItems = () => {
      try {
        const raw = window.localStorage.getItem("hf-spa-cart-items");
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    };

    const writeSpaCartItems = (items) => {
      try {
        window.localStorage.setItem("hf-spa-cart-items", JSON.stringify(items));
      } catch (error) {
        // no-op
      }
    };

    const formatSpaMoney = (value) => {
      const amount = Number(value) || 0;
      const formatted = new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
      return `$ ${formatted}`;
    };

    const renderSpaCartDrawer = () => {
      if (!cartDrawer || !cartBody) return;

      let summary = cartDrawer.querySelector(`[data-spa-cart-summary="${cartSummaryId}"]`);
      if (!summary) {
        summary = document.createElement("div");
        summary.setAttribute("data-spa-cart-summary", cartSummaryId);
        cartBody.insertBefore(summary, cartField || cartBody.firstChild || null);
      }

      const items = readSpaCartItems();
      if (!items.length) {
        summary.innerHTML = "";
        summary.hidden = true;
        if (cartEmpty) cartEmpty.hidden = false;
        if (cartSubtotal) cartSubtotal.textContent = "$ 0,00";
        return;
      }

      summary.hidden = false;
      if (cartEmpty) cartEmpty.hidden = true;

      summary.innerHTML = items.map(item => {
        const details = [item.size, item.color].filter(Boolean).join(" / ");
        return `
          <div>
            <div>${item.name || "Producto"}</div>
            ${details ? `<div>${details}</div>` : ""}
            <div>${item.priceText || ""}</div>
          </div>
        `;
      }).join("");

      const subtotal = items.reduce((total, item) => total + (Number(item.price) || 0), 0);
      if (cartSubtotal) {
        cartSubtotal.textContent = formatSpaMoney(subtotal);
      }
    };

    const addSpaCartItem = (item) => {
      const items = readSpaCartItems();
      items.push(item);
      writeSpaCartItems(items);
      renderSpaCartDrawer();
    };

    renderSpaCartDrawer();

    const findVariationForSelection = () => {
      if (!Array.isArray(product?.variations) || !product.variations.length) {
        return null;
      }

      const normalizedSize = `${selectedSize || ''}`.trim();
      const normalizedColor = `${currentColor || ''}`.trim();

      const match = product.variations.find(variation => {
        const attrs = variation?.attributes || {};
        const sizeMatch = normalizedSize ? `${attrs.talle || attrs.size || ''}` === normalizedSize : true;
        const colorMatch = normalizedColor ? `${attrs.color || ''}` === normalizedColor : true;
        return sizeMatch && colorMatch;
      });

      return match || product.variations[0] || null;
    };

    const addToCartButton = $('[data-product-add-to-cart]') || $('.hf-pdp-view__button--primary');
    if (addToCartButton) {
      addToCartButton.addEventListener('click', (event) => {
        event.preventDefault();

        const variation = findVariationForSelection();
        let frame = document.getElementById(cartFrameId);
        if (!frame) {
          frame = document.createElement('iframe');
          frame.id = cartFrameId;
          frame.name = cartFrameId;
          frame.title = 'Cart submit frame';
          frame.setAttribute('aria-hidden', 'true');
          frame.style.display = 'none';
          document.body.appendChild(frame);
        }

        const form = document.createElement('form');
        form.method = 'post';
        form.action = product.permalink || window.location.href;
        form.target = cartFrameId;
        form.style.display = 'none';

        const addToCartInput = document.createElement('input');
        addToCartInput.type = 'hidden';
        addToCartInput.name = 'add-to-cart';
        addToCartInput.value = product.id || '';
        form.appendChild(addToCartInput);

        const productIdInput = document.createElement('input');
        productIdInput.type = 'hidden';
        productIdInput.name = 'product_id';
        productIdInput.value = product.id || '';
        form.appendChild(productIdInput);

        const quantityInput = document.createElement('input');
        quantityInput.type = 'hidden';
        quantityInput.name = 'quantity';
        quantityInput.value = '1';
        form.appendChild(quantityInput);

        if (variation && variation.id) {
          const variationIdInput = document.createElement('input');
          variationIdInput.type = 'hidden';
          variationIdInput.name = 'variation_id';
          variationIdInput.value = variation.id;
          form.appendChild(variationIdInput);

          const attrs = variation.attributes || {};
          Object.keys(attrs).forEach((key) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `attribute_${key}`;
            input.value = attrs[key];
            form.appendChild(input);
          });
        }

        document.body.appendChild(form);
        addSpaCartItem({
          id: product.id,
          slug: product.slug,
          name: product.name,
          size: selectedSize || '',
          color: currentColor || '',
          price: Number(product.price) || 0,
          priceText: product.priceText || '',
        });
        if (!cartDrawer?.classList.contains('is-on')) {
          $("#cartBtn")?.click();
        }
        frame.onload = () => {
          form.remove();
        };
        form.submit();
      });
    }

    $$('.hf-pdp-view__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const name = tab.getAttribute('data-product-tab');
        $$('.hf-pdp-view__tab').forEach(item => item.setAttribute('aria-selected', item === tab ? 'true' : 'false'));
        $$('.hf-pdp-view__panel').forEach(panel => {
          panel.classList.toggle('is-active', panel.getAttribute('data-product-panel') === name);
        });
      });
    });

    root.appendChild(sectionEl);

    window.setTimeout(() => {
      const related = products.filter(item => item.slug !== product.slug);

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
        const setItems = related.length ? related : products.filter(Boolean);
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

