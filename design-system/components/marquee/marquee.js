/**
 * HF-MARQUEE Component JS
 * Continuous scrolling text with pause on hover/focus
 */

(function() {
  'use strict';

  /**
   * Initialize a marquee element
   * @param {HTMLElement} el - Marquee element
   * @param {Object} options - Configuration options
   * @returns {Object} Marquee API
   */
  function initMarquee(el, options = {}) {
    if (!el) return null;

    const config = {
      speed: parseInt(el.getAttribute('data-speed')) || options.speed || 30,
      gap: parseInt(el.getAttribute('data-gap')) || options.gap || 40,
      pauseOnHover: el.getAttribute('data-pause-hover') !== 'false',
      reverse: el.hasAttribute('data-reverse') || options.reverse || false,
      ...options
    };

    const track = el.querySelector('.hf-marquee__track');
    const content = el.querySelector('.hf-marquee__content');

    if (!track || !content) return null;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Set CSS variables
    el.style.setProperty('--marquee-speed', `${config.speed}s`);
    el.style.setProperty('--marquee-gap', `${config.gap}px`);

    let clones = [];

    function clearClones() {
      clones.forEach((node) => node.remove());
      clones = [];
    }

    function buildLoop() {
      clearClones();

      const contentWidth = Math.ceil(content.scrollWidth);
      const viewportWidth = Math.ceil(el.clientWidth);
      if (!contentWidth) return;

      el.style.setProperty('--marquee-shift', `-${contentWidth}px`);

      let totalWidth = contentWidth;
      while (totalWidth < contentWidth + viewportWidth) {
        const clone = content.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
        clones.push(clone);
        totalWidth += contentWidth;
      }
    }

    buildLoop();

    // Handle direction
    if (config.reverse) {
      el.classList.add('hf-marquee--reverse');
    }

    // Pause/play controls
    let isPaused = prefersReducedMotion;

    function pause() {
      isPaused = true;
      track.style.animationPlayState = 'paused';
    }

    function play() {
      if (prefersReducedMotion) return;
      isPaused = false;
      track.style.animationPlayState = 'running';
    }

    function destroy() {
      clearClones();
    }

    // Listen for reduced motion changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionHandler = (e) => {
      if (e.matches) {
        pause();
      } else {
        play();
      }
    };
    motionQuery.addEventListener('change', motionHandler);

    const resizeHandler = () => {
      buildLoop();
    };
    window.addEventListener('resize', resizeHandler);

    return {
      el,
      pause,
      play,
      destroy: () => {
        destroy();
        window.removeEventListener('resize', resizeHandler);
        motionQuery.removeEventListener('change', motionHandler);
      },
      isPaused: () => isPaused
    };
  }

  /**
   * Create a marquee programmatically
   * @param {Object} options - Marquee options
   * @returns {HTMLElement} Marquee element
   */
  function createMarquee(options = {}) {
    const {
      items = [],
      variant = '',
      speed = 30,
      separator = true,
      reverse = false
    } = options;

    const marquee = document.createElement('div');
    marquee.className = 'hf-marquee';
    if (variant) marquee.classList.add(`hf-marquee--${variant}`);
    if (reverse) marquee.setAttribute('data-reverse', '');
    marquee.setAttribute('data-speed', speed);
    marquee.setAttribute('role', 'marquee');
    marquee.setAttribute('aria-live', 'off');

    const track = document.createElement('div');
    track.className = 'hf-marquee__track';

    const content = document.createElement('div');
    content.className = 'hf-marquee__content';

    items.forEach((item, idx) => {
      const itemEl = document.createElement('span');
      itemEl.className = 'hf-marquee__item';

      if (typeof item === 'string') {
        itemEl.textContent = item;
      } else if (item.icon) {
        const iconEl = document.createElement('span');
        iconEl.className = 'hf-marquee__icon';
        iconEl.innerHTML = item.icon;
        itemEl.appendChild(iconEl);

        const textEl = document.createElement('span');
        textEl.textContent = item.text;
        itemEl.appendChild(textEl);
      } else {
        itemEl.textContent = item.text || '';
      }

      content.appendChild(itemEl);

      // Add separator (except last)
      if (separator && idx < items.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'hf-marquee__separator';
        sep.setAttribute('aria-hidden', 'true');
        content.appendChild(sep);
      }
    });

    track.appendChild(content);
    marquee.appendChild(track);

    return marquee;
  }

  // Register with HF core if available
  if (typeof HF !== 'undefined' && HF.register) {
    HF.register('marquee', initMarquee);
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hf="marquee"]').forEach(el => {
      if (!el._hfMarquee) {
        el._hfMarquee = initMarquee(el);
      }
    });
  });

  // Export
  window.HFMarquee = {
    init: initMarquee,
    create: createMarquee
  };
})();
