(() => {
  const STATIC_PRODUCTS_URL =
    'http://localhost:8089/wp-content/uploads/horizon-fit-cache/proxy.php';

  const STATUS = {
    loaded: false,
    startedAt: null,
    finishedAt: null,
    url: STATIC_PRODUCTS_URL,
    error: null,
    productsCount: 0,
    cardsBefore: 0,
    cardsAfter: 0,
    usedFallback: false,
  };

  window.__HF_FEATURED_PRODUCTS_LOADER__ = STATUS;

  function log(...args) {
    console.log('[HF FeaturedProducts]', ...args);
  }

  function warn(...args) {
    console.warn('[HF FeaturedProducts]', ...args);
  }

  function setText(root, selector, value) {
    const el = root.querySelector(selector);
    if (el) el.textContent = value || '';
  }

  function setLinks(root, url) {
    root.querySelectorAll('a').forEach((a) => {
      a.href = url || '#';
    });
  }

  function setImages(card, product) {
    const productImages = Array.isArray(product.images)
      ? product.images.filter(Boolean)
      : [];

    const first = productImages[0] || product.image || product.hoverImage || '';
    const second = productImages[1] || product.hoverImage || first;

    const finalImages = [first, second];

    const slides = [...card.querySelectorAll('.hf-product-item__slide')];

    slides.forEach((slide, index) => {
      const img = slide.querySelector('img');

      if (index > 1) {
        slide.remove();
        return;
      }

      const src = finalImages[index] || first;

      if (img && src) {
        img.src = src;
        img.alt = product.name || '';
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      }
    });

    const dots = [...card.querySelectorAll('.hf-product-item__dot')];

    dots.forEach((dot, index) => {
      if (index > 1) {
        dot.remove();
        return;
      }

      dot.dataset.slide = String(index);
      dot.classList.toggle('is-active', index === 0);
    });
  }

  function hydrateCard(card, product) {
    card.dataset.productId = product.id || '';

    setLinks(card, product.permalink);

    setText(card, '.hf-product-item__title', product.name);
    setText(card, '.hf-product-item__price', product.priceText);
    setText(card, '.hf-product-item__installments', product.installmentsText);
    setText(card, '.hf-product-item__transfer', product.transferText);

    setImages(card, product);

    return card;
  }

  async function fetchProducts() {
    const response = await fetch(STATIC_PRODUCTS_URL, {
      cache: 'no-store',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`JSON request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('featured-products.json must be an array');
    }

    return data.slice(0, 8);
  }

  async function loadFeaturedProducts() {
    STATUS.loaded = false;
    STATUS.startedAt = new Date().toISOString();
    STATUS.error = null;

    const grid = document.querySelector('#productGrid1');

    if (!grid) {
      STATUS.error = 'Missing #productGrid1';
      warn(STATUS.error);
      return;
    }

    STATUS.cardsBefore = grid.querySelectorAll('.hf-product-item').length;

    const template = grid.querySelector('.hf-product-item');

    if (!template) {
      STATUS.error = 'Missing .hf-product-item template inside #productGrid1';
      warn(STATUS.error);
      return;
    }

    let products;

    try {
      products = await fetchProducts();
    } catch (error) {
      STATUS.error = error.message;
      STATUS.usedFallback = true;
      warn('Fetch failed. Keeping hardcoded products untouched.', error);
      return;
    }

    STATUS.productsCount = products.length;

    if (!products.length) {
      STATUS.error = 'JSON returned zero products';
      STATUS.usedFallback = true;
      warn('No products. Keeping hardcoded products untouched.');
      return;
    }

    const templateClone = template.cloneNode(true);
    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
      const card = templateClone.cloneNode(true);
      fragment.appendChild(hydrateCard(card, product));
    });

    // Recién acá se vacía el grid. Si algo falla antes, queda el hardcodeado.
    grid.innerHTML = '';
    grid.appendChild(fragment);

    STATUS.cardsAfter = grid.querySelectorAll('.hf-product-item').length;
    STATUS.finishedAt = new Date().toISOString();
    STATUS.loaded = true;

    log('Rendered products:', {
      products: STATUS.productsCount,
      cardsBefore: STATUS.cardsBefore,
      cardsAfter: STATUS.cardsAfter,
      names: [...grid.querySelectorAll('.hf-product-item__title')].map((e) =>
        e.textContent.trim()
      ),
    });
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      loadFeaturedProducts().catch((error) => {
        STATUS.error = error.message;
        STATUS.usedFallback = true;
        warn('Unexpected loader error. Keeping current DOM.', error);
      });
    }, 1000);
  });
})();
