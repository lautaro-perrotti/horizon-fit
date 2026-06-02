const PAGE_BUILDER = (() => {
  const textCache = new Map();
  const jsonCache = new Map();

  async function fetchText(url) {
    if (textCache.has(url)) return textCache.get(url);
    const promise = fetch(url, { cache: 'force-cache' }).then(r => {
      if (!r.ok) throw new Error(`Fetch failed: ${url} ${r.status}`);
      return r.text();
    });
    textCache.set(url, promise);
    return promise;
  }

  async function fetchJson(url) {
    if (jsonCache.has(url)) return jsonCache.get(url);
    const promise = fetch(url, { cache: 'force-cache' }).then(r => {
      if (!r.ok) throw new Error(`Fetch failed: ${url} ${r.status}`);
      return r.json();
    });
    jsonCache.set(url, promise);
    return promise;
  }

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

      let sections = pageConfig.sections
        .filter(s => s.visible !== false)
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

        root.appendChild(sectionEl);
      }
      console.log(`[HF PB] render HTML: ${Math.round(performance.now() - t2)}ms`);

      // Hydrate sections with data
      const t3 = performance.now();
      for (const section of sections) {
        if (section.type === 'featured-products' && section.data) {
          const data = dataMap.get(section.id);
          const sectionEl = root.querySelector(`[data-grid-shell="${section.id.replace(/[^a-zA-Z0-9-]/g, '')}"]`)?.parentElement || root.lastElementChild;
          if (data && sectionEl) await renderFeaturedProducts(sectionEl, section, data);
        }

        if (section.type === 'hero') {
          const sectionEl = root.querySelector('.hf-video-hero') || root.lastElementChild;
          if (sectionEl) setupHero(sectionEl);
        }
      }
      console.log(`[HF PB] hydrate sections: ${Math.round(performance.now() - t3)}ms`);
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
        if (link) link.href = product.permalink || '#';

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
      if (video.src !== src) {
        video.src = src;
        video.load();
      }
    };

    setVideoSrc();
    window.addEventListener('resize', setVideoSrc);
  };

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PAGE_BUILDER.init());
} else {
  PAGE_BUILDER.init();
}
