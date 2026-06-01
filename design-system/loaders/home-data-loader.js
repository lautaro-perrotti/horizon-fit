import { renderFeaturedProducts } from '../components/featured-products/featured-products.js';

async function initHomeData() {
  try {
    const response = await fetch('http://localhost:8089/wp-json/horizon-fit/v1/featured-products');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const products = await response.json();

    if (!Array.isArray(products) || products.length === 0) {
      console.warn('No products returned from API');
      return;
    }

    const featuredRoot = document.querySelector('.hf-product-scroll-shell');

    if (featuredRoot) {
      await renderFeaturedProducts(products, featuredRoot);
    } else {
      console.error('Missing .hf-product-scroll-shell element');
    }
  } catch (error) {
    console.error('initHomeData failed:', error);
  }
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initHomeData, 500);
  });
} else {
  setTimeout(initHomeData, 500);
}
