function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

export async function renderProductCard(product) {
  const templateText = await fetch(
    'design-system/components/product-card/product-card.template.html'
  ).then(r => r.text());

  if (!product.images || product.images.length === 0) {
    console.warn('Product has no images:', product.name);
    return '';
  }

  // Build slides
  const slides = product.images
    .map(img => `<div class="hf-product-item__slide"><img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)}"></div>`)
    .join('');

  // Build dots
  const dots = product.images
    .map((_, idx) => `<button class="hf-product-item__dot ${idx === 0 ? 'is-active' : ''}" data-slide="${idx}"></button>`)
    .join('');

  // Replace placeholders
  let html = templateText
    .replaceAll('{{slides}}', slides)
    .replaceAll('{{dots}}', dots)
    .replaceAll('{{name}}', escapeHtml(product.name))
    .replaceAll('{{priceText}}', escapeHtml(product.priceText))
    .replaceAll('{{priceOriginal}}', escapeHtml(product.priceOriginal || ''))
    .replaceAll('{{installmentsText}}', escapeHtml(product.installmentsText))
    .replaceAll('{{transferText}}', escapeHtml(product.transferText))
    .replaceAll('{{permalink}}', escapeHtml(product.permalink))
    .replaceAll('{{badge}}', escapeHtml(product.badge || ''));

  // Remove conditional blocks for missing data
  if (!product.badge) {
    html = html.replace(/<span class="hf-product-item__badge">.*?<\/span>/g, '');
  }
  if (!product.priceOriginal) {
    html = html.replace(/<span class="hf-product-item__price-original">.*?<\/span>/g, '');
  }

  return html;
}
