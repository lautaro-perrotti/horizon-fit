<?php
/**
 * Orden y visibilidad de las secciones del cuerpo de la home.
 * El page-builder lee home.json (estático) y aplica este override
 * (home-layout.json) para reordenar/ocultar sin tocar código.
 * Solo las secciones del cuerpo; marquee/navbar/footer/whatsapp son fijas.
 */

if (!defined('ABSPATH')) {
    exit;
}

// Secciones reordenables: id (de home.json) => [label, order por defecto].
// El orden por defecto respeta el de home.json.
function hf_home_layout_defaults() {
    return [
        'featured-products'      => ['label' => 'Productos destacados (fila 1)', 'order' => 4],
        'featured-products-2'    => ['label' => 'Productos destacados (fila 2)', 'order' => 5],
        'featured-sets-desktop'  => ['label' => 'Conjuntos destacados (desktop)', 'order' => 6],
        'featured-sets-mobile'   => ['label' => 'Conjuntos destacados (mobile)',  'order' => 7],
        'categorias'             => ['label' => 'Compra por categoría',           'order' => 8],
        'trust-bar'              => ['label' => 'Barra de confianza',             'order' => 9],
        'style-edit'             => ['label' => 'Elegí tu estilo',               'order' => 10],
        'social-strip'           => ['label' => '#HorizonFit (redes)',            'order' => 11],
    ];
}

// Devuelve el layout guardado mezclado con defaults: id => [label, order, visible].
function hf_home_layout_get() {
    $defaults = hf_home_layout_defaults();
    $saved = get_option('hf_home_layout', []);
    $saved = is_array($saved) ? $saved : [];

    $out = [];
    foreach ($defaults as $id => $def) {
        $s = isset($saved[$id]) && is_array($saved[$id]) ? $saved[$id] : [];
        $out[$id] = [
            'label'   => $def['label'],
            'order'   => isset($s['order']) ? (int) $s['order'] : $def['order'],
            'visible' => isset($s['visible']) ? (bool) $s['visible'] : true,
        ];
    }
    return $out;
}

// Genera /uploads/horizon-fit-cache/home-layout.json como array
// [{ id, order, visible }] (solo lo que el page-builder necesita).
function hf_regenerate_home_layout_cache() {
    if (!function_exists('hf_featured_products_cache_path')) {
        return;
    }
    $layout = hf_home_layout_get();
    $data = [];
    foreach ($layout as $id => $row) {
        $data[] = ['id' => $id, 'order' => $row['order'], 'visible' => $row['visible']];
    }
    $cache_file = dirname(hf_featured_products_cache_path()) . '/home-layout.json';
    hf_featured_products_write_cache($cache_file, $data);
}

// Asegurar que el JSON exista al arrancar (con defaults si nunca se guardó).
add_action('init', function () {
    if (function_exists('hf_featured_products_cache_path')) {
        $cache_file = dirname(hf_featured_products_cache_path()) . '/home-layout.json';
        if (!file_exists($cache_file)) {
            hf_regenerate_home_layout_cache();
        }
    }
}, 25);
