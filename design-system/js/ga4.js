/**
 * GA4 storefront tracker.
 *
 * Property: 550763778
 * Measurement ID: G-8TL56B3B8X
 *
 * The public shop is this SPA (index.html + page-builder.js), not the Woo theme.
 * Site Kit / GTM on WordPress would miss every storefront hit.
 *
 * item_id contract (document before changing Horizon Control identity):
 *   item_id     = parent SKU, e.g. "004-TOP-BOR"
 *                 Variation SKU "004-TOP-BOR-S" has the size suffix stripped
 *                 using the same rules as hf_product_parent_sku_base_from_variation_sku.
 *                 If the value is already a parent SKU, it is sent as-is.
 *                 If SKU is empty, fallback is the Woo product/variation numeric id.
 *   item_variant = size token (S/M/L/…) or the full variation SKU.
 *
 * Events include the GA4 ecommerce funnel plus search, login, sign_up and leads.
 * Hits are sent only on horizonfit.com.ar. Local / IP hosts expose the same API as a no-op.
 */
(function (window, document) {
  'use strict';

  var MEASUREMENT_ID = 'G-8TL56B3B8X';
  var PURCHASE_STORAGE_PREFIX = 'hf-ga4-purchase:';
  var EVENT_STORAGE_PREFIX = 'hf-ga4-event:';
  var SIZE_TOKENS = {
    XS: 1, S: 1, M: 1, L: 1, XL: 1, XXL: 1, XXXL: 1, U: 1, UNI: 1, UNICO: 1
  };
  var ITEM_ID_CONTRACT = {
    field: 'item_id',
    value: 'parent SKU (example: 004-TOP-BOR)',
    notSent: 'variant SKU (004-TOP-BOR-S) and Woo numeric id, unless SKU is missing',
    item_variant: 'size token (S/M/L) or full variation SKU',
    measurementId: MEASUREMENT_ID
  };

  function isProductionHost() {
    return /(^|\.)horizonfit\.com\.ar$/i.test(window.location.hostname || '');
  }

  function debugEnabled() {
    try {
      if (window.HF_GA4_DEBUG) return true;
      if (window.localStorage && window.localStorage.getItem('hfGa4Debug') === '1') return true;
      return /(?:^|[?&])ga4debug=1(?:&|$)/.test(window.location.search || '');
    } catch (error) {
      return Boolean(window.HF_GA4_DEBUG);
    }
  }

  function logDebug(eventName, params) {
    if (!debugEnabled()) return;
    console.info('[HF GA4]', eventName, params || {});
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

  function itemFromProduct(product, variation, quantity) {
    var sku = (variation && variation.sku) || (product && product.sku) || '';
    var fallbackId = (variation && variation.id) || (product && product.id);
    var variantSku = variation && variation.sku ? String(variation.sku).trim() : '';
    var size = sizeFromVariation(variation) || sizeFromSku(variantSku || sku);
    var rawPrice = (variation && (variation.price || (variation.prices && variation.prices.price)))
      || (product && (product.price || (product.prices && product.prices.price)))
      || 0;
    var currency = (variation && variation.prices) || (product && product.prices) || {};
    return {
      item_id: itemIdFromSku(sku, fallbackId),
      item_name: decodeName(product && product.name),
      item_brand: 'Horizon Fit',
      item_variant: size || variantSku || '',
      price: roundMoney(toMajor(rawPrice, currency)),
      quantity: Math.max(1, Number(quantity || 1))
    };
  }

  function itemFromCartItem(item, currency) {
    var sku = item && item.sku ? item.sku : '';
    var size = sizeFromVariation(item) || sizeFromSku(sku);
    var priceCurrency = (item && item.prices) || currency || {};
    var rawPrice = (item && item.prices && item.prices.price)
      || (item && item.prices && item.prices.sale_price)
      || 0;
    return {
      item_id: itemIdFromSku(sku, item && item.id),
      item_name: decodeName(item && item.name),
      item_brand: 'Horizon Fit',
      item_variant: size || String(sku || '').trim(),
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
      });
  }

  function cartValue(cart) {
    return roundMoney(itemsFromCart(cart).reduce(function (total, item) {
      return total + (Number(item.price || 0) * Number(item.quantity || 0));
    }, 0));
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
    sendEvent(name, params);
  }

  function findCartItem(cart, productId) {
    var items = cart && Array.isArray(cart.items) ? cart.items : [];
    var matches = items.filter(function (item) {
      return Number(item && item.id) === Number(productId);
    });
    return matches[matches.length - 1] || items[items.length - 1] || null;
  }

  function sendEvent(name, params) {
    logDebug(name, params);
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  }

  var api = {
    measurementId: MEASUREMENT_ID,
    itemIdContract: ITEM_ID_CONTRACT,
    parentSku: parentSkuFromSku,
    itemId: itemIdFromSku,
    event: function () {},
    viewItem: function () {},
    addToCart: function () {},
    beginCheckout: function () {},
    viewItemList: function () {},
    selectItem: function () {},
    viewCart: function () {},
    removeFromCart: function () {},
    addShippingInfo: function () {},
    addPaymentInfo: function () {},
    search: function () {},
    login: function () {},
    signUp: function () {},
    contact: function () {},
    subscribe: function () {},
    purchase: function () {}
  };

  if (!isProductionHost()) {
    if (debugEnabled()) {
      api.event = function (name, params) { logDebug(name, params); };
      api.viewItem = function (product, variation) {
        logDebug('view_item', { items: [itemFromProduct(product, variation, 1)] });
      };
      api.addToCart = function (product, variation, cart, productId) {
        var item = findCartItem(cart, productId);
        logDebug('add_to_cart', {
          items: item ? [itemFromCartItem(item, cart && cart.totals)] : [itemFromProduct(product, variation, 1)]
        });
      };
      api.beginCheckout = function (cart) {
        logDebug('begin_checkout', { items: itemsFromCart(cart), value: cartValue(cart) });
      };
      api.purchase = function (payload) {
        logDebug('purchase', payload || {});
      };
    }
    window.hfGa4 = api;
    return;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, {
    anonymize_ip: true,
    currency: 'ARS'
  });

  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    document.head.appendChild(script);
  }

  api.event = sendEvent;

  api.viewItem = function (product, variation) {
    var item = itemFromProduct(product, variation, 1);
    if (!item.item_id) return;
    sendEvent('view_item', {
      currency: 'ARS',
      value: item.price,
      items: [item]
    });
  };

  api.addToCart = function (product, variation, cart, productId) {
    var cartItem = findCartItem(cart, productId);
    var item = cartItem
      ? itemFromCartItem(cartItem, cart && cart.totals)
      : itemFromProduct(product, variation, 1);
    if (!item.item_id) return;
    sendEvent('add_to_cart', {
      currency: currencyCode(cart && cart.totals) || 'ARS',
      value: roundMoney(item.price * item.quantity),
      items: [item]
    });
  };

  api.beginCheckout = function (cart) {
    var items = itemsFromCart(cart);
    if (!items.length) return;
    sendOnce('checkout:' + cartSignature(cart), 'begin_checkout', {
      currency: currencyCode(cart && cart.totals) || 'ARS',
      value: cartValue(cart),
      items: items
    });
  };

  api.viewItemList = function (products, listName) {
    var items = (Array.isArray(products) ? products : [])
      .map(function (product, index) {
        var item = itemFromProduct(product, null, 1);
        item.index = index;
        item.item_list_name = String(listName || 'Productos');
        return item;
      })
      .filter(function (item) { return item.item_id; });
    if (!items.length) return;
    sendOnce('list:' + String(listName || '') + ':' + items.map(function (item) { return item.item_id; }).join(','), 'view_item_list', {
      currency: 'ARS',
      item_list_name: String(listName || 'Productos'),
      items: items
    });
  };

  api.selectItem = function (product, listName) {
    var item = itemFromProduct(product, null, 1);
    if (!item.item_id) return;
    item.item_list_name = String(listName || 'Productos');
    sendEvent('select_item', {
      item_list_name: item.item_list_name,
      items: [item]
    });
  };

  api.viewCart = function (cart) {
    var items = itemsFromCart(cart);
    if (!items.length) return;
    sendEvent('view_cart', {
      currency: currencyCode(cart && cart.totals) || 'ARS',
      value: cartValue(cart),
      items: items
    });
  };

  api.removeFromCart = function (item, cart) {
    if (!item) return;
    var ga4Item = itemFromCartItem(item, cart && cart.totals);
    sendEvent('remove_from_cart', {
      currency: currencyCode(cart && cart.totals) || 'ARS',
      value: roundMoney(ga4Item.price * ga4Item.quantity),
      items: [ga4Item]
    });
  };

  api.addShippingInfo = function (cart) {
    var items = itemsFromCart(cart);
    if (!items.length) return;
    sendOnce('shipping:' + cartSignature(cart), 'add_shipping_info', {
      currency: currencyCode(cart && cart.totals) || 'ARS',
      value: cartValue(cart),
      items: items
    });
  };

  api.addPaymentInfo = function (cart, method) {
    var items = itemsFromCart(cart);
    if (!items.length) return;
    sendOnce('payment:' + String(method || '') + ':' + cartSignature(cart), 'add_payment_info', {
      currency: currencyCode(cart && cart.totals) || 'ARS',
      value: cartValue(cart),
      payment_type: String(method || ''),
      items: items
    });
  };

  api.search = function (query, resultsCount) {
    var term = String(query || '').trim();
    if (term) sendEvent('search', { search_term: term, result_count: Number(resultsCount || 0) });
  };

  api.login = function () { sendOnce('login', 'login', { method: 'wordpress' }); };
  api.signUp = function (reference) {
    sendOnce('registration:' + String(reference || 'checkout'), 'sign_up', { method: 'checkout' });
  };
  api.contact = function (channel, placement) {
    sendEvent('generate_lead', {
      method: String(channel || 'contact'),
      lead_source: String(placement || 'storefront')
    });
  };
  api.subscribe = function (source) {
    sendEvent('generate_lead', {
      method: 'newsletter',
      lead_source: String(source || 'footer')
    });
  };

  api.purchase = function (payload) {
    payload = payload || {};
    var orderId = payload.orderId;
    if (!orderId) return;
    var storageKey = PURCHASE_STORAGE_PREFIX + orderId;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch (error) {
      // Continue: a duplicate purchase on storage failure is better than dropping the conversion.
    }

    var cart = payload.order || (payload.snapshot && payload.snapshot.cart) || {};
    var summaryTotals = payload.orderSummary && payload.orderSummary.totals;
    var currency = summaryTotals || cart.totals || { currency_code: 'ARS', currency_minor_unit: 2 };
    var items = itemsFromCart(cart);
    var value = roundMoney(toMajor(
      (summaryTotals && summaryTotals.total_price) || (cart.totals && cart.totals.total_price) || 0,
      currency
    ));
    sendEvent('purchase', {
      transaction_id: String(payload.orderNumber || orderId),
      currency: currencyCode(currency),
      value: value,
      items: items
    });
  };

  window.hfGa4 = api;
})(window, document);
