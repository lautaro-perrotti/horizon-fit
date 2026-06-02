/**
 * Featured Products Loader — Inyectar productos dinámicamente
 */

if (!window.FEATURED_PRODUCTS_LOADER) {
window.FEATURED_PRODUCTS_LOADER = (() => {
  const baseUrl = 'http://localhost:8089';
  const cacheUrl = 'http://localhost:8089/wp-content/uploads/horizon-fit-cache/featured-products.json';

  const fetchProducts = async (collectionSlug, limit) => {
    try {
      // Intentar desde cache JSON
      const response = await fetch(cacheUrl, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) {
        console.warn('Cache fetch failed, using REST API');
        return null;
      }

      let products = await response.json();

      // Filtrar por colección si está especificada
      if (collectionSlug) {
        products = products.filter(p => {
          const collections = p.collections || [];
          return collections.some(c => c.slug === collectionSlug);
        });
      }

      // Aplicar límite
      if (limit) {
        products = products.slice(0, limit);
      }

      return products;
    } catch (error) {
      console.error('Products fetch error:', error);
      return null;
    }
  };

  const init = async (sectionElement, section) => {
    const settings = section.settings || {};
    const collectionSlug = settings.collection_slug;
    const limit = settings.limit || 8;

    console.log('Loading featured products: collection=' + collectionSlug + ', limit=' + limit);

    const products = await fetchProducts(collectionSlug, limit);

    if (!products || products.length === 0) {
      console.warn('No products found');
      return;
    }

    // Encontrar el grid de productos
    const productGrid = sectionElement.querySelector('[data-products-grid]');
    if (!productGrid) {
      console.warn(' Product grid not found');
      return;
    }

    // Template
    const template = sectionElement.querySelector('[data-product-template]');
    if (!template) {
      console.warn(' Product template not found');
      return;
    }

    // Inyectar productos
    products.forEach((product) => {
      const clone = template.content.cloneNode(true);

      // Link del producto
      const link = clone.querySelector('.hf-product-item__link');
      if (link) {
        link.href = product.permalink;
      }

      // Imagen
      const images = product.imageObjects || [];
      const imgElements = clone.querySelectorAll('.hf-product-item__slide img');
      imgElements.forEach((img, idx) => {
        if (images[idx]) {
          img.src = images[idx].url;
          img.alt = images[idx].alt || product.name;
        }
      });

      // Título
      const title = clone.querySelector('.hf-product-item__title');
      if (title) {
        title.textContent = product.name;
      }

      // Precio
      const priceEl = clone.querySelector('.hf-product-item__price');
      if (priceEl && product.priceText) {
        priceEl.textContent = product.priceText;
      }

      // Badge
      const badge = clone.querySelector('.hf-product-item__badge');
      if (badge) {
        badge.textContent = product.badge || '';
      }

      // Tamaños
      const sizesEl = clone.querySelector('.hf-product-item__sizes');
      if (sizesEl && product.sizes && product.sizes.length > 0) {
        sizesEl.innerHTML = product.sizes.map(s => '<span>' + s + '</span>').join('');
      }

      productGrid.appendChild(clone);
    });

    // Inicializar carrusel si existe
    initCarousel(sectionElement);

    console.log(` Loaded ${products.length} products`);
  };

  const initCarousel = (sectionElement) => {
    const slider = sectionElement.querySelector('[data-slider]');
    if (!slider) return;

    const slides = slider.querySelectorAll('.hf-product-item__slide');
    if (slides.length <= 3) return; // No carrusel si hay pocas slides

    const dots = sectionElement.querySelectorAll('[data-slide]');
    let currentSlide = 0;

    const updateSlider = () => {
      slides.forEach((s, idx) => {
        const offset = (idx - currentSlide) * 100;
        s.style.transform = 'translateX(' + offset + '%)';
      });
      dots.forEach((d, idx) => {
        d.classList.toggle('is-active', idx === currentSlide);
      });
    };

    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        currentSlide = parseInt(e.target.dataset.slide);
        updateSlider();
      });
    });

    updateSlider();
  };

  return { init };
})();
}
