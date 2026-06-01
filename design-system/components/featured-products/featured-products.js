import { renderProductCard } from '../product-card/product-card.js';

export async function renderFeaturedProducts(products, root) {
  const grid = root.querySelector('#productGrid1');

  if (!grid) {
    console.error('renderFeaturedProducts: Missing #productGrid1 in root');
    return;
  }

  // Clear old products
  grid.querySelectorAll('.hf-product-item').forEach(card => card.remove());

  // Render each product
  const htmlCards = await Promise.all(products.map(renderProductCard));
  const html = htmlCards.filter(h => h.length > 0).join('');

  if (html) {
    grid.innerHTML = html;
  }
}
