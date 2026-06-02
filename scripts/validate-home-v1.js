const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const explicitFiles = [
  'index.html',
  'design-system/page-builder.js',
  'design-system/pages/home.json',
];

const sectionsDir = path.join(ROOT, 'design-system', 'components', 'sections');

const forbidden = [
  'BLACK HIGH TOP',
  'BLUE HIGH TOP',
  'WHITE TRAINERS',
  'pexels.com',
  'Favoritos',
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
  'id="ecommerce"',
];

const encodingGuards = [
  'Ã',
  'â',
  '�',
];

function listSectionFiles() {
  if (!fs.existsSync(sectionsDir)) {
    return [];
  }

  return fs
    .readdirSync(sectionsDir)
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.join('design-system', 'components', 'sections', file));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const files = [...explicitFiles, ...listSectionFiles()];
const failures = [];

for (const file of files) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    failures.push(`${file}: missing`);
    continue;
  }

  const text = readText(file);

  for (const needle of forbidden) {
    if (text.includes(needle)) {
      failures.push(`${file}: forbidden "${needle}"`);
    }
  }

  for (const marker of encodingGuards) {
    if (text.includes(marker)) {
      failures.push(`${file}: broken UTF-8 marker "${marker}"`);
    }
  }
}

if (failures.length) {
  console.error('Home V1 validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Home V1 validation passed.');
console.log(`Checked ${files.length} files.`);
