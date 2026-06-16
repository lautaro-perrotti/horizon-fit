<?php
if (! defined('ABSPATH')) {
    exit;
}

// Tema minimalista - el frontend real está en index.html
// Este tema solo maneja el panel de admin de WordPress

add_theme_support('title-tag');
add_theme_support('post-thumbnails');
add_theme_support('woocommerce');
add_theme_support('wc-product-gallery-lightbox');
add_theme_support('wc-product-gallery-slider');
add_theme_support('wc-product-gallery-zoom');

function horizon_fit_blank_enqueue_assets() {
    wp_enqueue_style(
        'horizon-fit-blank',
        get_template_directory_uri() . '/style.css',
        array(),
        '1.0.0'
    );
}
add_action('wp_enqueue_scripts', 'horizon_fit_blank_enqueue_assets');

function horizon_fit_blank_document_title($title) {
    if (function_exists('is_account_page') && is_account_page()) {
        return 'Mi cuenta | Horizon Fit';
    }

    if (function_exists('is_checkout') && is_checkout()) {
        return 'Checkout | Horizon Fit';
    }

    if (function_exists('is_cart') && is_cart()) {
        return 'Carrito | Horizon Fit';
    }

    return $title;
}
add_filter('pre_get_document_title', 'horizon_fit_blank_document_title');

// Habilitar REST API pública para WooCommerce
// Permitir GET requests a productos y taxonomías sin autenticación
add_filter('woocommerce_rest_product_schema', function($schema) {
    return $schema;
});

// Permitir acceso público a endpoints de lectura
add_filter('rest_authentication_errors', function($result) {
    if (!empty($result)) {
        // Si ya hay error de autenticación, permitirlo en GET
        if ('GET' === $_SERVER['REQUEST_METHOD']) {
            return true;
        }
    }
    return $result;
});
