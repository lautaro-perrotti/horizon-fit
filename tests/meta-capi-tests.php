<?php
declare(strict_types=1);

define('ABSPATH', dirname(__DIR__) . '/');

class WC_Order {}
class WC_Product {}

function add_action() {}
function get_option($key, $default = array()) { return $default; }
function remove_accents($value) {
    return strtr((string) $value, array('á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u'));
}

require dirname(__DIR__) . '/backend/wordpress/wp-content/plugins/horizon-fit-commerce/includes/meta-conversions-api.php';

function hf_meta_capi_test_assert($condition, $message) {
    if (! $condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

hf_meta_capi_test_assert(
    hf_meta_capi_hash(' Lautaro@Example.COM ') === hash('sha256', 'lautaro@example.com'),
    'email normalization must be lowercase and whitespace-free'
);
hf_meta_capi_test_assert(
    hf_meta_capi_hash('+54 9 11 1234-5678', 'phone') === hash('sha256', '5491112345678'),
    'phone normalization must keep digits only'
);
hf_meta_capi_test_assert(hf_meta_capi_hash('') === '', 'empty values must not be sent');
hf_meta_capi_test_assert(
    ! hf_meta_capi_is_configured(),
    'CAPI must remain disabled when the token is absent'
);

echo "OK meta-capi-tests\n";

