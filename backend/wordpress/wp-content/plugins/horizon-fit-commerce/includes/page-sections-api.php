<?php
/**
 * Page Sections REST API
 * Endpoint para obtener secciones de una página ordenadas
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register REST endpoint para obtener secciones de una página
 * GET /wp-json/wp/v2/pages/{slug}/sections
 */
function hf_register_page_sections_endpoint() {
    register_rest_route('wp/v2', '/pages/(?P<slug>[a-z0-9_-]+)/sections', [
        'methods' => 'GET',
        'callback' => 'hf_get_page_sections',
        'permission_callback' => '__return_true',
        'args' => [
            'slug' => [
                'description' => 'Page slug (home, collections, product, checkout)',
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
        'meta_key' => '_hf_page_slug',
        'meta_value' => $slug,
        'numberposts' => 1
    ]);

    if (empty($page)) {
        return new WP_REST_Response([
            'error' => 'Page not found',
            'slug' => $slug
        ], 404);
    }

    $page_id = $page[0]->ID;

    // Obtener todas las secciones de esta página
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

        // Obtener configuración específica según tipo de sección
        $settings = [];
        if ($section_type === 'marquee') {
            // Marquee usa configuración global
            $settings = [
                'messages' => json_decode(get_option('hf_marquee_messages', '[]'), true),
                'speed' => (int) get_option('hf_marquee_speed', 20)
            ];
        } elseif ($section_type === 'hero') {
            // Hero usa configuración global
            $settings = [
                'video_mobile' => get_option('hf_hero_video_mobile', ''),
                'video_desktop' => get_option('hf_hero_video_desktop', ''),
                'title' => get_option('hf_hero_title', ''),
                'subtitle' => get_option('hf_hero_subtitle', ''),
                'button1_text' => get_option('hf_hero_button1_text', ''),
                'button1_url' => get_option('hf_hero_button1_url', ''),
                'button2_text' => get_option('hf_hero_button2_text', ''),
                'button2_url' => get_option('hf_hero_button2_url', '')
            ];
        } else {
            // Otras secciones usan su propia configuración JSON
            $settings = $section_settings ? json_decode($section_settings, true) : [];
        }

        $formatted_sections[] = [
            'id' => $section->ID,
            'type' => $section_type,
            'order' => (int) $section_order,
            'visible' => (bool) $is_visible,
            'settings' => $settings
        ];
    }

    return new WP_REST_Response($formatted_sections);
}
