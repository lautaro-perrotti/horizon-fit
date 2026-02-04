/**
 * HF-VIDEO-HERO Component JS
 * Video background hero with play/pause controls
 */

(function() {
  'use strict';

  /**
   * Initialize a video hero element
   * @param {HTMLElement} el - Video hero element
   * @param {Object} options - Configuration options
   * @returns {Object} Video hero API
   */
  function initVideoHero(el, options = {}) {
    if (!el) return null;

    const config = {
      autoplay: el.getAttribute('data-autoplay') !== 'false',
      muted: el.getAttribute('data-muted') !== 'false',
      loop: el.getAttribute('data-loop') !== 'false',
      showControl: el.hasAttribute('data-show-control') || options.showControl || false,
      ...options
    };

    const video = el.querySelector('.hf-video-hero__video');
    const fallback = el.querySelector('.hf-video-hero__fallback');
    let controlBtn = el.querySelector('.hf-video-hero__control');

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!video) return null;

    // State
    let isPlaying = false;

    // Setup video attributes
    function setupVideo() {
      video.muted = config.muted;
      video.loop = config.loop;
      video.playsInline = true;
      video.setAttribute('playsinline', '');

      // Hide video if reduced motion
      if (prefersReducedMotion) {
        video.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
      }

      // Show fallback until video loads
      video.addEventListener('loadeddata', () => {
        video.classList.add('is-loaded');
        if (fallback) fallback.style.opacity = '0';
      });

      video.addEventListener('play', () => {
        isPlaying = true;
        updateControlState();
      });

      video.addEventListener('pause', () => {
        isPlaying = false;
        updateControlState();
      });

      // Autoplay
      if (config.autoplay && !prefersReducedMotion) {
        video.play().catch(() => {
          // Autoplay blocked - show fallback
          if (fallback) fallback.style.opacity = '1';
        });
      }
    }

    // Create play/pause control button
    function createControl() {
      if (controlBtn || !config.showControl) return;

      controlBtn = document.createElement('button');
      controlBtn.className = 'hf-video-hero__control hf-video-hero__control--pause';
      controlBtn.setAttribute('aria-label', 'Pausar video');
      controlBtn.innerHTML = `
        <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
      `;

      controlBtn.addEventListener('click', toggle);
      el.appendChild(controlBtn);
    }

    function updateControlState() {
      if (!controlBtn) return;

      if (isPlaying) {
        controlBtn.classList.remove('hf-video-hero__control--play');
        controlBtn.classList.add('hf-video-hero__control--pause');
        controlBtn.setAttribute('aria-label', 'Pausar video');
      } else {
        controlBtn.classList.remove('hf-video-hero__control--pause');
        controlBtn.classList.add('hf-video-hero__control--play');
        controlBtn.setAttribute('aria-label', 'Reproducir video');
      }
    }

    // Control functions
    function play() {
      if (prefersReducedMotion) return;
      video.play().catch(() => {});
    }

    function pause() {
      video.pause();
    }

    function toggle() {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    }

    function destroy() {
      pause();
      if (controlBtn && config.showControl) {
        controlBtn.remove();
      }
    }

    // Visibility API - pause when tab not visible
    function handleVisibility() {
      if (document.hidden) {
        video.pause();
      } else if (config.autoplay && isPlaying) {
        video.play().catch(() => {});
      }
    }

    // Listen for reduced motion changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionHandler = (e) => {
      if (e.matches) {
        pause();
        video.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
      } else {
        video.style.display = '';
        if (config.autoplay) play();
      }
    };
    motionQuery.addEventListener('change', motionHandler);

    // Initialize
    setupVideo();
    createControl();
    document.addEventListener('visibilitychange', handleVisibility);

    // API
    const api = {
      el,
      play,
      pause,
      toggle,
      destroy: () => {
        destroy();
        document.removeEventListener('visibilitychange', handleVisibility);
        motionQuery.removeEventListener('change', motionHandler);
      },
      isPlaying: () => isPlaying
    };

    el._hfVideoHero = api;

    return api;
  }

  /**
   * Create a video hero programmatically
   * @param {Object} options - Configuration
   * @returns {HTMLElement} Video hero element
   */
  function createVideoHero(options = {}) {
    const {
      videoSrc = '',
      fallbackSrc = '',
      title = '',
      subtitle = '',
      badge = '',
      overlay = 'gradient',
      actions = [],
      variant = ''
    } = options;

    const hero = document.createElement('div');
    hero.className = 'hf-video-hero';
    if (variant) hero.classList.add(`hf-video-hero--${variant}`);

    // Video
    if (videoSrc) {
      const video = document.createElement('video');
      video.className = 'hf-video-hero__media hf-video-hero__video';
      video.src = videoSrc;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      hero.appendChild(video);
    }

    // Fallback image
    if (fallbackSrc) {
      const img = document.createElement('img');
      img.className = 'hf-video-hero__media hf-video-hero__fallback';
      img.src = fallbackSrc;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      hero.appendChild(img);
    }

    // Overlay
    if (overlay) {
      const overlayEl = document.createElement('div');
      overlayEl.className = `hf-video-hero__overlay hf-video-hero__overlay--${overlay}`;
      hero.appendChild(overlayEl);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'hf-video-hero__content';

    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'badge badge--primary hf-video-hero__badge';
      badgeEl.textContent = badge;
      content.appendChild(badgeEl);
    }

    if (title) {
      const titleEl = document.createElement('h1');
      titleEl.className = 'hf-video-hero__title';
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }

    if (subtitle) {
      const subEl = document.createElement('p');
      subEl.className = 'hf-video-hero__subtitle';
      subEl.textContent = subtitle;
      content.appendChild(subEl);
    }

    if (actions.length > 0) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'hf-video-hero__actions';
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `btn btn--${action.variant || 'primary'} btn--lg`;
        btn.textContent = action.label;
        if (action.onClick) btn.addEventListener('click', action.onClick);
        actionsEl.appendChild(btn);
      });
      content.appendChild(actionsEl);
    }

    hero.appendChild(content);

    return hero;
  }

  // Register with HF core
  if (typeof HF !== 'undefined' && HF.register) {
    HF.register('video-hero', initVideoHero);
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hf="video-hero"]').forEach(el => {
      if (!el._hfVideoHero) {
        initVideoHero(el);
      }
    });
  });

  // Export
  window.HFVideoHero = {
    init: initVideoHero,
    create: createVideoHero
  };
})();
