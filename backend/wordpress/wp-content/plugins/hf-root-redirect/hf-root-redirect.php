<?php
/**
 * Plugin Name: Horizon Fit Root Redirect
 * Description: Redirect WordPress root (/) to /wp-admin/
 * Version: 1.0.0
 */

// Redirect root to wp-admin
add_action('init', function() {
	if ( $_SERVER['REQUEST_URI'] === '/' ) {
		wp_safe_redirect('/wp-admin/', 301);
		exit;
	}
}, 0);
