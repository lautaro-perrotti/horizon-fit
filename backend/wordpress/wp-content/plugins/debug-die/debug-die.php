<?php
/*
Plugin Name: Debug Die
Description: Log wp_die calls to find out who is calling it.
Version: 1.0
Author: Me
*/

add_filter('wp_die_handler', function($handler) {
    return function($message, $title, $args) use ($handler) {
        $log = date('Y-m-d H:i:s') . "\n";
        $log .= "Message: " . (is_string($message) ? $message : wp_json_encode($message)) . "\n";
        
        $e = new Exception();
        $log .= "Trace:\n" . $e->getTraceAsString() . "\n\n";
        
        file_put_contents('/var/www/html/wp-content/plugins/wp_die_log.txt', $log, FILE_APPEND);
        
        // Output the original handler for actual functionality
        if ( is_callable( $handler ) ) {
            call_user_func( $handler, $message, $title, $args );
        } else {
            _default_wp_die_handler($message, $title, $args);
        }
        die();
    };
}, 999);
