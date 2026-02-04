/**
 * HF-BANNER Component JS
 * Dismissible banner with localStorage persistence
 */

(function() {
  'use strict';

  const STORAGE_PREFIX = 'hf-banner-dismissed-';

  /**
   * Initialize a banner element
   * @param {HTMLElement} el - Banner element
   * @param {Object} options - Configuration options
   * @returns {Object} Banner API
   */
  function initBanner(el, options = {}) {
    if (!el) return null;

    const config = {
      dismissible: el.hasAttribute('data-dismissible') || options.dismissible || false,
      persistKey: el.getAttribute('data-persist-key') || options.persistKey || null,
      autoDismiss: parseInt(el.getAttribute('data-auto-dismiss') || options.autoDismiss) || 0,
      ...options
    };

    // Check if already dismissed (persisted)
    if (config.persistKey) {
      const dismissed = localStorage.getItem(STORAGE_PREFIX + config.persistKey);
      if (dismissed === 'true') {
        el.classList.add('is-hidden');
        el.setAttribute('aria-hidden', 'true');
        return createAPI(el, config, true);
      }
    }

    // Setup dismiss button
    const dismissBtn = el.querySelector('.hf-banner__dismiss');
    if (dismissBtn && config.dismissible) {
      dismissBtn.addEventListener('click', () => dismiss());
    }

    // Auto dismiss
    let autoDismissTimer = null;
    if (config.autoDismiss > 0) {
      autoDismissTimer = setTimeout(() => dismiss(), config.autoDismiss);
    }

    function dismiss() {
      if (autoDismissTimer) clearTimeout(autoDismissTimer);

      el.classList.add('is-hidden');
      el.setAttribute('aria-hidden', 'true');

      if (config.persistKey) {
        localStorage.setItem(STORAGE_PREFIX + config.persistKey, 'true');
      }

      // Emit event
      el.dispatchEvent(new CustomEvent('hf:banner:dismiss', { bubbles: true }));

      // Remove from DOM after animation
      setTimeout(() => {
        if (el.parentNode) {
          el.style.display = 'none';
        }
      }, 200);
    }

    function show() {
      el.classList.remove('is-hidden');
      el.removeAttribute('aria-hidden');
      el.style.display = '';

      if (config.persistKey) {
        localStorage.removeItem(STORAGE_PREFIX + config.persistKey);
      }
    }

    function destroy() {
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
    }

    function createAPI(element, cfg, isDismissed = false) {
      return {
        el: element,
        dismiss: isDismissed ? () => {} : dismiss,
        show,
        destroy,
        isDismissed: () => element.classList.contains('is-hidden')
      };
    }

    return createAPI(el, config);
  }

  /**
   * Create a banner programmatically
   * @param {Object} options - Banner options
   * @returns {HTMLElement} Banner element
   */
  function createBanner(options = {}) {
    const {
      variant = 'info',
      title = '',
      message = '',
      icon = null,
      dismissible = true,
      persistKey = null,
      actions = [],
      size = ''
    } = options;

    const banner = document.createElement('div');
    banner.className = `hf-banner hf-banner--${variant}`;
    if (size) banner.classList.add(`hf-banner--${size}`);
    banner.setAttribute('role', 'alert');

    // Icon
    if (icon) {
      const iconEl = document.createElement('div');
      iconEl.className = 'hf-banner__icon';
      iconEl.innerHTML = icon;
      banner.appendChild(iconEl);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'hf-banner__content';

    if (title) {
      const titleEl = document.createElement('p');
      titleEl.className = 'hf-banner__title';
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }

    if (message) {
      const msgEl = document.createElement('p');
      msgEl.className = 'hf-banner__message';
      msgEl.textContent = message;
      content.appendChild(msgEl);
    }

    // Actions
    if (actions.length > 0) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'hf-banner__actions';
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `btn btn--${action.variant || 'secondary'} btn--sm`;
        btn.textContent = action.label;
        if (action.onClick) {
          btn.addEventListener('click', action.onClick);
        }
        actionsEl.appendChild(btn);
      });
      content.appendChild(actionsEl);
    }

    banner.appendChild(content);

    // Dismiss button
    if (dismissible) {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'hf-banner__dismiss';
      dismissBtn.setAttribute('aria-label', 'Cerrar');
      dismissBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      banner.appendChild(dismissBtn);
      banner.setAttribute('data-dismissible', 'true');
    }

    if (persistKey) {
      banner.setAttribute('data-persist-key', persistKey);
    }

    return banner;
  }

  // Register with HF core if available
  if (typeof HF !== 'undefined' && HF.register) {
    HF.register('banner', initBanner);
  }

  // Auto-init banners with data-hf="banner"
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hf="banner"]').forEach(el => {
      if (!el._hfBanner) {
        el._hfBanner = initBanner(el);
      }
    });
  });

  // Export
  window.HFBanner = {
    init: initBanner,
    create: createBanner
  };
})();
