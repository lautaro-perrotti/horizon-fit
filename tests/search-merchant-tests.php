<?php
declare(strict_types=1);

define('ABSPATH', __DIR__ . '/../');
define('WP_CONTENT_DIR', __DIR__ . '/../backend/wordpress/wp-content');

if (! class_exists('WC_Product')) {
    class WC_Product {}
}

if (! function_exists('wp_strip_all_tags')) {
    function wp_strip_all_tags($value) { return strip_tags((string) $value); }
}
if (! function_exists('get_option')) {
    function get_option($key, $default = false) { return $GLOBALS['hf_test_options'][$key] ?? $default; }
}
if (! function_exists('apply_filters')) {
    function apply_filters($tag, $value, ...$args) { return $value; }
}
if (! function_exists('sanitize_title')) {
    function sanitize_title($value) {
        $value = strtolower(trim((string) $value));
        $value = str_replace(array('á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'), array('a', 'e', 'i', 'o', 'u', 'u', 'n'), $value);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $value), '-');
    }
}
if (! function_exists('is_wp_error')) {
    function is_wp_error($value) { return false; }
}
if (! function_exists('taxonomy_exists')) {
    function taxonomy_exists($taxonomy) { return true; }
}
if (! function_exists('get_term_by')) {
    function get_term_by($field, $value, $taxonomy) {
        return (object) array('name' => ucfirst(str_replace('-', ' ', (string) $value)), 'slug' => (string) $value, 'term_id' => 0);
    }
}
if (! function_exists('get_term')) {
    function get_term($id, $taxonomy) { return $GLOBALS['hf_test_terms_by_id'][$id] ?? null; }
}
if (! function_exists('get_ancestors')) {
    function get_ancestors($id, $taxonomy) { return array(); }
}
if (! function_exists('wp_get_post_terms')) {
    function wp_get_post_terms($id, $taxonomy) { return $GLOBALS['hf_test_product_terms'][$id] ?? array(); }
}
if (! function_exists('wp_get_attachment_image_url')) {
    function wp_get_attachment_image_url($id, $size) { return $id ? 'https://cdn.test/image-' . $id . '.jpg' : ''; }
}
if (! function_exists('get_woocommerce_currency')) {
    function get_woocommerce_currency() { return 'ARS'; }
}
if (! function_exists('wc_format_decimal')) {
    function wc_format_decimal($value, $decimals = 2) { return number_format((float) $value, (int) $decimals, '.', ''); }
}
if (! function_exists('wp_json_encode')) {
    function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
}
if (! function_exists('trailingslashit')) {
    function trailingslashit($value) { return rtrim((string) $value, '/\\') . '/'; }
}
if (! function_exists('untrailingslashit')) {
    function untrailingslashit($value) { return rtrim((string) $value, '/'); }
}
if (! function_exists('wp_upload_dir')) {
    function wp_upload_dir() { return array('basedir' => sys_get_temp_dir()); }
}
if (! function_exists('wp_mkdir_p')) {
    function wp_mkdir_p($dir) { return is_dir($dir) || mkdir($dir, 0777, true); }
}
if (! function_exists('add_action')) {
    function add_action() {}
}
if (! function_exists('esc_html')) {
    function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
}
if (! function_exists('esc_attr')) {
    function esc_attr($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
}
if (! function_exists('wc_get_product')) {
    function wc_get_product($id) { return $GLOBALS['hf_test_products'][$id] ?? null; }
}

if (! function_exists('hf_product_parent_sku_base_from_variation_sku')) {
    function hf_product_parent_sku_base_from_variation_sku($sku) {
        $sku = strtoupper(trim((string) $sku));
        $segments = array_values(array_filter(array_map('trim', explode('-', $sku)), 'strlen'));
        if (count($segments) < 4) {
            return '';
        }
        $last = end($segments);
        if (! in_array($last, array('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'U', 'UNI', 'UNICO'), true)) {
            return '';
        }
        array_pop($segments);
        return implode('-', $segments);
    }
}

require_once __DIR__ . '/../backend/wordpress/wp-content/mu-plugins/horizon-fit-search-commerce.php';

final class HF_Test_Product extends WC_Product {
    private array $data;

    public function __construct(array $data) {
        $this->data = $data + array(
            'id' => 1,
            'name' => 'Top liso azul',
            'slug' => 'top-liso-azul',
            'sku' => '001-TOP-AZU-S',
            'type' => 'simple',
            'status' => 'publish',
            'children' => array(),
            'attributes' => array(),
            'image_id' => 10,
            'gallery' => array(),
            'price' => '67000',
            'regular_price' => '67000',
            'sale_price' => '',
            'description' => 'Top deportivo de calce cómodo para entrenar y usar todos los días, con soporte suave, diseño versátil y terminación pensada para acompañar el movimiento.',
            'short_description' => '',
            'stock_status' => 'instock',
            'managing_stock' => false,
            'stock_quantity' => null,
            'gtin' => '',
        );
    }

    public function get_id() { return $this->data['id']; }
    public function get_name() { return $this->data['name']; }
    public function get_slug() { return $this->data['slug']; }
    public function get_sku($context = 'view') { return $this->data['sku']; }
    public function is_type($type) { return $this->data['type'] === $type; }
    public function get_status() { return $this->data['status']; }
    public function get_children() { return $this->data['children']; }
    public function get_attribute($key) {
        if (isset($this->data['attributes'][$key])) {
            return $this->data['attributes'][$key];
        }
        foreach ($this->data['attributes'] as $name => $value) {
            if (strcasecmp((string) $name, (string) $key) === 0) {
                return $value;
            }
        }
        return '';
    }
    public function get_image_id() { return $this->data['image_id']; }
    public function get_gallery_image_ids() { return $this->data['gallery']; }
    public function get_price() { return $this->data['price']; }
    public function get_regular_price() { return $this->data['regular_price']; }
    public function get_sale_price() { return $this->data['sale_price']; }
    public function get_description() { return $this->data['description']; }
    public function get_short_description() { return $this->data['short_description']; }
    public function get_stock_status() { return $this->data['stock_status']; }
    public function managing_stock() { return $this->data['managing_stock']; }
    public function get_stock_quantity() { return $this->data['stock_quantity']; }
    public function get_global_unique_id() { return $this->data['gtin']; }
}

function hf_test_term(string $slug, string $name, int $id = 1): object {
    return (object) array('slug' => $slug, 'name' => $name, 'term_id' => $id);
}

function hf_test_assert($condition, string $message): void {
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function hf_test_issue_codes(array $item): array {
    return array_map(static fn($issue) => $issue['code'] ?? '', $item['issues'] ?? array());
}

$GLOBALS['hf_test_product_terms'] = array();
$GLOBALS['hf_test_products'] = array();

$product = new HF_Test_Product(array('id' => 10, 'name' => 'Top Zenith wine', 'slug' => 'top-zenith-wine'));
$GLOBALS['hf_test_product_terms'][10] = array(hf_test_term('tops', 'Tops'));

hf_test_assert(hf_search_strlen(hf_search_product_title($product)) <= 65, 'El title debe respetar límite.');
hf_test_assert(! hf_search_contains(hf_search_product_title($product), 'para Mujer'), 'Search title no debe agregar para Mujer.');
hf_test_assert(hf_search_strlen(hf_search_product_description($product)) <= 158, 'La meta description debe respetar límite corto.');
hf_test_assert(hf_search_product_description($product) === hf_search_product_meta_description($product), 'description debe delegar a meta description.');
hf_test_assert(hf_merchant_detect_color_from_text('Top Zenith wine') === 'Bordeaux', 'Debe detectar wine como Bordeaux.');

$parent = new HF_Test_Product(array(
    'id' => 20,
    'name' => 'Top liso azul',
    'slug' => 'top-liso-azul',
    'sku' => '001-TOP-AZU',
    'type' => 'variable',
    'children' => array(21, 22),
));
$variation = new HF_Test_Product(array(
    'id' => 21,
    'sku' => '001-TOP-AZU-S',
    'type' => 'variation',
    'attributes' => array('pa_talle' => 'S', 'pa_color' => 'Azul'),
));
$GLOBALS['hf_test_products'][21] = $variation;
$GLOBALS['hf_test_product_terms'][20] = array(hf_test_term('tops', 'Tops'));
$row = hf_merchant_row($variation, $parent);
hf_test_assert($row['data']['size'] === 'S', 'Debe detectar talle de variante.');
hf_test_assert($row['data']['color'] === 'Azul', 'Debe detectar color de variante.');
hf_test_assert($row['data']['item_group_id'] === '001-TOP-AZU', 'Debe derivar item_group_id del padre.');
hf_test_assert($row['data']['google_product_category'] === '212', 'Tops debe mapear a categoría oficial 212.');
hf_test_assert($row['data']['identifier_exists'] === '', 'Con brand + MPN no se envía identifier_exists=no.');
hf_test_assert($row['data']['mpn'] === '001-TOP-AZU-S', 'El SKU real se usa como MPN.');
hf_test_assert($row['data']['gtin'] === '', 'Sin GTIN no se inventa GTIN.');
hf_test_assert($row['data']['size_system'] === '', 'size_system se omite; no se afirma US.');
hf_test_assert($row['data']['size_type'] === '', 'size_type regular no se envía; es el default de Google.');
hf_test_assert($row['ready'] === true, 'Variante sana debe quedar lista aunque no tenga GTIN.');
hf_test_assert(! in_array('incomplete_variant', hf_test_issue_codes($row), true), 'Variante sana no debe marcarse incompleta.');
hf_test_assert(! in_array('missing_sku', hf_test_issue_codes($row), true), 'SKU de producción no debe disparar missing_sku.');
hf_test_assert($row['data']['title'] === hf_merchant_product_title($parent, $variation), 'Merchant title debe salir de hf_merchant_product_title.');
hf_test_assert($row['data']['title'] !== hf_search_product_title($parent), 'Title Merchant no debe ser el title Search.');
hf_test_assert(hf_search_contains($row['data']['title'], 'Talle S'), 'Title Merchant debe incluir talle.');
hf_test_assert(hf_search_contains(hf_search_product_title($parent), '| Horizon Fit'), 'Title Search debe usar | Horizon Fit.');

$custom_attrs = new HF_Test_Product(array(
    'id' => 23,
    'sku' => '001-TOP-AZU-M',
    'type' => 'variation',
    'attributes' => array('Talle' => 'M', 'Color' => 'Azul'),
));
$custom_row = hf_merchant_row($custom_attrs, $parent);
hf_test_assert($custom_row['data']['size'] === 'M', 'Debe leer atributo custom Talle.');
hf_test_assert($custom_row['data']['color'] === 'Azul', 'Debe leer atributo custom Color.');
hf_test_assert($custom_row['ready'] === true, 'Atributos custom Talle/Color deben alcanzar Merchant ready.');

$english_attrs = new HF_Test_Product(array(
    'id' => 24,
    'sku' => '001-TOP-NEG-S',
    'name' => 'Top Dynamic black',
    'type' => 'variation',
    'attributes' => array('Size' => 's', 'Colour' => 'Negro'),
));
$english_parent = new HF_Test_Product(array(
    'id' => 56,
    'name' => 'Top Dynamic black',
    'slug' => 'top-liso-negro',
    'sku' => '001-TOP-NEG',
    'type' => 'variable',
));
$GLOBALS['hf_test_product_terms'][56] = array(hf_test_term('tops', 'Tops'));
$english_row = hf_merchant_row($english_attrs, $english_parent);
hf_test_assert($english_row['data']['size'] === 'S', 'Debe normalizar talle s → S.');
hf_test_assert($english_row['data']['color'] === 'Negro', 'Debe leer Colour/Size en inglés.');
hf_test_assert($english_row['ready'] === true, 'Top Dynamic black de producción debe quedar ready.');

$no_sku = new HF_Test_Product(array(
    'id' => 25,
    'sku' => '',
    'type' => 'variation',
    'attributes' => array('Talle' => 'L', 'Color' => 'Azul'),
));
$no_sku_row = hf_merchant_row($no_sku, $parent);
hf_test_assert(in_array('missing_sku', hf_test_issue_codes($no_sku_row), true), 'Sin SKU debe avisarse.');
hf_test_assert($no_sku_row['data']['id'] === 'HF-V25', 'Sin SKU debe usar ID estable.');
hf_test_assert($no_sku_row['data']['mpn'] === '', 'Sin SKU no se inventa MPN.');
hf_test_assert($no_sku_row['data']['gtin'] === '', 'Sin SKU no se inventa GTIN.');
hf_test_assert($no_sku_row['data']['identifier_exists'] !== 'no' || $no_sku_row['data']['brand'] === '', 'Con brand no corresponde identifier_exists=no.');
hf_test_assert($no_sku_row['ready'] === true, 'Sin SKU no debe bloquear si el resto está completo.');
hf_test_assert(! in_array('incomplete_variant', hf_test_issue_codes($no_sku_row), true), 'Falta de SKU no debe marcar variante incompleta.');

$falda = new HF_Test_Product(array(
    'id' => 60,
    'name' => 'Falda Zenith wine',
    'slug' => 'falda-conjunto-falda-bordo',
    'sku' => '004-FAL-BOR',
    'type' => 'variable',
    'children' => array(61),
));
$falda_var = new HF_Test_Product(array(
    'id' => 61,
    'sku' => '004-FAL-BOR-S',
    'type' => 'variation',
    'attributes' => array('Talle' => 'S', 'Color' => 'Bordeaux'),
));
$GLOBALS['hf_test_product_terms'][60] = array(hf_test_term('shorts', 'Shorts'), hf_test_term('diseno', 'Diseño'));
$falda_row = hf_merchant_row($falda_var, $falda);
hf_test_assert($falda_row['data']['google_product_category'] === '1581', 'Faldas deben mapear a 1581 aunque Woo las tenga en Shorts.');
hf_test_assert($falda_row['data']['product_type'] === 'Ropa deportiva mujer > Faldas', 'product_type de falda debe salir del SKU FAL.');
hf_test_assert($falda_row['data']['item_group_id'] === '004-FAL-BOR', 'item_group_id de falda debe ser el SKU padre.');
hf_test_assert($falda_row['data']['identifier_exists'] !== 'no', 'Falda con brand + MPN no debe mandar identifier_exists=no.');
hf_test_assert($falda_row['data']['size_system'] === '', 'Falda no debe recibir size_system=US.');
hf_test_assert($falda_row['ready'] === true, 'Falda de producción debe quedar Merchant ready.');

$gtin_base = '779123456789';
$valid_gtin = '';
for ($digit = 0; $digit <= 9; $digit++) {
    $candidate = $gtin_base . (string) $digit;
    if (hf_merchant_gtin_is_valid($candidate)) {
        $valid_gtin = $candidate;
        break;
    }
}
hf_test_assert($valid_gtin !== '', 'Debe existir un GTIN de prueba válido.');
$with_gtin = new HF_Test_Product(array(
    'id' => 26,
    'sku' => '001-TOP-AZU-L',
    'type' => 'variation',
    'attributes' => array('Talle' => 'L', 'Color' => 'Azul'),
    'gtin' => $valid_gtin,
));
$gtin_row = hf_merchant_row($with_gtin, $parent);
hf_test_assert($gtin_row['data']['gtin'] === $valid_gtin, 'GTIN válido debe enviarse.');
hf_test_assert($gtin_row['data']['identifier_exists'] !== 'no', 'Con GTIN no corresponde identifier_exists=no.');
hf_test_assert(hf_merchant_identifier_exists('Horizon Fit', '001-TOP-AZU-S', '') === '', 'brand + MPN omite identifier_exists.');
hf_test_assert(hf_merchant_identifier_exists('Horizon Fit', '', '') === '', 'brand sin MPN tampoco manda identifier_exists=no.');
hf_test_assert(hf_merchant_identifier_exists('', '', '') === 'no', 'Sin GTIN, MPN ni brand sí corresponde identifier_exists=no.');

$unmapped = new HF_Test_Product(array('id' => 30, 'name' => 'Producto raro negro', 'slug' => 'producto-raro-negro', 'sku' => 'R-1'));
$GLOBALS['hf_test_product_terms'][30] = array(hf_test_term('linea-rara', 'Línea rara'));
$unmapped_row = hf_merchant_row($unmapped);
hf_test_assert($unmapped_row['data']['google_product_category'] === '', 'Categoría no mapeada no debe inventar ID.');
hf_test_assert(in_array('unmapped_google_category', hf_test_issue_codes($unmapped_row), true), 'Categoría no mapeada debe avisar.');

$bad = new HF_Test_Product(array(
    'id' => 40,
    'name' => 'Top copia test',
    'slug' => 'top-copia-test',
    'sku' => '',
    'image_id' => 0,
    'price' => '',
    'regular_price' => '',
    'description' => 'lorem ipsum',
    'gtin' => '12345678',
));
$GLOBALS['hf_test_product_terms'][40] = array(hf_test_term('tops', 'Tops'));
$bad_row = hf_merchant_row($bad);
$bad_codes = hf_test_issue_codes($bad_row);
foreach (array('missing_sku', 'missing_image', 'missing_price', 'placeholder_name', 'invalid_gtin') as $code) {
    hf_test_assert(in_array($code, $bad_codes, true), 'Debe detectar ' . $code);
}
hf_test_assert($bad_row['ready'] === false, 'Producto incompleto debe excluirse del feed.');

$duplicate_a = new HF_Test_Product(array('id' => 50, 'sku' => 'DUP-1'));
$duplicate_b = new HF_Test_Product(array('id' => 51, 'sku' => 'DUP-1', 'slug' => 'otro-dup'));
$GLOBALS['hf_test_product_terms'][50] = array(hf_test_term('tops', 'Tops'));
$GLOBALS['hf_test_product_terms'][51] = array(hf_test_term('tops', 'Tops'));
$report = hf_merchant_build_catalog_report(array($duplicate_a, $duplicate_b, $bad));
hf_test_assert($report['products_analyzed'] === 3, 'Debe contar productos analizados.');
hf_test_assert($report['blocked'] >= 3, 'Duplicados e incompletos deben bloquearse.');
hf_test_assert(($report['top_issues']['duplicate_sku'] ?? 0) === 2, 'Debe contar SKU duplicado.');

$merchant = array('data' => array(
    'id' => '001-TOP-AZU-S',
    'link' => 'https://horizonfit.com.ar/producto/top-liso-azul/',
    'price' => '67000.00 ARS',
    'availability' => 'in_stock',
    'color' => 'Azul',
    'size' => 'S',
    'item_group_id' => '001-TOP-AZU',
));
$html = '<link rel="canonical" href="https://horizonfit.com.ar/producto/top-liso-azul/"><script id="hfSeoJsonLd" type="application/ld+json">{"@graph":[{"@type":"ProductGroup","productGroupID":"001-TOP-AZU","hasVariant":[{"@type":"Product","sku":"001-TOP-AZU-S","color":"Azul","size":"S","offers":{"price":"67000.00","availability":"https://schema.org/InStock"}}]}]}</script>';
$comparison = hf_merchant_compare_search_and_merchant($merchant, hf_merchant_extract_search_snapshot($html));
hf_test_assert(count($comparison) === 0, 'Search y Merchant consistentes no deben generar issues.');

$split_html = str_replace('"size":"S"', '"size":"s"', $html);
$comparison = hf_merchant_compare_search_and_merchant($merchant, hf_merchant_extract_search_snapshot($split_html));
hf_test_assert(count($comparison) === 0, 'S vs s no debe generar schema_size_mismatch.');

$legacy_group_html = str_replace('001-TOP-AZU', '001-TOP', $html);
$legacy_group_html = str_replace('001-TOP-S', '001-TOP-AZU-S', $legacy_group_html);
$comparison = hf_merchant_compare_search_and_merchant($merchant, hf_merchant_extract_search_snapshot($legacy_group_html));
$comparison_codes = array_map(static fn($issue) => $issue['code'], $comparison);
hf_test_assert(in_array('schema_item_group_id_mismatch', $comparison_codes, true), 'Debe detectar ProductGroupID 001-TOP vs item_group_id 001-TOP-AZU.');

$rules = hf_merchant_issue_rules();
hf_test_assert(($rules['missing_sku']['severity'] ?? '') === 'warning', 'missing_sku no debe bloquear.');
hf_test_assert(empty($rules['missing_sku']['blocks_merchant']), 'missing_sku blocks_merchant=no.');
hf_test_assert(($rules['stock_not_managed']['severity'] ?? '') === 'info', 'stock_not_managed es info.');
hf_test_assert(($rules['missing_image']['blocks_merchant'] ?? false) === true, 'missing_image sí bloquea.');

$summary = hf_merchant_report_console_summary($report);
hf_test_assert(str_contains($summary, 'missing_sku'), 'El reporte debe listar reglas o issues.');
hf_test_assert(str_contains($summary, 'blocks_merchant'), 'El reporte debe incluir la tabla de reglas.');

$bad_html = str_replace('67000.00', '670.00', $html);
$comparison = hf_merchant_compare_search_and_merchant($merchant, hf_merchant_extract_search_snapshot($bad_html));
$comparison_codes = array_map(static fn($issue) => $issue['code'], $comparison);
hf_test_assert(in_array('schema_price_mismatch', $comparison_codes, true), 'Debe detectar precio distinto entre schema y feed.');

$snapshot_path = __DIR__ . '/fixtures/production-catalog-summary.json';
hf_test_assert(is_readable($snapshot_path), 'El snapshot de producción debe existir como fixture.');
$snapshot = json_decode((string) file_get_contents($snapshot_path), true);
hf_test_assert(is_array($snapshot) && (int) ($snapshot['variations'] ?? 0) === 153, 'El fixture debe tener 153 variantes.');

$copy_path = __DIR__ . '/fixtures/production-product-copy.json';
hf_test_assert(is_readable($copy_path), 'El sidecar de copy Woo debe existir.');
$copy = json_decode((string) file_get_contents($copy_path), true);
hf_test_assert(is_array($copy) && count($copy['items'] ?? array()) === 51, 'El sidecar debe tener copy de 51 PDPs.');
$copy_by_id = array();
foreach ((array) ($copy['items'] ?? array()) as $copy_item) {
    $copy_by_id[(int) ($copy_item['id'] ?? 0)] = $copy_item;
}

function hf_test_snapshot_price($value): string {
    $raw = trim((string) $value);
    if ($raw === '') {
        return '';
    }
    if (strlen($raw) > 2 && ctype_digit($raw)) {
        return wc_format_decimal(((int) $raw) / 100, 2);
    }
    return $raw;
}

function hf_test_snapshot_attributes(array $attributes): array {
    $out = array();
    foreach ($attributes as $attribute) {
        if (! is_array($attribute)) {
            continue;
        }
        $name = (string) ($attribute['name'] ?? '');
        $value = (string) ($attribute['value'] ?? '');
        if ($name !== '') {
            $out[$name] = $value;
        }
    }
    return $out;
}

$snapshot_products = array();
$snapshot_rows = array();
foreach ((array) ($snapshot['items'] ?? array()) as $item) {
    $children = array();
    foreach ((array) ($item['variations'] ?? array()) as $variation) {
        $children[] = (int) ($variation['id'] ?? 0);
    }
    $parent = new HF_Test_Product(array(
        'id' => (int) $item['id'],
        'name' => (string) $item['name'],
        'slug' => (string) $item['slug'],
        'sku' => (string) $item['sku'],
        'type' => 'variable',
        'children' => $children,
        'price' => hf_test_snapshot_price($item['price'] ?? ''),
        'regular_price' => hf_test_snapshot_price($item['price'] ?? ''),
        'image_id' => ! empty($item['images']) ? 10 : 0,
        'attributes' => $item['attributes'] ?? array(),
        'description' => (string) ($copy_by_id[(int) $item['id']]['description'] ?? ''),
        'short_description' => (string) ($copy_by_id[(int) $item['id']]['short_description'] ?? ''),
    ));
    $GLOBALS['hf_test_product_terms'][(int) $item['id']] = array_map(
        static fn($term) => hf_test_term((string) $term['slug'], (string) $term['name'], 0),
        (array) ($item['categories'] ?? array())
    );
    $snapshot_products[] = $parent;
    foreach ((array) ($item['variations'] ?? array()) as $variation) {
        $variation_product = new HF_Test_Product(array(
            'id' => (int) $variation['id'],
            'name' => (string) ($variation['name'] ?? $item['name']),
            'slug' => (string) $item['slug'],
            'sku' => (string) ($variation['sku'] ?? ''),
            'type' => 'variation',
            'price' => hf_test_snapshot_price($variation['price'] ?? $item['price'] ?? ''),
            'regular_price' => hf_test_snapshot_price($variation['price'] ?? $item['price'] ?? ''),
            'image_id' => ! empty($variation['image']) || ! empty($item['images']) ? 10 : 0,
            'attributes' => hf_test_snapshot_attributes($variation['attributes'] ?? array()),
            'stock_status' => ! empty($variation['in_stock']) ? 'instock' : 'outofstock',
        ));
        $GLOBALS['hf_test_products'][(int) $variation['id']] = $variation_product;
        $snapshot_rows[] = hf_merchant_row($variation_product, $parent);
    }
}

hf_test_assert(count($snapshot_rows) === 153, 'Deben generarse 153 filas Merchant desde el fixture.');
$ids = array_map(static fn($row) => $row['data']['id'], $snapshot_rows);
hf_test_assert(count($ids) === count(array_unique($ids)), 'Ningún ID Merchant del fixture debe duplicarse.');
$skus = array_filter(array_map(static fn($row) => $row['sku'], $snapshot_rows));
hf_test_assert(count($skus) === count(array_unique($skus)), 'Ningún SKU del fixture debe duplicarse.');

$by_sku = array();
foreach ($snapshot_rows as $row) {
    $by_sku[$row['data']['id']] = $row;
}

foreach (array('001-TOP-AZU-S', '001-TOP-AZU-M', '001-TOP-AZU-L') as $sku) {
    hf_test_assert(isset($by_sku[$sku]), 'Debe existir ' . $sku);
    hf_test_assert($by_sku[$sku]['data']['item_group_id'] === '001-TOP-AZU', $sku . ' debe agrupar por color 001-TOP-AZU.');
    hf_test_assert($by_sku[$sku]['data']['identifier_exists'] !== 'no', $sku . ' tiene brand + MPN.');
    hf_test_assert($by_sku[$sku]['data']['size_system'] !== 'US' && $by_sku[$sku]['data']['size_system'] === '', $sku . ' no debe recibir size_system=US.');
}
foreach (array('001-TOP-NEG-S', '001-TOP-NEG-M', '001-TOP-NEG-L') as $sku) {
    hf_test_assert(isset($by_sku[$sku]), 'Debe existir ' . $sku);
    hf_test_assert($by_sku[$sku]['data']['item_group_id'] === '001-TOP-NEG', $sku . ' usa su propio grupo de color.');
    hf_test_assert($by_sku[$sku]['data']['color'] === 'Negro', $sku . ' debe normalizar Colour a Negro.');
    hf_test_assert(in_array($by_sku[$sku]['data']['size'], array('S', 'M', 'L'), true), $sku . ' debe normalizar Size a S/M/L.');
}
$falda_sku = $by_sku['004-FAL-BOR-S'] ?? null;
hf_test_assert($falda_sku !== null, 'Debe existir 004-FAL-BOR-S.');
hf_test_assert($falda_sku['data']['google_product_category'] === '1581', 'FAL del fixture debe mapear a 1581.');
hf_test_assert($falda_sku['data']['item_group_id'] === '004-FAL-BOR', 'FAL comparte grupo por color.');

$ready_count = 0;
$identifier_no = 0;
$size_system_us = 0;
foreach ($snapshot_rows as $row) {
    if (! empty($row['ready'])) {
        $ready_count++;
    }
    if (($row['data']['identifier_exists'] ?? '') === 'no' && ($row['data']['mpn'] ?? '') !== '') {
        $identifier_no++;
    }
    if (($row['data']['size_system'] ?? '') === 'US') {
        $size_system_us++;
    }
}
hf_test_assert($identifier_no === 0, 'Ninguna variante con brand + MPN debe tener identifier_exists=no.');
hf_test_assert($size_system_us === 0, 'Ninguna variante debe recibir size_system=US.');
hf_test_assert($ready_count === 153, 'Las 153 variantes del fixture deben ser Merchant ready.');

$good_copy = new HF_Test_Product(array(
    'id' => 80,
    'name' => 'Top Dynamic blue',
    'slug' => 'top-dynamic-blue',
    'sku' => '001-TOP-AZU',
    'attributes' => array('Color' => 'Azul', 'Talle' => 'S | M | L'),
    'description' => '<p>El top Dynamic se convierte en la base de tus looks más versátiles. Pensado para mujeres que buscan prendas que se adapten a su día a día, esta pieza te permite crear combinaciones distintas según la ocasión.</p>',
));
$good_meta = hf_search_product_meta_description($good_copy);
$good_title = hf_search_product_title($good_copy);
hf_test_assert(! hf_search_contains($good_meta, '<p>'), 'Debe strippear HTML del copy Woo.');
hf_test_assert(! hf_search_contains($good_meta, 'Descubrí'), 'No debe usar el fallback genérico si hay copy Woo.');
hf_test_assert(hf_search_strlen($good_meta) >= 120 && hf_search_strlen($good_meta) <= 158, 'Meta con copy bueno debe quedar 120–158.');
hf_test_assert($good_title === 'Top Dynamic blue | Horizon Fit', 'Debe conservar el casing Woo y no Title Case.');
hf_test_assert(! preg_match('/\S{40,}/u', $good_meta), 'El recorte no debe dejar un token gigante partido.');
hf_test_assert(! str_ends_with($good_meta, '…'), 'La meta no debe cortar con ellipsis a mitad de frase.');

$long_copy = str_repeat('Prenda pensada para entrenar con calce cómodo y movimiento diario. ', 20);
$long_product = new HF_Test_Product(array(
    'id' => 81,
    'name' => 'Calza Dynamic black',
    'slug' => 'calza-dynamic-black',
    'sku' => '001-CAL-NEG',
    'description' => $long_copy,
));
$long_meta = hf_search_product_meta_description($long_product);
hf_test_assert(hf_search_strlen($long_meta) <= 158, 'Copy largo debe recortarse al hard limit.');
$long_words = preg_split('/\s+/u', $long_meta);
$last_word = (string) end($long_words);
hf_test_assert($last_word !== '' && preg_match('/^[A-Za-zÁÉÍÓÚáéíóúñÑ.,]+$/u', $last_word), 'El recorte debe terminar en palabra completa.');
hf_test_assert(hf_search_contains($long_copy, rtrim($last_word, '.,')), 'La última palabra recortada debe existir en el copy original.');

$utf_product = new HF_Test_Product(array(
    'id' => 82,
    'name' => 'Falda Zenith borgoña',
    'slug' => 'falda-zenith-borgona',
    'sku' => '004-FAL-BOR',
    'description' => 'La falda Zenith en borgoña combina movimiento, caí­da y estilo. Diseñada para mujeres que buscan una prenda cómoda para entrenar o salir, con un calce que respeta el diseño original de Woo.',
));
$utf_meta = hf_search_product_meta_description($utf_product);
hf_test_assert(hf_search_contains($utf_meta, 'borgoña') || hf_search_contains(hf_search_product_title($utf_product), 'borgoña'), 'Debe preservar UTF-8 (ó/ñ).');

$short_product = new HF_Test_Product(array(
    'id' => 83,
    'name' => 'Short Pulse green',
    'slug' => 'short-pulse-green',
    'sku' => '002-SHO-VER',
    'description' => 'Corto.',
    'short_description' => 'Muy corto.',
    'attributes' => array('Color' => 'Verde', 'Talle' => 'S, M, L'),
));
$short_meta = hf_search_product_meta_description($short_product);
hf_test_assert(! hf_search_contains($short_meta, 'máximo soporte'), 'El fallback no debe inventar claims.');
hf_test_assert(hf_search_contains($short_meta, 'Short Pulse green'), 'Fallback mínimo debe usar el nombre real.');

$empty_product = new HF_Test_Product(array(
    'id' => 84,
    'name' => 'Campera Motion grey',
    'slug' => 'campera-motion-grey',
    'sku' => '003-CAM-GRI',
    'description' => '',
    'short_description' => '',
    'attributes' => array('Color' => 'Gris'),
));
$empty_meta = hf_search_product_meta_description($empty_product);
hf_test_assert(hf_search_contains($empty_meta, 'Campera Motion grey'), 'Sin copy debe caer al nombre.');
hf_test_assert(! hf_search_contains($empty_meta, 'Descubrí'), 'Sin copy no debe rellenar con marketing genérico.');

$placeholder_product = new HF_Test_Product(array(
    'id' => 85,
    'name' => 'Top placeholder test',
    'slug' => 'top-placeholder-test',
    'sku' => '000-TOP-PLA',
    'description' => 'lorem ipsum dolor sit amet placeholder texto de prueba para el auditor search.',
));
$placeholder_report = hf_search_build_snippets_report(array($placeholder_product));
$placeholder_codes = hf_test_issue_codes($placeholder_report['items'][0] ?? array());
hf_test_assert(in_array('seo_title_placeholder', $placeholder_codes, true), 'Debe marcar title placeholder.');
hf_test_assert(in_array('weak_meta_description', $placeholder_codes, true), 'Placeholder no debe rellenarse con marketing; queda débil.');

$shared_copy = 'El top Dynamic se convierte en la base de tus looks más versátiles. Pensado para mujeres que buscan prendas que se adapten a su día a día, esta pieza te permite crear combinaciones distintas según la ocasión.';
$dup_a = new HF_Test_Product(array(
    'id' => 86,
    'name' => 'Top Dynamic blue',
    'slug' => 'top-dynamic-blue-dup-a',
    'sku' => '001-TOP-AZU-DUPA',
    'description' => $shared_copy,
    'attributes' => array('Color' => 'Azul', 'Talle' => 'S'),
    'image_id' => 10,
    'price' => '67000',
    'regular_price' => '67000',
));
$dup_b = new HF_Test_Product(array(
    'id' => 87,
    'name' => 'Top Dynamic blue',
    'slug' => 'top-dynamic-blue-dup-b',
    'sku' => '001-TOP-AZU-DUPB',
    'description' => $shared_copy,
    'attributes' => array('Color' => 'Azul', 'Talle' => 'S'),
    'image_id' => 10,
    'price' => '67000',
    'regular_price' => '67000',
));
$GLOBALS['hf_test_product_terms'][86] = array(hf_test_term('tops', 'Tops'));
$GLOBALS['hf_test_product_terms'][87] = array(hf_test_term('tops', 'Tops'));
$dup_search = hf_search_build_snippets_report(array($dup_a, $dup_b));
$dup_codes = array_merge(
    hf_test_issue_codes($dup_search['items'][0] ?? array()),
    hf_test_issue_codes($dup_search['items'][1] ?? array())
);
hf_test_assert(in_array('duplicate_meta_description', $dup_codes, true), 'Copy idéntico debe marcar duplicate Search.');
hf_test_assert(in_array('duplicate_seo_title', $dup_codes, true), 'Title idéntico debe marcar duplicate Search.');
$dup_merchant = hf_merchant_build_catalog_report(array($dup_a, $dup_b));
hf_test_assert((int) $dup_merchant['blocked'] === 0, 'Duplicados Search no deben bloquear Merchant.');
hf_test_assert(! in_array('duplicate_meta_description', hf_test_issue_codes($dup_merchant['items'][0] ?? array()), true), 'El issue Search no debe mezclarse en filas Merchant.');

$color_in_name = new HF_Test_Product(array(
    'id' => 88,
    'name' => 'Top Dynamic blue',
    'slug' => 'top-dynamic-blue-color',
    'sku' => '001-TOP-AZU-COL',
    'description' => $shared_copy,
    'attributes' => array('Color' => 'blue'),
));
$color_meta = hf_search_product_meta_description($color_in_name);
hf_test_assert(! preg_match('/Top Dynamic blue[^.]*Top Dynamic blue/i', $color_meta), 'No debe repetir el nombre dos veces.');

$search_snapshot = hf_search_build_snippets_report($snapshot_products);
hf_test_assert((int) $search_snapshot['products'] === 51, 'El auditor Search debe cubrir 51 PDPs.');
hf_test_assert((int) $search_snapshot['unique_titles'] === 51, 'Los 51 titles Search deben ser únicos.');
$search_summary = hf_search_report_console_summary($search_snapshot);
hf_test_assert(str_contains($search_summary, 'Search products: 51'), 'El resumen Search debe listar 51 productos.');

$type_skus = array(
    'TOP' => '001-TOP-AZU',
    'CAL' => '001-CAL-NEG',
    'SHO' => '001-SHO-NEG',
    'CAM' => '001-CAM-BLA',
    'FAL' => '004-FAL-BOR',
);
$by_parent_sku = array();
foreach ($snapshot_products as $snapshot_product) {
    $by_parent_sku[(string) $snapshot_product->get_sku()] = $snapshot_product;
}
foreach ($type_skus as $type => $sku) {
    hf_test_assert(isset($by_parent_sku[$sku]), 'Debe existir un PDP de tipo ' . $type);
    $type_title = hf_search_product_title($by_parent_sku[$sku]);
    $type_meta = hf_search_product_meta_description($by_parent_sku[$sku]);
    hf_test_assert($type_title !== '', 'Title Search ' . $type . ' no vacío.');
    hf_test_assert($type_meta !== '', 'Meta Search ' . $type . ' no vacía.');
    hf_test_assert(hf_search_strlen($type_title) <= 65, 'Title ' . $type . ' respeta 65.');
    hf_test_assert(hf_search_strlen($type_meta) <= 158, 'Meta ' . $type . ' respeta 158.');
}

$search_rules = hf_search_issue_rules();
foreach (array('duplicate_meta_description', 'weak_meta_description', 'meta_description_too_short', 'meta_description_too_long', 'duplicate_seo_title', 'seo_title_too_long', 'seo_title_placeholder') as $code) {
    hf_test_assert(isset($search_rules[$code]), 'Debe existir regla Search ' . $code);
    hf_test_assert(empty($search_rules[$code]['blocks_merchant']), $code . ' no debe bloquear Merchant.');
}

echo 'OK search-merchant-tests fixture_ready=' . $ready_count . ' search_products=' . (int) $search_snapshot['products'] . "\n";

if (($argv[1] ?? '') === 'report') {
    echo "\n" . hf_search_report_console_summary($search_snapshot) . "\n";
    echo "\n--- 10 PDP before/after ---\n";
    foreach (array_slice($search_snapshot['items'], 0, 10) as $item) {
        $name = $item['name'];
        $before_title = $name . ' para Mujer | Horizon Fit';
        if (hf_search_strlen($before_title) > 65) {
            $before_title = $name . ' | Horizon Fit';
        }
        echo $item['sku'] . '  ' . $item['slug'] . "\n";
        echo '  title before: ' . $before_title . "\n";
        echo '  title after:  ' . $item['title'] . ' (' . $item['title_len'] . ")\n";
        echo '  meta before:  Descubrí ' . $name . " de Horizon Fit: una prenda de activewear cómoda y funcional para entrenar, combinar con tu set y acompañarte todos los días.\n";
        echo '  meta after:   ' . $item['meta_description'] . ' (' . $item['meta_len'] . ")\n";
        echo '  issues:       ' . (empty($item['issues']) ? 'none' : implode(', ', array_column($item['issues'], 'code'))) . "\n\n";
    }
}
