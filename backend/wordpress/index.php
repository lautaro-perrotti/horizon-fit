<?php
/**
 * Front to the WordPress application. This file doesn't do anything, but loads
 * wp-blog-header.php which does and tells WordPress to load the theme.
 *
 * @package WordPress
 */

// HORIZON FIT: Redirect root to wp-admin BEFORE anything loads
$request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
$query_string = isset($_SERVER['QUERY_STRING']) ? $_SERVER['QUERY_STRING'] : '';
$path_only = explode('?', $request_uri)[0];

// Debug log
error_log("DEBUG: REQUEST_URI=[$request_uri] PATH=[$path_only] QUERY=[$query_string]");

// Redirect if root (/, empty, or just query string)
if ( $path_only === '/' || $path_only === '' ) {
	error_log("DEBUG: REDIRECTING TO /wp-admin/");
	header( 'Location: /wp-admin/', true, 301 );
	exit;
}

/**
 * Tells WordPress to load the WordPress theme and output it.
 *
 * @var bool
 */
define( 'WP_USE_THEMES', true );

/** Loads the WordPress Environment and Template */
require __DIR__ . '/wp-blog-header.php';
