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

    // Optional: full viewport height minus offsets (e.g., sticky header)
    let teardownFullHeight = null;
    let fullHeightRaf = null;

    function setupFullHeight() {
      if (!el.classList.contains('hf-video-hero--full')) return;

      const rawSelectors = el.getAttribute('data-offset-selectors');
      if (!rawSelectors) return;

      const selectors = rawSelectors
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (selectors.length === 0) return;

      const getViewportHeight = () => {
        if (window.visualViewport && Number.isFinite(window.visualViewport.height)) {
          return window.visualViewport.height;
        }
        return window.innerHeight;
      };

      const updateMinHeight = () => {
        let offset = 0;
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((node) => {
            if (!node) return;
            if (isMobileViewport && node.matches && node.matches('header.nav, .nav')) return;
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            const h = node.getBoundingClientRect().height;
            if (h > 0) offset += h;
          });
        });

        const h = Math.max(0, getViewportHeight() - offset);
        el.style.minHeight = `${h}px`;
      };

      const scheduleUpdate = () => {
        if (fullHeightRaf !== null) return;
        fullHeightRaf = window.requestAnimationFrame(() => {
          fullHeightRaf = null;
          updateMinHeight();
        });
      };

      const observedNodes = [];
      const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleUpdate)
        : null;

      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((node) => {
          if (!node || observedNodes.includes(node)) return;
          observedNodes.push(node);
          if (resizeObserver) resizeObserver.observe(node);
        });
      });

      updateMinHeight();
      window.addEventListener('resize', scheduleUpdate, { passive: true });
      window.addEventListener('orientationchange', scheduleUpdate, { passive: true });
      window.addEventListener('load', scheduleUpdate);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleUpdate, { passive: true });
      }

      teardownFullHeight = () => {
        if (fullHeightRaf !== null) {
          window.cancelAnimationFrame(fullHeightRaf);
          fullHeightRaf = null;
        }
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener('resize', scheduleUpdate);
        window.removeEventListener('orientationchange', scheduleUpdate);
        window.removeEventListener('load', scheduleUpdate);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', scheduleUpdate);
        }
      };
    }

    // Setup video attributes
    function setupVideo() {
      video.muted = config.muted;
      video.loop = config.loop;
      video.setAttribute('loop', '');
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('autoplay', '');
      video.preload = video.getAttribute('preload') || 'metadata';

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

      // Fallback for devices/browsers where `loop` can be unreliable
      video.addEventListener('ended', () => {
        if (!config.loop) return;
        try {
          video.currentTime = 0;
        } catch (_) {
          // ignore
        }
        video.play().catch(() => {});
      });

      // Extra safety net: some mobile browsers can stall at the end frame.
      video.addEventListener('timeupdate', () => {
        if (!config.loop || !video.duration || !Number.isFinite(video.duration)) return;
        if (video.duration - video.currentTime < 0.12) {
          try {
            video.currentTime = 0;
          } catch (_) {
            // ignore
          }
        }
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
    setupFullHeight();
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
        if (teardownFullHeight) teardownFullHeight();
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
      videoSrcMobile = '',
      videoSrcDesktop = '',
      breakpoint = 768,
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
    if (videoSrc || videoSrcMobile || videoSrcDesktop) {
      const video = document.createElement('video');
      video.className = 'hf-video-hero__media hf-video-hero__video';

      if (videoSrcMobile || videoSrcDesktop) {
        if (videoSrcMobile) {
          const sourceMobile = document.createElement('source');
          sourceMobile.src = videoSrcMobile;
          sourceMobile.type = 'video/mp4';
          sourceMobile.media = `(max-width: ${breakpoint}px)`;
          video.appendChild(sourceMobile);
        }

        if (videoSrcDesktop) {
          const sourceDesktop = document.createElement('source');
          sourceDesktop.src = videoSrcDesktop;
          sourceDesktop.type = 'video/mp4';
          sourceDesktop.media = `(min-width: ${breakpoint + 1}px)`;
          video.appendChild(sourceDesktop);
        }
      } else {
        video.src = videoSrc;
      }

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
