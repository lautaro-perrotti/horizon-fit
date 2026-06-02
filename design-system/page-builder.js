(function() {
  'use strict';

  const root = document.querySelector('[data-page-src]');

  function setText(rootElement, selector, value) {
    const element = rootElement.querySelector(selector);
    if (element) {
      element.textContent = value || '';
    }
  }

  async function getJSON(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(url + ' failed: ' + response.status);
    }
    return response.json();
  }

  async function getHTML(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(url + ' failed: ' + response.status);
    }
    return response.text();
  }

  function htmlToFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.cloneNode(true);
  }

  function setProductImages(card, product) {
    const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    const slides = Array.from(card.querySelectorAll('.hf-product-item__slide'));
    const dots = Array.from(card.querySelectorAll('.hf-product-item__dot'));

    slides.forEach((slide, index) => {
      const image = images[index];
      const img = slide.querySelector('img');

      if (!image || !img) {
        slide.remove();
        return;
      }

      img.src = image;
      img.alt = product.name || '';
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
    });

    dots.forEach((dot, index) => {
      if (!images[index]) {
        dot.remove();
        return;
      }

      dot.dataset.slide = String(index);
      dot.classList.toggle('is-active', index === 0);
    });
  }

  function setProductSizes(card, product) {
    const sizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
    const sizeWrap = card.querySelector('.hf-product-item__sizes');

    if (!sizeWrap) {
      return;
    }

    if (!sizes.length) {
      sizeWrap.remove();
      return;
    }

    sizeWrap.innerHTML = '';

    sizes.forEach(size => {
      const button = document.createElement('button');
      button.className = 'hf-product-item__size';
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.textContent = size;
      sizeWrap.appendChild(button);
    });
  }

  function renderProduct(productTemplate, product) {
    const card = productTemplate.cloneNode(true);

    card.dataset.productId = product.id || '';

    setProductImages(card, product);
    setProductSizes(card, product);
    setText(card, '.hf-product-item__badge', product.badge || '');
    setText(card, '.hf-product-item__title', product.name || '');
    setText(card, '.hf-product-item__price', product.priceText || '');
    setText(card, '.hf-product-item__price-original', product.priceOriginal || '');
    setText(card, '.hf-product-item__installments', product.installmentsText || '');
    setText(card, '.hf-product-item__transfer', product.transferText || '');

    card.querySelectorAll('a').forEach(link => {
      link.href = product.permalink || '#';
    });

    if (!product.badge) {
      const badge = card.querySelector('.hf-product-item__badge');
      if (badge) {
        badge.remove();
      }
    }

    if (!product.priceOriginal) {
      const original = card.querySelector('.hf-product-item__price-original');
      if (original) {
        original.remove();
      }
    }

    return card;
  }

  function initProductScrollShell(shell) {
    if (!shell) {
      return;
    }

    const grid = shell.querySelector('.hf-product-grid--h-scroll');
    const buttons = Array.from(shell.querySelectorAll('.hf-carousel__nav'));

    if (!grid || !buttons.length) {
      return;
    }

    function getStep() {
      const firstCard = grid.querySelector('.hf-product-item');
      if (!firstCard) {
        return grid.clientWidth;
      }

      const styles = window.getComputedStyle(grid);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return firstCard.getBoundingClientRect().width + gap;
    }

    function updateButtons() {
      const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth - 2);
      buttons.forEach(button => {
        const dir = Number(button.dataset.dir || 0);
        button.disabled = dir < 0 ? grid.scrollLeft <= 2 : grid.scrollLeft >= maxScroll;
      });
    }

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        grid.scrollBy({
          left: getStep() * Number(button.dataset.dir || 0),
          behavior: 'smooth',
        });
      });
    });

    grid.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();
  }

  async function hydrateProducts(sectionElement, sectionConfig) {
    const source = sectionConfig.productsSource;
    const grid = sectionElement.querySelector('[data-products-grid]');
    const template = sectionElement.querySelector('[data-product-template]');
    const productTemplate = template ? template.content.querySelector('.hf-product-item') : null;

    if (!source || !grid || !productTemplate) {
      return;
    }

    const products = await getJSON(source);
    if (!Array.isArray(products) || !products.length) {
      return;
    }

    const fragment = document.createDocumentFragment();
    products.forEach(product => {
      fragment.appendChild(renderProduct(productTemplate, product));
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
    initProductScrollShell(sectionElement.querySelector('[data-grid-shell]'));
  }

  async function renderSection(sectionConfig) {
    if (!sectionConfig || sectionConfig.visible === false || !sectionConfig.template) {
      return null;
    }

    const fragment = htmlToFragment(await getHTML(sectionConfig.template));
    const sectionElement = fragment.firstElementChild;

    if (!sectionElement) {
      return null;
    }

    setText(sectionElement, '[data-section-title]', sectionConfig.title || '');
    await hydrateProducts(sectionElement, sectionConfig);

    return sectionElement;
  }

  async function renderPage() {
    if (!root) {
      return;
    }

    const page = await getJSON(root.dataset.pageSrc);
    const sections = Array.isArray(page.sections) ? page.sections : [];
    const orderedSections = sections
      .filter(section => section && section.visible !== false)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    const fragment = document.createDocumentFragment();

    for (const section of orderedSections) {
      const element = await renderSection(section);
      if (element) {
        fragment.appendChild(element);
      }
    }

    root.innerHTML = '';
    root.appendChild(fragment);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPage);
  } else {
    renderPage();
  }
})();
