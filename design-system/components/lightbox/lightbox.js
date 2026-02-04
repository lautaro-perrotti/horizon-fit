/**
 * HF-LIGHTBOX Component JS
 * Product gallery with modal zoom and keyboard navigation
 */

(function() {
  'use strict';

  let activeLightbox = null;

  /**
   * Initialize a gallery with lightbox
   * @param {HTMLElement} el - Gallery container element
   * @param {Object} options - Configuration options
   * @returns {Object} Gallery API
   */
  function initLightbox(el, options = {}) {
    if (!el) return null;

    const config = {
      loop: false,
      showThumbs: true,
      showCounter: true,
      zoomable: true,
      ...options
    };

    // Get elements
    const mainContainer = el.querySelector('.hf-gallery__main');
    const mainImage = el.querySelector('.hf-gallery__main-image');
    const thumbs = Array.from(el.querySelectorAll('.hf-gallery__thumb'));

    // Get all images
    const images = [];
    if (mainImage) {
      const dataSrc = mainImage.getAttribute('data-lightbox-src') || mainImage.src;
      images.push({
        src: dataSrc,
        thumb: mainImage.src,
        alt: mainImage.alt || ''
      });
    }

    thumbs.forEach(thumb => {
      const img = thumb.querySelector('img') || thumb;
      const src = thumb.getAttribute('data-lightbox-src') || img.src;
      const thumbSrc = img.src || src;
      images.push({
        src: src,
        thumb: thumbSrc,
        alt: img.alt || ''
      });
    });

    // State
    let currentIndex = 0;
    let lightboxEl = null;
    let isOpen = false;
    let cleanupTrap = null;

    // Create lightbox modal
    function createLightbox() {
      if (lightboxEl) return;

      lightboxEl = document.createElement('div');
      lightboxEl.className = 'hf-lightbox';
      lightboxEl.setAttribute('role', 'dialog');
      lightboxEl.setAttribute('aria-modal', 'true');
      lightboxEl.setAttribute('aria-label', 'Galería de imágenes');

      lightboxEl.innerHTML = `
        <button class="hf-lightbox__close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <button class="hf-lightbox__nav hf-lightbox__nav--prev" aria-label="Anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div class="hf-lightbox__content">
          <img class="hf-lightbox__image" src="" alt="" />
        </div>

        <button class="hf-lightbox__nav hf-lightbox__nav--next" aria-label="Siguiente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        ${config.showCounter ? '<div class="hf-lightbox__counter"></div>' : ''}

        ${config.showThumbs && images.length > 1 ? `
          <div class="hf-lightbox__thumbs">
            ${images.map((img, idx) => `
              <button class="hf-lightbox__thumb" data-index="${idx}" aria-label="Ver imagen ${idx + 1}">
                <img src="${img.thumb}" alt="" />
              </button>
            `).join('')}
          </div>
        ` : ''}
      `;

      document.body.appendChild(lightboxEl);

      // Bind events
      lightboxEl.querySelector('.hf-lightbox__close').addEventListener('click', close);
      lightboxEl.querySelector('.hf-lightbox__nav--prev').addEventListener('click', prev);
      lightboxEl.querySelector('.hf-lightbox__nav--next').addEventListener('click', next);

      // Thumbnail clicks
      lightboxEl.querySelectorAll('.hf-lightbox__thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          goTo(parseInt(thumb.getAttribute('data-index')));
        });
      });

      // Click outside to close
      lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl || e.target.classList.contains('hf-lightbox__content')) {
          close();
        }
      });

      // Image click for zoom
      if (config.zoomable) {
        const img = lightboxEl.querySelector('.hf-lightbox__image');
        img.addEventListener('click', () => {
          lightboxEl.classList.toggle('hf-lightbox--zoom');
        });
      }
    }

    // Update lightbox content
    function updateLightbox() {
      if (!lightboxEl) return;

      const img = lightboxEl.querySelector('.hf-lightbox__image');
      const counter = lightboxEl.querySelector('.hf-lightbox__counter');
      const prevBtn = lightboxEl.querySelector('.hf-lightbox__nav--prev');
      const nextBtn = lightboxEl.querySelector('.hf-lightbox__nav--next');
      const thumbBtns = lightboxEl.querySelectorAll('.hf-lightbox__thumb');

      // Update image
      img.src = images[currentIndex].src;
      img.alt = images[currentIndex].alt;

      // Update counter
      if (counter) {
        counter.textContent = `${currentIndex + 1} / ${images.length}`;
      }

      // Update nav buttons
      if (!config.loop) {
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === images.length - 1;
      }

      // Update thumbs
      thumbBtns.forEach((thumb, idx) => {
        thumb.classList.toggle('is-active', idx === currentIndex);
      });

      // Reset zoom
      lightboxEl.classList.remove('hf-lightbox--zoom');
    }

    // Navigation
    function goTo(index) {
      if (config.loop) {
        if (index < 0) index = images.length - 1;
        if (index >= images.length) index = 0;
      } else {
        index = Math.max(0, Math.min(index, images.length - 1));
      }

      currentIndex = index;
      updateLightbox();

      // Also update gallery thumbs
      thumbs.forEach((thumb, idx) => {
        thumb.classList.toggle('is-active', idx === currentIndex);
        thumb.setAttribute('aria-selected', idx === currentIndex);
      });
    }

    function next() {
      goTo(currentIndex + 1);
    }

    function prev() {
      goTo(currentIndex - 1);
    }

    // Open/Close
    function open(index = 0) {
      if (isOpen) return;

      createLightbox();

      currentIndex = index;
      updateLightbox();

      // Lock scroll
      document.body.style.overflow = 'hidden';

      // Show lightbox
      lightboxEl.classList.add('is-open');
      isOpen = true;
      activeLightbox = api;

      // Focus trap
      cleanupTrap = trapFocus(lightboxEl);

      // Focus close button
      setTimeout(() => {
        lightboxEl.querySelector('.hf-lightbox__close').focus();
      }, 100);

      // Emit event
      el.dispatchEvent(new CustomEvent('hf:lightbox:open', {
        detail: { index: currentIndex },
        bubbles: true
      }));
    }

    function close() {
      if (!isOpen || !lightboxEl) return;

      lightboxEl.classList.remove('is-open');
      document.body.style.overflow = '';
      isOpen = false;
      activeLightbox = null;

      if (cleanupTrap) {
        cleanupTrap();
        cleanupTrap = null;
      }

      // Return focus
      if (mainContainer) {
        mainContainer.focus();
      }

      // Emit event
      el.dispatchEvent(new CustomEvent('hf:lightbox:close', { bubbles: true }));
    }

    // Keyboard navigation
    function handleKeydown(e) {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          close();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
      }
    }

    // Focus trap helper
    function trapFocus(container) {
      const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      function handler(e) {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      container.addEventListener('keydown', handler);
      return () => container.removeEventListener('keydown', handler);
    }

    // Initialize gallery
    function initGallery() {
      // Main image click opens lightbox
      if (mainContainer) {
        mainContainer.addEventListener('click', () => open(0));
        mainContainer.setAttribute('tabindex', '0');
        mainContainer.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open(0);
          }
        });
      }

      // Thumbnail clicks
      thumbs.forEach((thumb, idx) => {
        thumb.addEventListener('click', () => {
          // Update main image
          if (mainImage && images[idx + 1]) {
            mainImage.src = images[idx + 1].thumb;
          }

          // Update active state
          thumbs.forEach((t, i) => {
            t.classList.toggle('is-active', i === idx);
            t.setAttribute('aria-selected', i === idx);
          });

          currentIndex = idx + 1;
        });
      });

      // Global keyboard handler
      document.addEventListener('keydown', handleKeydown);
    }

    // Destroy
    function destroy() {
      close();
      if (lightboxEl) {
        lightboxEl.remove();
        lightboxEl = null;
      }
      document.removeEventListener('keydown', handleKeydown);
    }

    // API
    const api = {
      el,
      open,
      close,
      next,
      prev,
      goTo,
      destroy,
      isOpen: () => isOpen,
      getCurrentIndex: () => currentIndex
    };

    initGallery();

    el._hfLightbox = api;

    return api;
  }

  // Global keyboard handler for active lightbox
  document.addEventListener('keydown', (e) => {
    if (activeLightbox && e.key === 'Escape') {
      activeLightbox.close();
    }
  });

  // Register with HF core
  if (typeof HF !== 'undefined' && HF.register) {
    HF.register('lightbox', initLightbox);
    HF.register('gallery', initLightbox);
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hf="lightbox"], [data-hf="gallery"]').forEach(el => {
      if (!el._hfLightbox) {
        initLightbox(el);
      }
    });
  });

  // Export
  window.HFLightbox = {
    init: initLightbox
  };
})();
