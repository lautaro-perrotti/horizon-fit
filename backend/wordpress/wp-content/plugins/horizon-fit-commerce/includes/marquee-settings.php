<?php
/**
 * Marquee Settings Endpoint
 * Configuración del marquee (banner superior con texto móvil)
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register REST endpoint for Marquee Settings
 */
function hf_register_marquee_settings_endpoint() {
    register_rest_route('wp/v2', '/settings/marquee', [
        [
            'methods'             => 'GET',
            'callback'            => 'hf_get_marquee_settings',
            'permission_callback' => '__return_true',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'hf_update_marquee_settings',
            'permission_callback' => function() {
                return current_user_can('manage_options');
            },
        ],
    ]);
}
add_action('rest_api_init', 'hf_register_marquee_settings_endpoint');

function hf_get_marquee_settings() {
    return [
        'text'  => get_option('hf_marquee_text', '3 y 6 cuotas sin interés'),
        'speed' => (int) get_option('hf_marquee_speed', 20),
    ];
}

function hf_update_marquee_settings($request) {
    if (!current_user_can('manage_options')) {
        return new WP_Error('forbidden', 'No tienes permisos', ['status' => 403]);
    }

    $params = $request->get_json_params();

    if (isset($params['text'])) {
        update_option('hf_marquee_text', sanitize_text_field($params['text']));
    }
    if (isset($params['speed'])) {
        update_option('hf_marquee_speed', (int) $params['speed']);
    }

    return hf_get_marquee_settings();
}
