<?php
add_filter('wp_die_handler', function($handler) {
    return function($message, $title, $args) {
        $log = date('Y-m-d H:i:s') . "\n";
        $log .= "Message: " . (is_string($message) ? $message : wp_json_encode($message)) . "\n";
        $log .= "Trace:\n" . (new Exception())->getTraceAsString() . "\n\n";
        file_put_contents('/var/www/html/wp-content/plugins/wp_die_log.txt', $log, FILE_APPEND);
        
        // Call the default handler
        _default_wp_die_handler($message, $title, $args);
    };
});
