<?php
if (! defined('ABSPATH')) {
    exit;
}

function horizon_fit_blank_is_internal_request() {
    if (is_admin()) {
        return true;
    }

    if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
        return true;
    }

    if (defined('REST_REQUEST') && REST_REQUEST) {
        return true;
    }

    if (function_exists('wp_is_json_request') && wp_is_json_request()) {
        return true;
    }

    if (defined('DOING_CRON') && DOING_CRON) {
        return true;
    }

    $request_path = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
    if ($request_path === '') {
        return false;
    }

    foreach (array('wp-admin', 'wp-login.php') as $internal_path) {
        if ($request_path === $internal_path || 0 === strpos($request_path, $internal_path . '/')) {
            return true;
        }
    }

    return false;
}

function horizon_fit_blank_redirect_public_requests() {
    if (horizon_fit_blank_is_internal_request()) {
        return;
    }

    wp_safe_redirect(admin_url('/'), 302);
    exit;
}
add_action('template_redirect', 'horizon_fit_blank_redirect_public_requests', 1);
