const fs = require('fs');
const path = require('path');

const root = process.cwd();

const indexPath = path.join(root, 'index.html');
const outputComponentPath = path.join(root, 'components/home/FeaturedProducts.html');
const productsPath = path.join(
  root,
  'backend/wordpress/wp-content/uploads/horizon-fit-cache/featured-products.json'
);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function normalizeImages(product) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];

  const image0 = images[0] || product.image || product.hoverImage || '';
  const image1 = images[1] || product.hoverImage || image0;

  if (!image0) {
    throw new Error(`Product has no image: ${product.name}`);
  }

  return { image0, image1 };
}

function renderCard(product) {
  const { image0, image1 } = normalizeImages(product);
  const permalink = product.permalink || '#';

  return `
          <article class="hf-product-item hf-product-item--slider" data-product-id="${escapeHtml(product.id)}">
            <a href="${escapeHtml(permalink)}" aria-label="Ver fotos de ${escapeHtml(product.name)}" class="hf-product-item__link">
              <div class="hf-product-item__media">
                <span class="hf-product-item__badge">50% OFF!</span>
                <div class="hf-product-item__slider" data-slider>
                  <div class="hf-product-item__slide"><img src="${escapeHtml(image0)}" alt="${escapeHtml(product.name)}"></div>
                  <div class="hf-product-item__slide"><img src="${escapeHtml(image1)}" alt="${escapeHtml(product.name)}"></div>
                </div>
                <div class="hf-product-item__dots">
                  <button class="hf-product-item__dot is-active" data-slide="0"></button>
                  <button class="hf-product-item__dot" data-slide="1"></button>
                </div>
              </div>
            </a>

            <div class="hf-product-item__body">
              <div class="hf-product-item__sizes">
                <button class="hf-product-item__size" aria-pressed="false">S</button>
                <button class="hf-product-item__size" aria-pressed="false">M</button>
                <button class="hf-product-item__size" aria-pressed="false">L</button>
              </div>

              <a href="${escapeHtml(permalink)}" aria-label="Ver detalle de ${escapeHtml(product.name)}" class="hf-product-item__link">
                <h3 class="hf-product-item__title">${escapeHtml(product.name)}</h3>
              </a>

              <div class="hf-product-item__pricing">
                <div class="hf-product-item__price-row">
                  <span class="hf-product-item__price">${escapeHtml(product.priceText)}</span>
                </div>
                <p class="hf-product-item__installments">${escapeHtml(product.installmentsText)}</p>
                <p class="hf-product-item__transfer">${escapeHtml(product.transferText)}</p>
              </div>
            </div>
          </article>`;
}

function renderFeaturedProductsSection(products) {
  const cards = products.slice(0, 8).map(renderCard).join('\n');

  return `
  <section class="section section--featured-products" style="background: var(--surface); padding-bottom: 0;">
    <div class="container section__head">
      <p class="section__eyebrow">Favoritos</p>
      <h2>Productos destacados</h2>
    </div>

    <div class="hf-product-scroll-shell" data-grid-shell="productGrid1">
      <div style="padding: 0 var(--s-4);">
        <div id="productGrid1" class="hf-product-grid--h-scroll hide-scrollbar">
${cards}
        </div>
      </div>

      <button class="hf-carousel__nav hf-carousel__nav--prev" type="button" data-dir="-1" aria-label="Anterior" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button class="hf-carousel__nav hf-carousel__nav--next" type="button" data-dir="1" aria-label="Siguiente">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </section>`;
}

function replaceFeaturedSection(html, replacement) {
  const start = html.indexOf('<section class="section section--featured-products"');

  if (start === -1) {
    throw new Error('Could not find .section--featured-products');
  }

  let depth = 0;
  let i = start;

  while (i < html.length) {
    const nextOpen = html.indexOf('<section', i);
    const nextClose = html.indexOf('</section>', i);

    if (nextClose === -1) {
      throw new Error('Could not find closing </section> for featured products');
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + '<section'.length;
      continue;
    }

    depth -= 1;
    i = nextClose + '</section>'.length;

    if (depth === 0) {
      return html.slice(0, start) + replacement + html.slice(i);
    }
  }

  throw new Error('Failed to replace featured products section');
}

function removeProductGridCopy(html) {
  const start = html.indexOf('<section class="section section--product-grid-copy"');

  if (start === -1) {
    return html;
  }

  let depth = 0;
  let i = start;

  while (i < html.length) {
    const nextOpen = html.indexOf('<section', i);
    const nextClose = html.indexOf('</section>', i);

    if (nextClose === -1) {
      throw new Error('Could not find closing </section> for product-grid-copy');
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + '<section'.length;
      continue;
    }

    depth -= 1;
    i = nextClose + '</section>'.length;

    if (depth === 0) {
      return html.slice(0, start) + html.slice(i);
    }
  }

  return html;
}

function removeBadRuntimeScripts(html) {
  return html
    .replace(/\s*<script\s+src="design-system\/api-loader\.js"><\/script>/g, '')
    .replace(/\s*<script\s+src="design-system\/loaders\/home-data-loader\.js"><\/script>/g, '');
}

function main() {
  if (!fs.existsSync(indexPath)) {
    throw new Error('Missing index.html');
  }

  if (!fs.existsSync(productsPath)) {
    throw new Error(`Missing products JSON: ${productsPath}`);
  }

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

  if (!Array.isArray(products) || products.length < 8) {
    throw new Error(`Expected at least 8 products, got ${Array.isArray(products) ? products.length : 'invalid JSON'}`);
  }

  const component = renderFeaturedProductsSection(products);

  fs.mkdirSync(path.dirname(outputComponentPath), { recursive: true });
  fs.writeFileSync(outputComponentPath, component, 'utf8');

  let html = fs.readFileSync(indexPath, 'utf8');

  html = replaceFeaturedSection(html, component);
  html = removeProductGridCopy(html);
  html = removeBadRuntimeScripts(html);

  fs.writeFileSync(indexPath, html, 'utf8');

  console.log('OK: FeaturedProducts component generated and injected.');
  console.log(`Products rendered: ${products.slice(0, 8).map((p) => p.name).join(', ')}`);
}

main();
