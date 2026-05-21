// API Loader: Fetch products from WordPress REST API and inject into DOM
(function() {
  const API_URL = 'http://localhost:8089/wp-json/wc/v3/products';

  async function loadProductsFromAPI() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const products = await response.json();
      if (!Array.isArray(products)) return;

      // Find the product grid container
      const gridContainer = document.querySelector('#productGrid1');
      if (!gridContainer) return;

      // Clear existing demo products
      gridContainer.innerHTML = '';

      // Render products from WordPress
      products.slice(0, 8).forEach(product => {
        const card = createProductCard(product);
        gridContainer.appendChild(card);
      });

      console.log(`Loaded ${products.length} products from WordPress`);
    } catch (error) {
      console.warn('Failed to load products from API, using demo products:', error);
      // Keep demo products if API fails
    }
  }

  function createProductCard(product) {
    const article = document.createElement('article');
    article.className = 'hf-product-item hf-product-item--slider';

    const images = product.images || [];
    const mainImage = images[0]?.src || 'https://via.placeholder.com/300';
    const price = product.price || '0';
    const regularPrice = product.regular_price || price;
    const discount = calculateDiscount(regularPrice, price);

    const imageSlides = images.slice(0, 3).map((img, idx) =>
      `<div class="hf-product-item__slide"><img src="${img.src}" alt="${product.name}" /></div>`
    ).join('');

    const dots = Array.from({ length: Math.min(3, images.length) }).map((_, idx) =>
      `<button class="hf-product-item__dot ${idx === 0 ? 'is-active' : ''}" data-slide="${idx}"></button>`
    ).join('');

    const installmentPrice = (price / 6).toFixed(2);

    article.innerHTML = `
      <div class="hf-product-item__media">
        ${discount ? `<span class="hf-product-item__badge">${discount}% OFF!</span>` : ''}
        <div class="hf-product-item__slider" data-slider>
          ${imageSlides || `<div class="hf-product-item__slide"><img src="${mainImage}" alt="${product.name}" /></div>`}
        </div>
        <div class="hf-product-item__dots">
          ${dots || '<button class="hf-product-item__dot is-active" data-slide="0"></button>'}
        </div>
      </div>
      <div class="hf-product-item__body">
        <div class="hf-product-item__sizes">
          <button class="hf-product-item__size" aria-pressed="false">S</button>
          <button class="hf-product-item__size" aria-pressed="false">M</button>
          <button class="hf-product-item__size" aria-pressed="false">L</button>
        </div>
        <h3 class="hf-product-item__title">${escapeHtml(product.name)}</h3>
        <div class="hf-product-item__pricing">
          <div class="hf-product-item__price-row">
            <span class="hf-product-item__price">$${price} ARS</span>
            ${regularPrice !== price ? `<span class="hf-product-item__price-original">$${regularPrice}</span>` : ''}
          </div>
          <p class="hf-product-item__installments">6 cuotas de: <a href="#" class="hf-product-item__installments-link">$${installmentPrice}</a></p>
        </div>
      </div>
    `;

    return article;
  }

  function calculateDiscount(original, current) {
    if (!original || !current || parseFloat(original) <= parseFloat(current)) return null;
    return Math.round((1 - parseFloat(current) / parseFloat(original)) * 100);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProductsFromAPI);
  } else {
    loadProductsFromAPI();
  }
})();
