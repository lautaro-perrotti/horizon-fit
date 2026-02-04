/**
 * HF-GRID Component JS
 * Grid filtering, sorting, and animations
 */

(function() {
  'use strict';

  /**
   * Initialize a collection grid with filtering
   * @param {HTMLElement} el - Collection container element
   * @param {Object} options - Configuration options
   * @returns {Object} Collection API
   */
  function initCollection(el, options = {}) {
    if (!el) return null;

    const config = {
      filterAttribute: 'data-category',
      animateOnFilter: true,
      ...options
    };

    const grid = el.querySelector('.hf-collection__grid, .hf-grid');
    const filters = el.querySelectorAll('.hf-filter-chip');
    const countEl = el.querySelector('.hf-collection__count');
    const emptyEl = el.querySelector('.hf-collection__empty');

    if (!grid) return null;

    const items = Array.from(grid.children);
    let activeFilters = new Set(['all']);

    // Filter items
    function filterItems() {
      let visibleCount = 0;

      items.forEach(item => {
        const categories = (item.getAttribute(config.filterAttribute) || '').split(',').map(c => c.trim());
        const shouldShow = activeFilters.has('all') || categories.some(cat => activeFilters.has(cat));

        if (shouldShow) {
          item.style.display = '';
          item.removeAttribute('hidden');
          visibleCount++;
        } else {
          item.style.display = 'none';
          item.setAttribute('hidden', '');
        }
      });

      // Update count
      if (countEl) {
        countEl.textContent = `${visibleCount} producto${visibleCount !== 1 ? 's' : ''}`;
      }

      // Show/hide empty state
      if (emptyEl) {
        emptyEl.style.display = visibleCount === 0 ? '' : 'none';
      }

      // Trigger animation
      if (config.animateOnFilter && grid.hasAttribute('data-animate')) {
        grid.classList.remove('is-visible');
        requestAnimationFrame(() => {
          grid.classList.add('is-visible');
        });
      }

      // Emit event
      el.dispatchEvent(new CustomEvent('hf:grid:filter', {
        detail: { filters: Array.from(activeFilters), count: visibleCount },
        bubbles: true
      }));
    }

    // Handle filter click
    function handleFilterClick(e) {
      const chip = e.target.closest('.hf-filter-chip');
      if (!chip) return;

      const filter = chip.getAttribute('data-filter');

      if (filter === 'all') {
        activeFilters = new Set(['all']);
      } else {
        activeFilters.delete('all');

        if (activeFilters.has(filter)) {
          activeFilters.delete(filter);
          if (activeFilters.size === 0) {
            activeFilters.add('all');
          }
        } else {
          activeFilters.add(filter);
        }
      }

      // Update chip states
      filters.forEach(f => {
        const isActive = activeFilters.has(f.getAttribute('data-filter'));
        f.classList.toggle('is-active', isActive);
        f.setAttribute('aria-pressed', isActive);
      });

      filterItems();
    }

    // Sort items
    function sortItems(sortFn) {
      const sortedItems = [...items].sort(sortFn);

      sortedItems.forEach(item => {
        grid.appendChild(item);
      });

      // Re-trigger animation
      if (config.animateOnFilter && grid.hasAttribute('data-animate')) {
        grid.classList.remove('is-visible');
        requestAnimationFrame(() => {
          grid.classList.add('is-visible');
        });
      }
    }

    // Common sort functions
    const sortFunctions = {
      'price-asc': (a, b) => {
        const priceA = parseFloat(a.getAttribute('data-price') || 0);
        const priceB = parseFloat(b.getAttribute('data-price') || 0);
        return priceA - priceB;
      },
      'price-desc': (a, b) => {
        const priceA = parseFloat(a.getAttribute('data-price') || 0);
        const priceB = parseFloat(b.getAttribute('data-price') || 0);
        return priceB - priceA;
      },
      'name-asc': (a, b) => {
        const nameA = a.getAttribute('data-name') || '';
        const nameB = b.getAttribute('data-name') || '';
        return nameA.localeCompare(nameB);
      },
      'newest': (a, b) => {
        const dateA = new Date(a.getAttribute('data-date') || 0);
        const dateB = new Date(b.getAttribute('data-date') || 0);
        return dateB - dateA;
      }
    };

    // Handle sort change
    const sortSelect = el.querySelector('.hf-collection__sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const sortKey = e.target.value;
        if (sortFunctions[sortKey]) {
          sortItems(sortFunctions[sortKey]);
        }
      });
    }

    // Initialize
    filters.forEach(f => {
      f.addEventListener('click', handleFilterClick);
    });

    // Initial animation
    if (grid.hasAttribute('data-animate')) {
      // Use IntersectionObserver for scroll-triggered animation
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            grid.classList.add('is-visible');
            observer.unobserve(grid);
          }
        });
      }, { threshold: 0.1 });

      observer.observe(grid);
    }

    // API
    return {
      el,
      filterItems,
      sortItems,
      getActiveFilters: () => Array.from(activeFilters),
      setFilter: (filter) => {
        activeFilters = new Set([filter]);
        filterItems();
      },
      clearFilters: () => {
        activeFilters = new Set(['all']);
        filterItems();
      }
    };
  }

  /**
   * Initialize masonry layout
   * @param {HTMLElement} grid - Grid element
   */
  function initMasonry(grid) {
    if (!grid || !grid.classList.contains('hf-grid--masonry')) return;

    // CSS columns handles basic masonry
    // This function can be extended for JS-based masonry if needed

    return {
      el: grid,
      refresh: () => {
        // Force reflow
        grid.style.display = 'none';
        grid.offsetHeight;
        grid.style.display = '';
      }
    };
  }

  // Register with HF core
  if (typeof HF !== 'undefined' && HF.register) {
    HF.register('collection', initCollection);
    HF.register('grid', (el) => {
      if (el.classList.contains('hf-grid--masonry')) {
        return initMasonry(el);
      }
    });
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hf="collection"]').forEach(el => {
      if (!el._hfCollection) {
        el._hfCollection = initCollection(el);
      }
    });
  });

  // Export
  window.HFGrid = {
    initCollection,
    initMasonry
  };
})();
