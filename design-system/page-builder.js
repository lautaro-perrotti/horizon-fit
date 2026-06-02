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

  const PRODUCT_DATA_SRC = '/design-system/data/featured-products.json';
  const PRODUCT_DETAIL_COMPONENT = '/design-system/components/sections/product-detail.html';

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
      const t0 = performance.now();
      const pageConfig = await fetchJson(pageSrc);
      console.log(`[HF PB] fetch home.json: ${Math.round(performance.now() - t0)}ms`);

      if (!pageConfig.sections) return;

      const productRoute = isProductRoute();
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
        Promise.all(sections.filter(s => s.data).map(async s => {
          const data = await fetchJson(s.data);
          return [s.id, data];
        }))
      ]);
      console.log(`[HF PB] fetch all components & data: ${Math.round(performance.now() - t1)}ms`);

      const componentMap = new Map(componentEntries);
      const dataMap = new Map(dataEntries);

      // Render sections in order
      const t2 = performance.now();
      for (const section of sections) {
        const componentHtml = componentMap.get(section.id);
        if (!componentHtml) continue;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = componentHtml;
        const sectionEl = wrapper.firstElementChild;

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

      if (productRoute) {
        await renderProductPage(root);
      }
      console.log(`[HF PB] render HTML: ${Math.round(performance.now() - t2)}ms`);

      // Hydrate sections with data
      const t3 = performance.now();
      for (const section of sections) {
        if (!productRoute && section.type === 'featured-products' && section.data) {
          const data = dataMap.get(section.id);
          const sectionEl = root.querySelector(`[data-grid-shell="${section.id.replace(/[^a-zA-Z0-9-]/g, '')}"]`)?.parentElement || root.lastElementChild;
          if (data && sectionEl) await renderFeaturedProducts(sectionEl, section, data);
        }

        if (!productRoute && section.type === 'hero') {
          const sectionEl = root.querySelector('.hf-video-hero') || root.lastElementChild;
          if (sectionEl) setupHero(sectionEl);
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

  const setupHero = (sectionEl) => {
    const video = sectionEl.querySelector('#heroVideo');
    if (!video) return;

    const setVideoSrc = () => {
      const isMobile = window.innerWidth <= 768;
      const src = isMobile ? video.getAttribute('data-mobile') : video.getAttribute('data-desktop');
      const nextSrc = rootUrl(src || '');
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

  const renderProductSetSlide = (items, index, total) => {
    const heroProduct = items[0];
    const heroImage = getProductImages(heroProduct)[0];
    const title = heroProduct?.collections?.[0]?.name || `Conjunto ${index + 1}`;
    const meta = heroProduct?.categories?.map(item => item.name).filter(Boolean).join(' / ') || `Conjunto ${index + 1} de ${total}`;
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
                <span class="hf-pdp-look__tag">${escapeHtml(meta)}</span>
                <img class="hf-pdp-look__hero" src="${escapeHtml(heroImage?.url || '')}" alt="${escapeHtml(title)} look principal">
              </div>
            </section>
          </div>`;
  };

  const renderProductPage = async (root) => {
    const [products, html] = await Promise.all([
      fetchJson(PRODUCT_DATA_SRC),
      fetchText(PRODUCT_DETAIL_COMPONENT)
    ]);

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
    setText('[data-product-description]', product.description || product.shortDescription || 'Diseno, textura y comodidad en equilibrio. Este producto esta pensado para acompanar cada movimiento sin perder estilo ni confort.');

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
    sizeButtons.forEach((btn, idx) => {
      const size = sizes[idx] || btn.textContent.trim();
      btn.textContent = size;
      btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      if (idx === 0 && sizeLabel) sizeLabel.textContent = size;
      btn.addEventListener('click', () => {
        $$('.hf-pdp-view__size', sizesSlot).forEach(item => item.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        if (sizeLabel) sizeLabel.textContent = size;
      });
    });
    if (!sizes.length && sizeLabel) sizeLabel.textContent = '-';

    const colors = getAttributeValues(product, 'color');
    const colorsSlot = $('[data-product-colors]');
    colors.forEach((color, idx) => {
      const btn = document.createElement('button');
      btn.className = 'hf-pdp-view__color';
      btn.type = 'button';
      btn.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', color);
      if (images[idx]) {
        const img = document.createElement('img');
        img.src = images[idx].url;
        img.alt = color;
        btn.appendChild(img);
      } else {
        btn.textContent = color;
      }
      btn.addEventListener('click', () => {
        $$('.hf-pdp-view__color', colorsSlot).forEach(item => item.setAttribute('aria-current', 'false'));
        btn.setAttribute('aria-current', 'true');
      });
      colorsSlot?.appendChild(btn);
    });
    if (!colors.length) colorsSlot?.closest('.hf-pdp-view__color-row')?.setAttribute('hidden', '');

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PAGE_BUILDER.init());
} else {
  PAGE_BUILDER.init();
}

