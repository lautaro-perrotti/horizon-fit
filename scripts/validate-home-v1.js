const fs = require('fs');
const path = require('path');

const FORBIDDEN = [
  'BLACK HIGH TOP',
  'BLUE HIGH TOP',
  'WHITE TRAINERS',
  'Favoritos',
  'pexels.com',
  'home-data-loader',
  'api-loader',
  'page-renderer',
  'wp-json',
  'hf-template-article',
  'productGrid2',
  'section--product-grid-copy',
  'PRODUCTOS COMENTADOS',
  'FIN FEATURED-PRODUCTS HARDCODEADO',
  'id="tokens"',
  'id="components"',
  'id="marketing"',
  'id="ecommerce"'
];

const filesToCheck = [
  'index.html',
  'design-system/page-builder.js',
  'design-system/pages/home.json',
  'design-system/components/sections/featured-products.html',
  'design-system/components/sections/hero.html'
];

let errors = 0;

console.log('🔍 Validating Home V1...\n');

for (const file of filesToCheck) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${file} — NOT FOUND`);
    errors++;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const forbiddenFound = FORBIDDEN.filter(f => content.includes(f));

  if (forbiddenFound.length > 0) {
    console.log(`❌ ${file} — FORBIDDEN TEXT FOUND:`);
    forbiddenFound.forEach(f => console.log(`   - "${f}"`));
    errors++;
  } else {
    console.log(`✅ ${file}`);
  }
}

if (errors === 0) {
  console.log('\n✅ All validations passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${errors} file(s) failed validation`);
  process.exit(1);
}
