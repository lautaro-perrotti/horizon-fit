const fs = require('fs');
const path = require('path');

const root = process.cwd();

const files = [
  'components/home/00-head.html',
  'components/home/01-header.html',
  'components/home/02-marquee.html',
  'components/home/03-hero.html',
  'components/home/04-featured-products.html',
  'components/home/05-product-grid-copy.html',
  'components/home/06-categorias.html',
  'components/home/07-trust.html',
  'components/home/08-estilo.html',
  'components/home/09-instagram.html',
  'components/home/10-footer.html',
  'components/home/99-scripts.html',
];

const html = files
  .map((file) => {
    const fullPath = path.join(root, file);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing component: ${file}`);
    }

    return fs.readFileSync(fullPath, 'utf8');
  })
  .join('\n');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

fs.writeFileSync(path.join(root, 'dist/index.html'), html, 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');

console.log('✅ Home built from components.');
