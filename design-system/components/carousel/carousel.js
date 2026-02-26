/**
 * HF-CAROUSEL Component JS
 * Full-featured carousel with swipe, keyboard nav, autoplay
 */

(function() {
  'use strict';

  /**
   * Create and initialize a carousel
   * @param {HTMLElement} el - Carousel container element
   * @param {Object} options - Configuration options
   * @returns {Object} Carousel API
   */
  function createCarousel(el, options = {}) {
    if (!el) return null;

    // Parse options from data attributes
    const dataOptions = el.getAttribute('data-hf-carousel');
    const parsedData = dataOptions ? safeParseJSON(dataOptions) : {};

    const config = {
      loop: false,
      autoplay: false,
      autoplayDelay: 5000,
      pauseOnHover: true,
      pauseOnFocus: true,
      arrows: true,
      dots: true,
      draggable: true,
      speed: 300,
      threshold: 50,
      itemsToShow: 1,
      gap: 16,
      ...parsedData,
      ...options
    };

    // DOM elements
    const viewport = el.querySelector('.hf-carousel__viewport');
    const track = el.querySelector('.hf-carousel__track');
    const slides = Array.from(el.querySelectorAll('.hf-carousel__slide'));

    if (!viewport || !track || slides.length === 0) return null;

    // State
    let currentIndex = 0;
    let isAnimating = false;
    let animationTimer = null;
    let autoplayTimer = null;
    let isDragging = false;
    let isTouchDragging = false;
    let dragDirectionLocked = false;
    let isHorizontalDrag = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let currentTranslate = 0;

    // Reduced motion check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Calculate dimensions
    function getSlideWidth() {
      const viewportWidth = viewport.offsetWidth;
      const totalGap = config.gap * (config.itemsToShow - 1);
      return (viewportWidth - totalGap) / config.itemsToShow;
    }

    function getMaxIndex() {
      return Math.max(0, slides.length - config.itemsToShow);
    }

    // Update carousel position
    function updatePosition(animate = true) {
      const slideWidth = getSlideWidth();
      const offset = currentIndex * (slideWidth + config.gap);
      currentTranslate = -offset;

      if (prefersReducedMotion || !animate) {
        track.style.transition = 'none';
      } else {
        track.style.transition = `transform ${config.speed}ms var(--ease)`;
      }

      track.style.transform = `translateX(${currentTranslate}px)`;

      // Update slides ARIA
      slides.forEach((slide, idx) => {
        const isVisible = idx >= currentIndex && idx < currentIndex + config.itemsToShow;
        slide.setAttribute('aria-hidden', !isVisible);
        slide.inert = !isVisible;
      });

      // Update arrows state
      updateArrows();

      // Update dots
      updateDots();

      // Emit event
      el.dispatchEvent(new CustomEvent('hf:carousel:change', {
        detail: { index: currentIndex, slide: slides[currentIndex] },
        bubbles: true
      }));
    }

    // Navigation
    function goTo(index, animate = true) {
      const maxIndex = getMaxIndex();

      if (config.loop) {
        if (index < 0) index = maxIndex;
        if (index > maxIndex) index = 0;
      } else {
        index = Math.max(0, Math.min(index, maxIndex));
      }

      if (index === currentIndex) return;

      if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
      }

      isAnimating = true;
      currentIndex = index;
      updatePosition(animate);

      animationTimer = setTimeout(() => {
        isAnimating = false;
        animationTimer = null;
      }, config.speed);
    }

    function next() {
      goTo(currentIndex + 1);
    }

    function prev() {
      goTo(currentIndex - 1);
    }

    // Arrows
    let prevBtn = null;
    let nextBtn = null;

    function createArrows() {
      if (!config.arrows) return;

      prevBtn = document.createElement('button');
      prevBtn.className = 'hf-carousel__nav hf-carousel__nav--prev';
      prevBtn.setAttribute('aria-label', 'Anterior');
      prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
      prevBtn.addEventListener('click', prev);

      nextBtn = document.createElement('button');
      nextBtn.className = 'hf-carousel__nav hf-carousel__nav--next';
      nextBtn.setAttribute('aria-label', 'Siguiente');
      nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
      nextBtn.addEventListener('click', next);

      el.appendChild(prevBtn);
      el.appendChild(nextBtn);
    }

    function updateArrows() {
      if (!config.arrows || !prevBtn || !nextBtn) return;

      if (!config.loop) {
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex >= getMaxIndex();
      }
    }

    // Dots
    let dotsContainer = null;
    let dotButtons = [];

    function createDots() {
      if (!config.dots) return;

      dotsContainer = document.createElement('div');
      dotsContainer.className = 'hf-carousel__dots';
      dotsContainer.setAttribute('role', 'tablist');
      dotsContainer.setAttribute('aria-label', 'Slides');

      const totalDots = getMaxIndex() + 1;

      for (let i = 0; i < totalDots; i++) {
        const dot = document.createElement('button');
        dot.className = 'hf-carousel__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Ir a slide ${i + 1}`);
        dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');

        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
        dotButtons.push(dot);
      }

      el.appendChild(dotsContainer);
    }

    function updateDots() {
      if (!config.dots || !dotsContainer) return;

      dotButtons.forEach((dot, idx) => {
        const isActive = idx === currentIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', isActive);
      });
    }

    // Drag/Swipe support
    function handleDragStart(e) {
      if (!config.draggable) return;

      isDragging = true;
      isTouchDragging = e.type.startsWith('touch');
      dragDirectionLocked = false;
      isHorizontalDrag = !isTouchDragging;
      track.classList.add('is-dragging');
      startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
      startY = e.type.includes('mouse') ? 0 : e.touches[0].pageY;
      startScrollLeft = currentTranslate;

      // Pause autoplay while dragging
      stopAutoplay();
    }

    function handleDragMove(e) {
      if (!isDragging) return;

      const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
      const y = e.type.includes('mouse') ? 0 : e.touches[0].pageY;
      const delta = x - startX;
      const deltaY = y - startY;

      if (isTouchDragging && !dragDirectionLocked) {
        if (Math.abs(delta) < 8 && Math.abs(deltaY) < 8) return;
        dragDirectionLocked = true;
        isHorizontalDrag = Math.abs(delta) >= Math.abs(deltaY);
      }

      if (isTouchDragging && !isHorizontalDrag) {
        return;
      }

      e.preventDefault();

      track.style.transition = 'none';
      track.style.transform = `translateX(${startScrollLeft + delta}px)`;
    }

    function handleDragEnd(e) {
      if (!isDragging) return;

      isDragging = false;
      track.classList.remove('is-dragging');

      if (isTouchDragging && dragDirectionLocked && !isHorizontalDrag) {
        isTouchDragging = false;
        dragDirectionLocked = false;
        updatePosition(false);
        return;
      }

      const x = e.type.includes('mouse') ? e.pageX : e.changedTouches[0].pageX;
      const delta = x - startX;

      if (Math.abs(delta) > config.threshold) {
        if (delta > 0) {
          prev();
        } else {
          next();
        }
      } else {
        updatePosition(true);
      }

      // Resume autoplay
      if (config.autoplay) {
        startAutoplay();
      }

      isTouchDragging = false;
      dragDirectionLocked = false;
      isHorizontalDrag = false;
    }

    function setupDrag() {
      if (!config.draggable) return;

      // Mouse events
      track.addEventListener('mousedown', handleDragStart);
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);

      // Touch events (passive where possible)
      track.addEventListener('touchstart', handleDragStart, { passive: true });
      track.addEventListener('touchmove', handleDragMove, { passive: false });
      track.addEventListener('touchend', handleDragEnd, { passive: true });

      // Prevent image dragging
      track.querySelectorAll('img').forEach(img => {
        img.addEventListener('dragstart', e => e.preventDefault());
      });
    }

    // Keyboard navigation
    function handleKeydown(e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    }

    // Autoplay
    function startAutoplay() {
      if (!config.autoplay || prefersReducedMotion) return;

      stopAutoplay();
      autoplayTimer = setInterval(() => {
        next();
      }, config.autoplayDelay);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function setupAutoplay() {
      if (!config.autoplay) return;

      startAutoplay();

      if (config.pauseOnHover) {
        el.addEventListener('mouseenter', stopAutoplay);
        el.addEventListener('mouseleave', startAutoplay);
      }

      if (config.pauseOnFocus) {
        el.addEventListener('focusin', stopAutoplay);
        el.addEventListener('focusout', startAutoplay);
      }
    }

    // Resize handler
    const handleResize = debounce(() => {
      updatePosition(false);
    }, 150);

    // Initialize
    function init() {
      // Set ARIA attributes
      el.setAttribute('role', 'region');
      el.setAttribute('aria-roledescription', 'carousel');
      el.setAttribute('aria-label', el.getAttribute('aria-label') || 'Carousel');

      slides.forEach((slide, idx) => {
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${idx + 1} de ${slides.length}`);
      });

      // Set initial state
      track.style.gap = `${config.gap}px`;

      createArrows();
      createDots();
      setupDrag();
      setupAutoplay();

      el.addEventListener('keydown', handleKeydown);
      window.addEventListener('resize', handleResize);

      updatePosition(false);

      el._hfCarousel = api;
    }

    // Destroy
    function destroy() {
      stopAutoplay();
      if (animationTimer) clearTimeout(animationTimer);

      if (prevBtn) prevBtn.remove();
      if (nextBtn) nextBtn.remove();
      if (dotsContainer) dotsContainer.remove();

      el.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', handleResize);

      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);

      delete el._hfCarousel;
    }

    // API
    const api = {
      el,
      next,
      prev,
      goTo,
      destroy,
      getCurrentIndex: () => currentIndex,
      getSlides: () => slides,
      play: startAutoplay,
      pause: stopAutoplay
    };

    init();

    return api;
  }

  // Utility functions
  function safeParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Register with HF core
  if (typeof HF !== 'undefined' && HF.register) {
    HF.register('carousel', createCarousel);
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hf="carousel"]').forEach(el => {
      if (!el._hfCarousel) {
        createCarousel(el);
      }
    });
  });

  // Export
  window.HFCarousel = {
    create: createCarousel
  };
})();
