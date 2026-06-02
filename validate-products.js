const fetch = require('node-fetch');

async function validate() {
  console.log('\n=== PASO 1: JSON ===\n');

  const jsonResponse = await fetch('http://localhost:8089/wp-content/uploads/horizon-fit-cache/featured-products.json');
  const products = await jsonResponse.json();

  const jsonTable = products.map(p => ({
    id: p.id,
    name: p.name.substring(0, 30),
    imageCount: Array.isArray(p.images) ? p.images.length : 0,
    image1: p.images?.[0]?.substring(60) || 'N/A',
    image2: p.images?.[1]?.substring(60) || 'N/A',
  }));

  console.table(jsonTable);

  console.log('\n=== PASO 2: DOM (necesita Puppeteer) ===\n');
  console.log('Para DOM, debe ejecutarse en navegador.');
  console.log('Abre DevTools en http://localhost:8088 y ejecuta:');
  console.log(`
console.table(
  [...document.querySelectorAll('#productGrid1 .hf-product-item')].map((card, i) => ({
    index: i,
    id: card.dataset.productId,
    name: card.querySelector('.hf-product-item__title')?.textContent.trim().substring(0, 30),
    slides: card.querySelectorAll('.hf-product-item__slide').length,
    dots: card.querySelectorAll('.hf-product-item__dot').length,
    img1: [...card.querySelectorAll('.hf-product-item__slide img')][0]?.src.substring(60) || 'N/A',
    img2: [...card.querySelectorAll('.hf-product-item__slide img')][1]?.src.substring(60) || 'N/A',
    img3: [...card.querySelectorAll('.hf-product-item__slide img')][2]?.src.substring(60) || 'N/A',
  }))
);
  `);
}

validate().catch(console.error);
