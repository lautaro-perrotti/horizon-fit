<?php
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
$GLOBALS['hf_filters'] = array();
function add_action() {}
function add_filter($tag, $fn, $priority = 10, $accepted = 1) { $GLOBALS['hf_filters'][$tag][] = $fn; }
function apply_filters($tag, $value, ...$args) {
    foreach ($GLOBALS['hf_filters'][$tag] ?? array() as $fn) {
        $value = $fn($value, ...$args);
    }
    return $value;
}
function wp_strip_all_tags($value) { return strip_tags((string) $value); }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_attr($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function check($condition, $message) { if (!$condition) { fwrite(STDERR, 'FAIL ' . $message . "\n"); exit(1); } }
if (!class_exists('WC_Product')) {
    class WC_Product {
        public function get_name() { return 'Top Liso'; }
        public function get_description() { return 'Descubrí Top Liso de Horizon Fit: una prenda de activewear cómoda y funcional para entrenar, combinar con tu set y acompañarte todos los días en cada movimiento.'; }
        public function get_short_description() { return ''; }
        public function get_slug() { return 'top-liso'; }
        public function get_id() { return 9; }
        public function get_sku() { return 'TOP-1'; }
        public function is_type($type = '') { return false; }
        public function get_regular_price() { return '100'; }
        public function get_price() { return '100'; }
        public function get_sale_price() { return ''; }
        public function get_attributes() { return array(); }
        public function get_attribute($key) { return ''; }
    }
}
$dir = sys_get_temp_dir() . '/hf-search-' . bin2hex(random_bytes(5));
mkdir($dir);
file_put_contents($dir . '/store.json', json_encode(array(
    'name' => 'Casa Sur',
    'storefrontUrl' => 'https://casasur.example',
    'seo' => array('title' => 'Casa Sur | Tienda online', 'description' => 'Colección Casa Sur.'),
    'merchant' => array('ownBrandManufacturer' => false),
)));
putenv('HF_FRAMEWORK_CONFIG_FILE=' . $dir . '/store.json');
require __DIR__ . '/../backend/wordpress/wp-content/mu-plugins/00-horizon-framework.php';
require __DIR__ . '/../backend/wordpress/wp-content/mu-plugins/horizon-fit-search-commerce.php';

$product = new WC_Product();
$title = hf_search_product_title($product);
$meta = hf_search_product_meta_description($product);
$url = hf_search_public_product_url($product->get_slug());
$category = (object) array('slug' => 'tops', 'name' => 'Tops', 'description' => 'Tops de Horizon Fit en https://horizonfit.com.ar/coleccion/tops/');
$notes = hf_merchant_catalog_notes();

check($title === 'Top Liso | Casa Sur', 'search title uses store brand');
check(!str_contains($title, 'Horizon Fit'), 'search title has no Horizon Fit');
check(str_contains($meta, 'Casa Sur') && !str_contains($meta, 'Horizon Fit'), 'search meta replaces client brand');
check($url === 'https://casasur.example/producto/top-liso/', 'product permalink uses store origin');
check(!str_contains($url, 'horizonfit'), 'product permalink has no client host');
check(hf_search_category_title($category) === 'Tops Deportivos para Mujer | Casa Sur', 'category title uses store brand');
check(!str_contains(hf_search_category_description($category), 'Horizon Fit') && !str_contains(hf_search_category_description($category), 'horizonfit'), 'category copy drops client brand and host');
check(str_contains($notes['search_titles'], 'Casa Sur') && !str_contains(json_encode($notes), 'Horizon Fit'), 'merchant notes use store brand');
check(hf_merchant_unique_mpn('TOP-1', $product) === '', 'SKU is not MPN unless ownBrandManufacturer');
check(hf_merchant_identifier_exists('Casa Sur', '', '') === '', 'brand without MPN does not force identifier_exists=no');

unlink($dir . '/store.json');
rmdir($dir);
echo "OK search/Merchant copy uses the store brand, origin and manufacturer flag\n";
