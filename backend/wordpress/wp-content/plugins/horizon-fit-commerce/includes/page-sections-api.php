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

function hf_get_page_sections($request) {
    $slug = $request->get_param('slug');

    // Obtener la página por slug
    $page = get_posts([
        'post_type' => 'hf_page',
        'name' => $slug,
        'numberposts' => 1
    ]);

    if (empty($page)) {
        return new WP_REST_Response([
            'error' => 'Page not found',
            'slug' => $slug
        ], 404);
    }

    $page_id = $page[0]->ID;

    // Obtener todas las secciones de esta página, ordenadas por orden
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

    // Formatear respuesta
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

    return new WP_REST_Response($formatted_sections);
}
