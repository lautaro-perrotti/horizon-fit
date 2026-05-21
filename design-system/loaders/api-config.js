/**
 * API Configuration & Helpers
 * Configuración centralizada para acceder a todos los endpoints de WordPress
 */

(function() {
  'use strict';

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8089'
    : `http://${window.location.hostname}:8089`;

  const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 horas

  function getCacheKey(endpoint) {
    return `hf_cache_${endpoint}`;
  }

  function getCachedData(endpoint) {
    const cached = localStorage.getItem(getCacheKey(endpoint));
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(getCacheKey(endpoint));
      return null;
    }
    return data;
  }

  function setCachedData(endpoint, data) {
    localStorage.setItem(getCacheKey(endpoint), JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }

  async function fetchAPI(endpoint) {
    const cached = getCachedData(endpoint);
    if (cached) return cached;

    try {
      const url = `${API_BASE}${endpoint}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`API Error: ${endpoint} returned ${response.status}`);
        return null;
      }
      const data = await response.json();
      setCachedData(endpoint, data);
      return data;
    } catch (error) {
      console.warn(`API Error: Failed to fetch ${endpoint}`, error);
      return null;
    }
  }

  window.HF = window.HF || {};
  window.HF.API = {
    base: API_BASE,

    // Marquee Settings
    marqueeSettings: () => fetchAPI('/wp-json/wp/v2/settings/marquee'),

    // Hero Settings
    heroSettings: () => fetchAPI('/wp-json/wp/v2/settings/hero'),

    // WooCommerce: Categorías de productos
    categories: (params = {}) => {
      const qs = new URLSearchParams({ per_page: 4, ...params });
      return fetchAPI(`/wp-json/wc/v3/products/categories?${qs}`);
    },

    // WooCommerce: Productos
    products: (params = {}) => {
      const qs = new URLSearchParams(params);
      return fetchAPI(`/wp-json/wc/v3/products?${qs}`);
    },

    // WooCommerce: Producto individual
    product: (id) => fetchAPI(`/wp-json/wc/v3/products/${id}`),

    // Utility: Limpiar caché
    clearCache: () => {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('hf_cache_')) {
          localStorage.removeItem(key);
        }
      });
    }
  };

  console.log('HF.API initialized. Base URL:', API_BASE);
})();
