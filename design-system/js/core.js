/**
 * HORIZON FIT — Design System Core Helpers
 * Shared utilities for all components
 */

const HF = (function() {
  'use strict';

  // ========================================
  // DOM Helpers
  // ========================================

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const on = (el, event, handler, opts = {}) => {
    if (!el) return () => {};
    el.addEventListener(event, handler, opts);
    return () => el.removeEventListener(event, handler, opts);
  };

  const emit = (el, eventName, detail = {}) => {
    if (!el) return;
    el.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
  };

  // ========================================
  // Accessibility Helpers
  // ========================================

  const trapFocus = (container) => {
    const focusable = qsa(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (focusable.length === 0) return () => {};

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handler = (e) => {
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
    };

    container.addEventListener('keydown', handler);
    return () => container.removeEventListener('keydown', handler);
  };

  let scrollLockCount = 0;
  let originalOverflow = '';

  const lockScroll = () => {
    if (scrollLockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount++;
  };

  const unlockScroll = () => {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.overflow = originalOverflow;
    }
  };

  // ========================================
  // Motion / Accessibility
  // ========================================

  const prefersReducedMotion = () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  // ========================================
  // Utility Functions
  // ========================================

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const debounce = (fn, delay = 150) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const throttle = (fn, limit = 150) => {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  const safeParseJSON = (str, fallback = {}) => {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  };

  // ========================================
  // Component Registration
  // ========================================

  const components = new Map();

  const register = (name, initFn) => {
    components.set(name, initFn);
  };

  const init = (root = document) => {
    qsa('[data-hf]', root).forEach(el => {
      const type = el.getAttribute('data-hf');
      const initFn = components.get(type);
      if (initFn && !el._hfInit) {
        el._hfInit = true;
        initFn(el);
      }
    });
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  // ========================================
  // Escape HTML (for safe rendering)
  // ========================================

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // ========================================
  // Unique ID generator
  // ========================================

  let idCounter = 0;
  const uniqueId = (prefix = 'hf') => `${prefix}-${++idCounter}-${Date.now().toString(36)}`;

  // ========================================
  // Public API
  // ========================================

  return {
    qs,
    qsa,
    on,
    emit,
    trapFocus,
    lockScroll,
    unlockScroll,
    prefersReducedMotion,
    clamp,
    debounce,
    throttle,
    safeParseJSON,
    register,
    init,
    escapeHtml,
    uniqueId
  };
})();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HF;
}
