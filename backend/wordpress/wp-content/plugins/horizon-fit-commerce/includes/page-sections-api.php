<?php
/**
 * Page Sections REST API
 * Endpoint para obtener secciones de una página ordenadas
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_register_page_sections_endpoint() {
    register_rest_route('wp/v2', '/pages/(?P<slug>[a-z0-9_-]+)/sections', [
        'methods' => 'GET',
        'callback' => 'hf_get_page_sections',
        'permission_callback' => '__return_true',
        'args' => [
            'slug' => [
                'description' => 'Page slug',
                'type' => 'string',
                'required' => true,
            ]
        ]
    ]);
}
add_action('rest_api_init', 'hf_register_page_sections_endpoint');

// Arma el array de secciones de una página (slug). Reutilizable por el
// endpoint REST y por el generador de cache estática.
function hf_build_page_sections($slug) {
    $page = get_posts([
        'post_type' => 'hf_page',
        'name' => $slug,
        'numberposts' => 1
    ]);

    if (empty($page)) {
        return null;
    }

    $page_id = $page[0]->ID;

    $sections = get_posts([
        'post_type' => 'hf_page_section',
        'meta_query' => [
            [
                'key' => '_hf_page_id',
                'value' => $page_id,
                'compare' => '='
            ]
        ],
        'numberposts' => -1,
        'orderby' => 'meta_value_num',
        'meta_key' => '_hf_section_order',
        'order' => 'ASC'
    ]);

    $formatted_sections = [];
    foreach ($sections as $section) {
        $is_visible = get_post_meta($section->ID, '_hf_section_visible', true);
        $section_type = get_post_meta($section->ID, '_hf_section_type', true);
        $section_order = get_post_meta($section->ID, '_hf_section_order', true);
        $section_settings = get_post_meta($section->ID, '_hf_section_settings', true);

        $formatted_sections[] = [
            'id' => $section->ID,
            'type' => $section_type,
            'order' => (int) $section_order,
            'visible' => (bool) $is_visible,
            'settings' => $section_settings ? json_decode($section_settings, true) : []
        ];
    }

    return $formatted_sections;
}

function hf_get_page_sections($request) {
    $slug = $request->get_param('slug');
    $sections = hf_build_page_sections($slug);

    if ($sections === null) {
        return new WP_REST_Response([
            'error' => 'Page not found',
            'slug' => $slug
        ], 404);
    }

    return new WP_REST_Response($sections);
}

// Genera una cache estática de las settings de las secciones de la home, para
// que el frontend la lea instantánea (sin el REST lento). Reusa la escritura
// atómica + CORS del módulo de cache de productos.
function hf_regenerate_sections_cache() {
    if (!function_exists('hf_featured_products_cache_path')) {
        return;
    }
    $sections = hf_build_page_sections('home');
    if ($sections === null) {
        $sections = [];
    }
    $cache_file = dirname(hf_featured_products_cache_path()) . '/home-sections.json';
    hf_featured_products_write_cache($cache_file, $sections);
}

// Regenerar la cache cuando se guarda/borra una sección desde wp-admin.
add_action('save_post_hf_page_section', 'hf_regenerate_sections_cache', 20);
add_action('deleted_post', function ($post_id) {
    if (get_post_type($post_id) === 'hf_page_section') {
        hf_regenerate_sections_cache();
    }
}, 20);