const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = process.cwd();
const localPath = path.join(ROOT, 'design-system', 'data', 'featured-products.json');
const sourcePath = path.join(
  ROOT,
  'backend',
  'wordpress',
  'wp-content',
  'uploads',
  'horizon-fit-cache',
  'featured-products.json'
);

const forbiddenProductText = [
  'BLACK HIGH TOP',
  'BLUE HIGH TOP',
  'WHITE TRAINERS',
  'pexels.com',
  'Favoritos',
];

const requiredExportFields = [
  'badge',
  'sizes',
  'priceOriginal',
  'regularPrice',
  'salePrice',
  'regularPriceText',
  'salePriceText',
  'categories',
  'tags',
  'collections',
  'attributes',
  'variations',
  'stockStatus',
  'stockQuantity',
  'isFeatured',
  'isOnSale',
  'imageObjects',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function uploadFileFromUrl(url) {
  const pathname = new URL(url).pathname;
  const uploadMarker = '/wp-content/uploads/';
  const pluginMarker = '/wp-content/plugins/';

  if (pathname.startsWith(uploadMarker)) {
    return path.join(
      ROOT,
      'backend',
      'wordpress',
      'wp-content',
      'uploads',
      ...pathname.slice(uploadMarker.length).split('/')
    );
  }

  if (pathname.startsWith(pluginMarker)) {
    return path.join(
      ROOT,
      'backend',
      'wordpress',
      'wp-content',
      'plugins',
      ...pathname.slice(pluginMarker.length).split('/')
    );
  }

  return null;
}

const failures = [];
const warnings = [];
const rows = [];

for (const filePath of [localPath, sourcePath]) {
  if (!fs.existsSync(filePath)) {
    failures.push(`Missing file: ${path.relative(ROOT, filePath)}`);
  }
}

if (failures.length) {
  console.error('Featured products audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const localHash = sha256(localPath);
const sourceHash = sha256(sourcePath);
const products = readJson(localPath);

if (localHash !== sourceHash) {
  failures.push('design-system/data/featured-products.json does not match WordPress cache JSON');
}

if (!Array.isArray(products)) {
  failures.push('featured-products.json must be an array');
} else {
  products.forEach((product, index) => {
    const label = product && product.id ? `product ${product.id}` : `product at index ${index}`;
    const searchable = JSON.stringify(product || {});

    for (const needle of forbiddenProductText) {
      if (searchable.includes(needle)) {
        failures.push(`${label}: forbidden demo text "${needle}"`);
      }
    }

    for (const field of ['id', 'name', 'permalink', 'status', 'priceText']) {
      if (!product || !product[field]) {
        failures.push(`${label}: missing "${field}"`);
      }
    }

    if (!Array.isArray(product && product.images) || product.images.length === 0) {
      warnings.push(`${label}: missing product images`);
    } else {
      const seenImages = new Set();

      product.images.forEach((image) => {
        const uploadFile = uploadFileFromUrl(image);

        if (seenImages.has(image)) {
          warnings.push(`${label}: duplicate image "${image}"`);
        }

        seenImages.add(image);

        if (!uploadFile || !fs.existsSync(uploadFile)) {
          failures.push(`${label}: image file not found "${image}"`);
        }

        if (image.includes('/woocommerce/assets/images/placeholder')) {
          warnings.push(`${label}: using WooCommerce placeholder image`);
        }
      });
    }

    if (typeof (product && product.name) === 'string' && product.name.includes('??')) {
      warnings.push(`${label}: suspicious name "${product.name}"`);
    }

    if (typeof (product && product.permalink) === 'string' && product.permalink.includes('?p=')) {
      warnings.push(`${label}: query-style permalink "${product.permalink}"`);
    }

    const missingExportFields = requiredExportFields.filter((field) => product && product[field] === undefined);

    if (missingExportFields.length) {
      failures.push(`${label}: missing exported fields "${missingExportFields.join(', ')}"`);
    }

    if (!Array.isArray(product && product.sizes)) {
      failures.push(`${label}: "sizes" must be an array`);
    }

    if (!Array.isArray(product && product.attributes)) {
      failures.push(`${label}: "attributes" must be an array`);
    }

    if (!Array.isArray(product && product.variations)) {
      failures.push(`${label}: "variations" must be an array`);
    }

    if (!Array.isArray(product && product.imageObjects) || product.imageObjects.length === 0) {
      warnings.push(`${label}: missing imageObjects`);
    }

    if (!product || !Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
      warnings.push(`${label}: missing or zero product price`);
    }

    rows.push({
      id: product && product.id,
      name: product && product.name,
      images: Array.isArray(product && product.images) ? product.images.length : 0,
      priceText: product && product.priceText,
      sizes: Array.isArray(product && product.sizes) ? product.sizes.join(', ') : '',
      variations: Array.isArray(product && product.variations) ? product.variations.length : 0,
    });
  });
}

if (failures.length) {
  console.error('Featured products audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Featured products audit passed.');
console.log(`Source match: ${localHash === sourceHash ? 'yes' : 'no'}`);
console.log(`Products: ${Array.isArray(products) ? products.length : 0}`);
console.log('Product rows:');
rows.forEach((row) => {
  console.log(`- ${row.id}: ${row.name} | price: ${row.priceText || 'missing'} | sizes: ${row.sizes || 'none'} | variations: ${row.variations} | images: ${row.images}`);
});

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
