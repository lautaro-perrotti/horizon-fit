import { renderFeaturedProducts } from '../components/featured-products/featured-products.js';

const CACHE_KEY = 'horizon_featured_products';
const CACHE_TTL = 3600000; // 1 hour

async function initHomeData() {
  try {
    // Fetch estático JSON desde Apache (sin PHP, sin queries)
    const response = await fetch('http://localhost:8089/wp-content/uploads/horizon-fit-cache/featured-products.json', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const products = await response.json();

    if (!Array.isArray(products) || products.length === 0) {
      console.warn('No products in cache');
      return;
    }

    // Cache results locally for offline resilience
    localStorage.setItem(CACHE_KEY, JSON.stringify(products));
    localStorage.setItem(CACHE_KEY + '_time', String(Date.now()));

    await renderToDOM(products);
  } catch (error) {
    console.error('Failed to load products:', error);

    // Fallback to localStorage if network fails
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      console.warn('Using cached products (offline mode)');
      const products = JSON.parse(cached);
      await renderToDOM(products);
    }
  }
}

async function renderToDOM(products) {
  const featuredRoot = document.querySelector('.hf-product-scroll-shell');
  if (featuredRoot) {
    await renderFeaturedProducts(products, featuredRoot);
  } else {
    console.error('Missing .hf-product-scroll-shell');
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initHomeData, 500);
  });
} else {
  setTimeout(initHomeData, 500);
}
