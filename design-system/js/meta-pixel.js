/**
 * Meta Pixel storefront tracker.
 *
 * Config source:
 *   1. window.HF_META_PIXEL_ID
 *   2. <meta name="hf-meta-pixel-id" content="...">
 *   3. /wp-content/uploads/horizon-fit-cache/tracking-settings.json
 *
 * Events: PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo,
 * Search, Contact, CompleteRegistration, Subscribe and Purchase.
 * The script is a no-op until a numeric Pixel ID is configured.
 */
(function (window, document) {
  'use strict';

  var SETTINGS_SRC = 'https://api.horizonfit.com.ar/wp-content/uploads/horizon-fit-cache/tracking-settings.json';
  var PURCHASE_STORAGE_PREFIX = 'hf-meta-purchase:';
  var EVENT_STORAGE_PREFIX = 'hf-meta-event:';
  var SIZE_TOKENS = {
    XS: 1, S: 1, M: 1, L: 1, XL: 1, XXL: 1, XXXL: 1, U: 1, UNI: 1, UNICO: 1
  };
  var pixelId = normalizePixelId(window.HF_META_PIXEL_ID || metaPixelId());
  var initialized = false;
  var loading = null;

  function isProductionHost() {
    return /(^|\.)horizonfit\.com\.ar$/i.test(window.location.hostname || '');
  }

  function debugEnabled() {
    try {
      if (window.HF_META_PIXEL_DEBUG) return true;
      if (window.localStorage && window.localStorage.getItem('hfMetaPixelDebug') === '1') return true;
      return /(?:^|[?&])metapixeldebug=1(?:&|$)/.test(window.location.search || '');
    } catch (error) {
      return Boolean(window.HF_META_PIXEL_DEBUG);
    }
  }

  function logDebug(eventName, params) {
    if (!debugEnabled()) return;
    console.info('[HF Meta Pixel]', eventName, params || {});
  }

  function normalizePixelId(value) {
    var id = String(value || '').replace(/\D+/g, '');
    return id.length >= 6 ? id : '';
  }

  function metaPixelId() {
    var tag = document.querySelector('meta[name="hf-meta-pixel-id"]');
    return tag ? tag.getAttribute('content') : '';
  }

  function fetchPixelId() {
    if (pixelId) return Promise.resolve(pixelId);
    if (loading) return loading;
    loading = fetch(SETTINGS_SRC, { credentials: 'omit', cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) return '';
        return response.json();
      })
      .then(function (settings) {
        pixelId = normalizePixelId(settings && (settings.metaPixelId || settings.meta_pixel_id));
        return pixelId;
      })
      .catch(function () {
        return '';
      });
    return loading;
  }

  function installSnippet(id) {
    if (initialized || !id) return;
    if (!window.fbq) {
      var fbq = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      window.fbq = fbq;
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
    }
    if (!document.querySelector('script[src*="connect.facebook.net"][src*="fbevents.js"]')) {
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
    window.fbq('init', id);
    window.fbq('track', 'PageView');
    initialized = true;
    logDebug('PageView', { pixelId: id });
  }

  function ensureReady() {
    if (!isProductionHost()) return Promise.resolve(false);
    return fetchPixelId().then(function (id) {
      if (!id) return false;
      installSnippet(id);
      return typeof window.fbq === 'function';
    });
  }

  function sendEvent(name, params, options) {
    logDebug(name, params);
    return ensureReady().then(function (ready) {
      if (!ready) return;
      if (options) {
        window.fbq('track', name, params || {}, options);
      } else {
        window.fbq('track', name, params || {});
      }
    });
  }

  function normalizeSku(value) {
    return String(value || '').trim().toUpperCase();
  }

  function sizeToken(value) {
    var token = normalizeSku(value);
    return SIZE_TOKENS[token] ? token : '';
  }

  function parentSkuFromSku(sku) {
    var normalized = normalizeSku(sku);
    if (!normalized && window.hfGa4 && typeof window.hfGa4.parentSku === 'function') {
      return window.hfGa4.parentSku(sku);
    }
    if (!normalized) return '';
    var segments = normalized.split('-').map(function (part) {
      return part.trim();
    }).filter(Boolean);
    if (segments.length >= 4 && sizeToken(segments[segments.length - 1])) {
      segments.pop();
      return segments.join('-');
    }
    return normalized;
  }

  function sizeFromSku(sku) {
    var normalized = normalizeSku(sku);
    var segments = normalized.split('-').map(function (part) {
      return part.trim();
    }).filter(Boolean);
    if (!segments.length) return '';
    return sizeToken(segments[segments.length - 1]);
  }

  function sizeFromVariation(variation) {
    if (!variation) return '';
    var attrs = variation.attributes || {};
    if (Array.isArray(attrs)) {
      var match = attrs.find(function (entry) {
        var name = String(entry.attribute || entry.name || entry.label || '').toLowerCase();
        return name.indexOf('talle') !== -1 || name === 'size' || name.indexOf('size') !== -1;
      });
      return sizeToken(match && (match.value || match.name)) || String((match && match.value) || '').trim();
    }
    return sizeToken(attrs.talle || attrs.size || attrs.pa_talle || '')
      || String(attrs.talle || attrs.size || attrs.pa_talle || '').trim();
  }

  function itemIdFromSku(sku, fallbackId) {
    var parent = parentSkuFromSku(sku);
    if (parent) return parent;
    if (fallbackId === 0 || fallbackId) return String(fallbackId);
    return '';
  }

  function decodeName(value) {
    var textarea = decodeName.el || (decodeName.el = document.createElement('textarea'));
    textarea.innerHTML = String(value || '');
    return textarea.value || String(value || '');
  }

  function toMajor(raw, currency) {
    var amount = Number(raw);
    if (!Number.isFinite(amount)) return 0;
    var minor = currency && Number.isFinite(Number(currency.currency_minor_unit))
      ? Number(currency.currency_minor_unit)
      : 0;
    if (minor <= 0) return amount;
    return amount / Math.pow(10, minor);
  }

  function currencyCode(currency) {
    return String((currency && (currency.currency_code || currency.currencyCode)) || 'ARS');
  }

  function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function metaItemFromGa4Item(item) {
    return {
      id: item.item_id,
      quantity: Math.max(1, Number(item.quantity || 1)),
      item_price: roundMoney(item.price || 0)
    };
  }

  function itemFromProduct(product, variation, quantity) {
    var sku = (variation && variation.sku) || (product && product.sku) || '';
    var fallbackId = (variation && variation.id) || (product && product.id);
    var variantSku = variation && variation.sku ? String(variation.sku).trim() : '';
    var rawPrice = (variation && (variation.price || (variation.prices && variation.prices.price)))
      || (product && (product.price || (product.prices && product.prices.price)))
      || 0;
    var currency = (variation && variation.prices) || (product && product.prices) || {};
    return {
      item_id: itemIdFromSku(sku, fallbackId),
      item_name: decodeName(product && product.name),
      item_variant: sizeFromVariation(variation) || sizeFromSku(variantSku || sku) || variantSku || '',
      price: roundMoney(toMajor(rawPrice, currency)),
      quantity: Math.max(1, Number(quantity || 1))
    };
  }

  function itemFromCartItem(item, currency) {
    var sku = item && item.sku ? item.sku : '';
    var priceCurrency = (item && item.prices) || currency || {};
    var rawPrice = (item && item.prices && item.prices.price)
      || (item && item.prices && item.prices.sale_price)
      || 0;
    return {
      item_id: itemIdFromSku(sku, item && item.id),
      item_name: decodeName(item && item.name),
      item_variant: sizeFromVariation(item) || sizeFromSku(sku) || String(sku || '').trim(),
      price: roundMoney(toMajor(rawPrice, priceCurrency)),
      quantity: Math.max(1, Number(item && item.quantity || 1))
    };
  }

  function itemsFromCart(cart) {
    var items = cart && Array.isArray(cart.items) ? cart.items : [];
    var currency = (cart && cart.totals) || (items[0] && items[0].prices) || {};
    return items
      .filter(function (item) {
        return Number(item && item.quantity || 0) > 0;
      })
      .map(function (item) {
        return itemFromCartItem(item, currency);
      })
      .filter(function (item) {
        return item.item_id;
      });
  }

  function cartValue(cart) {
    var currency = (cart && cart.totals) || {};
    return roundMoney(toMajor(currency.total_price || currency.total_items || 0, currency));
  }

  function cartSignature(cart) {
    return itemsFromCart(cart).map(function (item) {
      return [item.item_id, item.item_variant, item.quantity].join(':');
    }).sort().join('|') + ':' + cartValue(cart);
  }

  function sendOnce(key, name, params) {
    try {
      var storageKey = EVENT_STORAGE_PREFIX + key;
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch (error) {
      // Tracking still works if browser storage is unavailable.
    }
    return sendEvent(name, params);
  }

  function findCartItem(cart, productId) {
    var items = cart && Array.isArray(cart.items) ? cart.items : [];
    var matches = items.filter(function (item) {
      return Number(item && item.id) === Number(productId);
    });
    return matches[matches.length - 1] || items[items.length - 1] || null;
  }

  var api = {
    pixelId: function () { return pixelId; },
    event: sendEvent,
    viewItem: function (product, variation) {
      var item = itemFromProduct(product, variation, 1);
      if (!item.item_id) return;
      return sendEvent('ViewContent', {
        content_ids: [item.item_id],
        content_name: item.item_name,
        content_type: 'product',
        contents: [metaItemFromGa4Item(item)],
        currency: 'ARS',
        value: item.price
      });
    },
    addToCart: function (product, variation, cart, productId) {
      var cartItem = findCartItem(cart, productId);
      var item = cartItem
        ? itemFromCartItem(cartItem, cart && cart.totals)
        : itemFromProduct(product, variation, 1);
      if (!item.item_id) return;
      return sendEvent('AddToCart', {
        content_ids: [item.item_id],
        content_name: item.item_name,
        content_type: 'product',
        contents: [metaItemFromGa4Item(item)],
        currency: currencyCode(cart && cart.totals) || 'ARS',
        value: roundMoney(item.price * item.quantity)
      });
    },
    beginCheckout: function (cart) {
      var items = itemsFromCart(cart);
      if (!items.length) return;
      return sendOnce('checkout:' + cartSignature(cart), 'InitiateCheckout', {
        content_ids: items.map(function (item) { return item.item_id; }),
        content_type: 'product',
        contents: items.map(metaItemFromGa4Item),
        currency: currencyCode(cart && cart.totals) || 'ARS',
        num_items: items.reduce(function (sum, item) { return sum + item.quantity; }, 0),
        value: cartValue(cart)
      });
    },
    addPaymentInfo: function (cart, method) {
      var items = itemsFromCart(cart);
      if (!items.length) return;
      return sendOnce('payment:' + String(method || '') + ':' + cartSignature(cart), 'AddPaymentInfo', {
        content_ids: items.map(function (item) { return item.item_id; }),
        content_type: 'product',
        contents: items.map(metaItemFromGa4Item),
        currency: currencyCode(cart && cart.totals) || 'ARS',
        payment_method: String(method || ''),
        value: cartValue(cart)
      });
    },
    search: function (query) {
      var term = String(query || '').trim();
      if (!term) return;
      return sendEvent('Search', { search_string: term, content_category: 'products' });
    },
    contact: function (channel, placement) {
      return sendEvent('Contact', {
        content_name: String(placement || 'storefront'),
        content_category: String(channel || 'contact')
      });
    },
    completeRegistration: function (reference) {
      return sendOnce('registration:' + String(reference || 'checkout'), 'CompleteRegistration', {
        content_name: 'Cuenta Horizon Fit',
        status: true
      });
    },
    subscribe: function (source) {
      return sendEvent('Subscribe', {
        content_name: 'Newsletter Horizon Fit',
        content_category: String(source || 'footer'),
        status: true
      });
    },
    purchase: function (payload) {
      payload = payload || {};
      var orderId = payload.orderId;
      if (!orderId) return;
      var storageKey = PURCHASE_STORAGE_PREFIX + orderId;
      try {
        if (window.sessionStorage.getItem(storageKey)) return;
        window.sessionStorage.setItem(storageKey, '1');
      } catch (error) {
        // Continue: a duplicate browser event is preferable to losing the conversion.
      }
      var cart = payload.order || (payload.snapshot && payload.snapshot.cart) || {};
      var summaryTotals = payload.orderSummary && payload.orderSummary.totals;
      var currency = summaryTotals || cart.totals || { currency_code: 'ARS', currency_minor_unit: 2 };
      var items = itemsFromCart(cart);
      var value = roundMoney(toMajor(
        (summaryTotals && summaryTotals.total_price) || (cart.totals && cart.totals.total_price) || 0,
        currency
      ));
      if (!items.length && !value) return;
      return sendEvent('Purchase', {
        content_ids: items.map(function (item) { return item.item_id; }),
        content_type: 'product',
        contents: items.map(metaItemFromGa4Item),
        currency: currencyCode(currency),
        num_items: items.reduce(function (sum, item) { return sum + item.quantity; }, 0),
        value: value
      }, {
        // The server-side Conversions API uses this exact identifier so Meta
        // deduplicates browser and server Purchase events.
        eventID: 'hf-order-' + String(orderId)
      });
    }
  };

  window.hfMetaPixel = api;
  ensureReady();
})(window, document);
