function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function normalizeStatus(value, fallback = 'publish') {
  const status = String(value ?? fallback).trim().toLowerCase();
  return status || fallback;
}

function normalizeStockStatus(value) {
  const status = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!status) return '';
  if (['outofstock', 'soldout', 'agotado'].includes(status)) return 'outofstock';
  if (['instock', 'available', 'disponible'].includes(status)) return 'instock';
  if (['onbackorder', 'backorder'].includes(status)) return 'onbackorder';
  return status;
}

function hasPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function decodeEntities(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value ?? '');
  return textarea.value;
}

function toPlainText(value) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = decodeEntities(value);
  return wrapper.textContent || wrapper.innerText || '';
}

function getAvailability(product) {
  const status = normalizeStatus(product?.status || product?.post_status || product?.postStatus, 'publish');
  const stockStatus = normalizeStockStatus(product?.stockStatus || product?.stock_status || product?.stockAvailability?.class || product?.stock_availability?.class || product?.stock_availability?.text);
  const priceValue = hasPositiveNumber(product?.price)
    ? Number(product.price)
    : hasPositiveNumber(product?.prices?.price)
      ? Number(product.prices.price)
      : null;
  const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
  return {
    status,
    stockStatus,
    hasPrice,
    canPurchase: status === 'publish' && hasPrice && stockStatus !== 'outofstock',
    badge: status !== 'publish'
      ? ''
      : stockStatus === 'outofstock'
        ? 'Agotado'
        : !hasPrice
          ? 'Sin precio'
          : String(product?.badge || '').trim(),
    priceText: hasPrice ? toPlainText(product?.priceText || product?.price_html || '') : '',
    priceOriginal: hasPrice ? toPlainText(product?.priceOriginal || product?.regularPriceText || '') : ''
  };
}

export async function renderProductCard(product) {
  const templateText = await fetch(
    'design-system/components/product-card/product-card.template.html'
  ).then(r => r.text());

  if (normalizeStatus(product?.status || product?.post_status || product?.postStatus, 'publish') !== 'publish') {
    return '';
  }
  if (!product.images || product.images.length === 0) {
    console.warn('Product has no images:', product.name);
    return '';
  }

  const availability = getAvailability(product);

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
    .replaceAll('{{priceText}}', escapeHtml(availability.priceText))
    .replaceAll('{{priceOriginal}}', escapeHtml(availability.priceOriginal || ''))
    .replaceAll('{{installmentsText}}', escapeHtml(product.installmentsText))
    .replaceAll('{{transferText}}', escapeHtml(product.transferText))
    .replaceAll('{{permalink}}', escapeHtml(product.permalink))
    .replaceAll('{{badge}}', escapeHtml(availability.badge || ''));

  // Remove conditional blocks for missing data
  if (!availability.badge) {
    html = html.replace(/<span class="hf-product-item__badge">.*?<\/span>/g, '');
  }
  if (!availability.priceText) {
    html = html.replace(/<div class="hf-product-item__price-row">[\s\S]*?<\/div>/g, '');
  }
  if (!availability.priceOriginal) {
    html = html.replace(/<span class="hf-product-item__price-original">.*?<\/span>/g, '');
  }

  return html;
}
