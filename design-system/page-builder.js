const PAGE_BUILDER = (() => {
  const init = async () => {
    const root = document.getElementById('hfPageBuilderRoot');
    if (!root) return;

    const pageSrc = root.getAttribute('data-page-src');
    if (!pageSrc) return;

    try {
      const pageConfigResp = await fetch(pageSrc);
      const pageConfig = await pageConfigResp.json();

      if (!pageConfig.sections) return;

      const sections = pageConfig.sections.sort((a, b) => (a.order || 0) - (b.order || 0));

      for (const section of sections) {
        if (section.visible === false) continue;

        const componentResp = await fetch(section.component);
        const componentHtml = await componentResp.text();

        const wrapper = document.createElement('div');
        wrapper.innerHTML = componentHtml;
        const sectionEl = wrapper.firstElementChild;

        if (section.config?.title) {
          const titleEl = sectionEl.querySelector('[data-section-title]');
          if (titleEl) titleEl.textContent = section.config.title;
        }

        if (section.type === 'featured-products' && section.data) {
          await renderFeaturedProducts(sectionEl, section);
        }

        if (section.type === 'hero') {
          setupHero(sectionEl);
        }

        root.appendChild(sectionEl);
      }
    } catch (e) {
      console.error('Page builder error:', e);
    }
  };

  const renderFeaturedProducts = async (sectionEl, section) => {
    try {
      const productsResp = await fetch(section.data);
      const products = await productsResp.json();

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
