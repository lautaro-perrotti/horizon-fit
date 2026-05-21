<?php
/**
 * Hero Settings Endpoint
 * Configuración del video hero (video principal de la página)
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register REST endpoint for Hero Settings
 */
function hf_register_hero_settings_endpoint() {
    register_rest_route('wp/v2', '/settings/hero', [
        [
            'methods'             => 'GET',
            'callback'            => 'hf_get_hero_settings',
            'permission_callback' => '__return_true',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'hf_update_hero_settings',
            'permission_callback' => function() {
                return current_user_can('manage_options');
            },
        ],
    ]);
}
add_action('rest_api_init', 'hf_register_hero_settings_endpoint');

function hf_get_hero_settings() {
    return [
        'video_mobile'    => get_option('hf_hero_video_mobile', ''),
        'video_desktop'   => get_option('hf_hero_video_desktop', ''),
        'title'           => get_option('hf_hero_title', ''),
        'subtitle'        => get_option('hf_hero_subtitle', ''),
        'button1_text'    => get_option('hf_hero_button1_text', ''),
        'button1_url'     => get_option('hf_hero_button1_url', ''),
        'button2_text'    => get_option('hf_hero_button2_text', ''),
        'button2_url'     => get_option('hf_hero_button2_url', ''),
    ];
}

function hf_update_hero_settings($request) {
    if (!current_user_can('manage_options')) {
        return new WP_Error('forbidden', 'No tienes permisos', ['status' => 403]);
    }

    $params = $request->get_json_params();

    if (isset($params['video_mobile'])) {
        update_option('hf_hero_video_mobile', esc_url($params['video_mobile']));
    }
    if (isset($params['video_desktop'])) {
        update_option('hf_hero_video_desktop', esc_url($params['video_desktop']));
    }
    if (isset($params['title'])) {
        update_option('hf_hero_title', sanitize_text_field($params['title']));
    }
    if (isset($params['subtitle'])) {
        update_option('hf_hero_subtitle', sanitize_text_field($params['subtitle']));
    }
    if (isset($params['button1_text'])) {
        update_option('hf_hero_button1_text', sanitize_text_field($params['button1_text']));
    }
    if (isset($params['button1_url'])) {
        update_option('hf_hero_button1_url', esc_url($params['button1_url']));
    }
    if (isset($params['button2_text'])) {
        update_option('hf_hero_button2_text', sanitize_text_field($params['button2_text']));
    }
    if (isset($params['button2_url'])) {
        update_option('hf_hero_button2_url', esc_url($params['button2_url']));
    }

    return hf_get_hero_settings();
}
