<?php
/**
 * Páginas de información (links del footer) con contenido HTML editable.
 * Lista fija de páginas (ayuda + legales). Cada una: título + HTML.
 * Se guarda en la option `hf_info_pages` y se cachea en info-pages.json,
 * que el page-builder lee para rellenar el cuerpo de cada página.
 */

if (!defined('ABSPATH')) {
    exit;
}

// Lista fija de páginas: slug => [title, description]. El content lo carga el
// usuario desde el panel. El slug es también la ruta del SPA (/slug/).
function hf_info_pages_defaults() {
    return [
        'envios-y-entregas'     => ['title' => 'Envíos y entregas',      'description' => 'Información de envíos y entregas de Horizon Fit.'],
        'cambios-y-devoluciones'=> ['title' => 'Cambios y devoluciones', 'description' => 'Información de cambios y devoluciones de Horizon Fit.'],
        'guia-de-talles'        => ['title' => 'Guía de talles',         'description' => 'Guía de talles de Horizon Fit.'],
        'medios-de-pago'        => ['title' => 'Medios de pago',         'description' => 'Información de medios de pago de Horizon Fit.'],
        'terminos'              => ['title' => 'Términos y condiciones',  'description' => 'Términos y condiciones de Horizon Fit.'],
        'privacidad'            => ['title' => 'Política de privacidad',  'description' => 'Política de privacidad de Horizon Fit.'],
        'defensa-al-consumidor' => ['title' => 'Defensa al consumidor',   'description' => 'Información de defensa al consumidor de Horizon Fit.'],
    ];
}

// Devuelve las páginas con su contenido guardado mezclado con los defaults.
// Estructura: slug => ['title', 'description', 'content'].
function hf_info_pages_get() {
    $defaults = hf_info_pages_defaults();
    $saved = get_option('hf_info_pages', []);
    $saved = is_array($saved) ? $saved : [];

    $out = [];
    foreach ($defaults as $slug => $def) {
        $s = isset($saved[$slug]) && is_array($saved[$slug]) ? $saved[$slug] : [];
        $out[$slug] = [
            'title'       => ($s['title'] ?? '') !== '' ? $s['title'] : $def['title'],
            'description' => $def['description'],
            'content'     => $s['content'] ?? '',
        ];
    }
    return $out;
}

// Genera /uploads/horizon-fit-cache/info-pages.json con formato
// { "/slug": { title, description, content } } (la clave incluye la barra
// inicial para que matchee el path del page-builder).
function hf_regenerate_info_pages_cache() {
    if (!function_exists('hf_featured_products_cache_path')) {
        return;
    }
    $pages = hf_info_pages_get();
    $data = [];
    foreach ($pages as $slug => $page) {
        $data['/' . $slug] = $page;
    }
    $cache_file = dirname(hf_featured_products_cache_path()) . '/info-pages.json';
    hf_featured_products_write_cache($cache_file, $data);
}

// Asegurar que el JSON exista al arrancar (con los defaults si nunca se guardó).
add_action('init', function () {
    if (function_exists('hf_featured_products_cache_path')) {
        $cache_file = dirname(hf_featured_products_cache_path()) . '/info-pages.json';
        if (!file_exists($cache_file)) {
            hf_regenerate_info_pages_cache();
        }
    }
}, 25);
