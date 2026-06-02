const baseUrl = 'http://localhost:8089';
const cacheUrl = 'http://localhost:8089/wp-json/wp/v2/pages/home/products';

window.FEATURED_PRODUCTS_LOADER = {
  async fetchProducts(collectionSlug, limit) {
    try {
      const response = await fetch(cacheUrl, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) {
        console.warn('Cache fetch failed');
        return null;
      }

      let products = await response.json();

      if (collectionSlug) {
        products = products.filter(p => {
          const collections = p.collections || [];
          return collections.some(c => c.slug === collectionSlug);
        });
      }

      if (limit) {
        products = products.slice(0, limit);
      }

      return products;
    } catch (error) {
      console.error('Products fetch error:', error);
      return null;
    }
  },

  async init(sectionElement, section) {
    const settings = section.settings || {};
    const collectionSlug = settings.collection_slug;
    const limit = settings.limit || 8;

    console.log('Loading featured products: collection=' + collectionSlug + ', limit=' + limit);

    const products = await this.fetchProducts(collectionSlug, limit);

    if (!products || products.length === 0) {
      console.warn('No products found');
      return;
    }

    const productGrid = sectionElement.querySelector('[data-products-grid]');
    if (!productGrid) {
      console.warn('Product grid not found');
      return;
    }

    const template = sectionElement.querySelector('[data-product-template]');
    if (!template) {
      console.warn('Product template not found');
      return;
    }

    products.forEach((product) => {
      const clone = template.content.cloneNode(true);

      const link = clone.querySelector('.hf-product-item__link');
      if (link) {
        link.href = product.permalink;
      }

      const images = product.imageObjects || [];
      const imgElements = clone.querySelectorAll('.hf-product-item__slide img');
      imgElements.forEach((img, idx) => {
        if (images[idx]) {
          img.src = images[idx].url;
          img.alt = images[idx].alt || product.name;
        }
      });

      const title = clone.querySelector('.hf-product-item__title');
      if (title) {
        title.textContent = product.name;
      }

      const priceEl = clone.querySelector('.hf-product-item__price');
      if (priceEl && product.priceText) {
        priceEl.textContent = product.priceText;
      }

      const badge = clone.querySelector('.hf-product-item__badge');
      if (badge) {
        badge.textContent = product.badge || '';
      }

      const sizesEl = clone.querySelector('.hf-product-item__sizes');
      if (sizesEl && product.sizes && product.sizes.length > 0) {
        sizesEl.innerHTML = product.sizes.map(s => '<span>' + s + '</span>').join('');
      }

      productGrid.appendChild(clone);
    });

    console.log('Loaded ' + products.length + ' products');
  }
};
