<?php
if (! defined('ABSPATH')) {
    exit;
}

if (! function_exists('horizon_fit_blank_is_internal_request')) {
    wp_safe_redirect(admin_url('/'), 302);
    exit;
}

if (! horizon_fit_blank_is_internal_request()) {
    wp_safe_redirect(admin_url('/'), 302);
    exit;
}
