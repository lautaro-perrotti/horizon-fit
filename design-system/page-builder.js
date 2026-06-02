(function() {
  'use strict';

  const PRODUCTS_JSON_URL = 'http://localhost:8089/wp-content/uploads/horizon-fit-cache/featured-products.json';

  function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) {
      element.textContent = value || '';
    }
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

  function renderProduct(template, product) {
    const card = template.cloneNode(true);

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

  async function renderFeaturedProducts() {
    const grid = document.querySelector('#productGrid1');
    if (!grid) {
      return;
    }

    const template = document.querySelector('#hfProductItemTemplate');
    if (!template) {
      return;
    }

    const response = await fetch(PRODUCTS_JSON_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Featured products JSON failed: ' + response.status);
    }

    const products = await response.json();
    if (!Array.isArray(products)) {
      throw new Error('Featured products JSON is not an array');
    }

    if (!products.length) {
      return;
    }

    const fragment = document.createDocumentFragment();

    products.forEach(product => {
      const cardTemplate = template.content.querySelector('.hf-product-item');
      if (cardTemplate) {
        fragment.appendChild(renderProduct(cardTemplate, product));
      }
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFeaturedProducts);
  } else {
    renderFeaturedProducts();
  }
})();
