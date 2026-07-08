<?php
/**
 * Product parent SKU helpers.
 *
 * Variable products keep full SKUs on each size variation:
 * 001-TOP-AZU-S, 001-TOP-AZU-M, 001-TOP-AZU-L.
 *
 * For admin lists, filters and integrations, the parent product should expose
 * the base SKU:
 * 001-TOP-AZU.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_product_parent_sku_is_size_token($token) {
    $token = strtoupper(trim((string) $token));
    return in_array($token, array('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'U', 'UNI', 'UNICO'), true);
}

function hf_product_parent_sku_base_from_variation_sku($sku) {
    $sku = strtoupper(trim((string) $sku));
    if ('' === $sku) {
        return '';
    }

    $segments = array_values(array_filter(array_map('trim', explode('-', $sku)), 'strlen'));
    if (count($segments) < 4) {
        return '';
    }

    $last = end($segments);
    if (!hf_product_parent_sku_is_size_token($last)) {
        return '';
    }

    array_pop($segments);
    return implode('-', $segments);
}

function hf_product_parent_sku_derive_from_variations($product) {
    if (!function_exists('wc_get_product') || !$product || !is_a($product, 'WC_Product') || !$product->is_type('variable')) {
        return '';
    }

    foreach ($product->get_children() as $variation_id) {
        $variation = wc_get_product($variation_id);
        if (!$variation) {
            continue;
        }

        $base_sku = hf_product_parent_sku_base_from_variation_sku($variation->get_sku('edit'));
        if ($base_sku) {
            return $base_sku;
        }
    }

    return '';
}

function hf_product_parent_sku_sync($product_id) {
    static $syncing = array();

    $product_id = absint($product_id);
    if (!function_exists('wc_get_product') || !$product_id || isset($syncing[$product_id])) {
        return '';
    }

    $product = wc_get_product($product_id);
    if (!$product || !$product->is_type('variable') || $product->get_sku('edit')) {
        return '';
    }

    $base_sku = hf_product_parent_sku_derive_from_variations($product);
    if (!$base_sku) {
        return '';
    }

    $syncing[$product_id] = true;

    try {
        $product->set_sku($base_sku);
        $product->save();
    } catch (Exception $e) {
        delete_post_meta($product_id, '_sku');
        $base_sku = '';
    }

    unset($syncing[$product_id]);

    return $base_sku;
}

function hf_product_parent_sku_sync_product($product_id) {
    hf_product_parent_sku_sync($product_id);
}
add_action('woocommerce_update_product', 'hf_product_parent_sku_sync_product', 30);
add_action('save_post_product', 'hf_product_parent_sku_sync_product', 30);

function hf_product_parent_sku_sync_from_variation($variation_id) {
    $parent_id = wp_get_post_parent_id($variation_id);
    if ($parent_id) {
        hf_product_parent_sku_sync($parent_id);
    }
}
add_action('woocommerce_save_product_variation', 'hf_product_parent_sku_sync_from_variation', 30);
add_action('save_post_product_variation', 'hf_product_parent_sku_sync_from_variation', 30);

function hf_product_parent_sku_display_fallback($sku, $product) {
    if (!function_exists('wc_get_product') || $sku || !$product || !is_a($product, 'WC_Product') || !$product->is_type('variable')) {
        return $sku;
    }

    $base_sku = hf_product_parent_sku_derive_from_variations($product);
    return $base_sku ?: $sku;
}
add_filter('woocommerce_product_get_sku', 'hf_product_parent_sku_display_fallback', 20, 2);

function hf_product_parent_sku_run_existing_products_migration() {
    if (!is_admin() || !function_exists('wc_get_products') || get_option('hf_parent_sku_migration_version') === '1') {
        return;
    }

    $product_ids = wc_get_products(array(
        'type'   => 'variable',
        'status' => array('publish', 'draft', 'private'),
        'limit'  => -1,
        'return' => 'ids',
    ));

    foreach ($product_ids as $product_id) {
        hf_product_parent_sku_sync($product_id);
    }

    update_option('hf_parent_sku_migration_version', '1', false);
}
add_action('admin_init', 'hf_product_parent_sku_run_existing_products_migration');
