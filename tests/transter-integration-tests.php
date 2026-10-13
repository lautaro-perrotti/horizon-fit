<?php

define('ABSPATH', __DIR__);
define('HOUR_IN_SECONDS', 3600);
define('MINUTE_IN_SECONDS', 60);

function add_action() {}
function add_filter() {}
function apply_filters($name, $value) { return $value; }
function get_option($name, $default = false) { return $default; }
function sanitize_email($value) { return filter_var($value, FILTER_SANITIZE_EMAIL); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $value)); }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_textarea_field($value) { return trim(strip_tags((string) $value)); }
function wp_parse_args($args, $defaults = array()) { return array_merge($defaults, is_array($args) ? $args : array()); }
function absint($value) { return abs((int) $value); }
function esc_url_raw($value) { return filter_var((string) $value, FILTER_SANITIZE_URL); }
function __($value) { return $value; }
function wp_html_excerpt($value, $length, $more = null) { return mb_substr((string) $value, 0, $length) . (mb_strlen((string) $value) > $length ? (string) $more : ''); }
function wp_strip_all_tags($value) { return strip_tags((string) $value); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_remote_retrieve_response_code($response) { return (int) ($response['response']['code'] ?? 0); }
function wp_remote_retrieve_body($response) { return (string) ($response['body'] ?? ''); }
function wp_parse_url($url, $component = -1) { return parse_url($url, $component); }

class WP_Error {
    private $message;
    public function __construct($code, $message) { $this->message = $message; }
    public function get_error_message() { return $this->message; }
}

require_once __DIR__ . '/../backend/wordpress/wp-content/plugins/horizon-fit-commerce/includes/transter-integration.php';

function hf_transter_assert($condition, $message) {
    if (! $condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$settings = hf_transter_normalize_settings(array(
    'enabled' => '1',
    'email' => ' logistica@example.com ',
    'get_sku_method' => 'delete',
    'auto_sync' => '1',
    'sync_interval' => 30,
    'create_statuses' => array('processing', 'garbage'),
));
hf_transter_assert($settings['enabled'] === true, 'Debe normalizar enabled.');
hf_transter_assert($settings['email'] === 'logistica@example.com', 'Debe sanear el email.');
hf_transter_assert($settings['get_sku_method'] === 'DELETE', 'Debe permitir resolver la contradicción GetSKU con DELETE.');
hf_transter_assert($settings['auto_sync'] === true && $settings['sync_interval'] === 30, 'Debe normalizar la sincronización automática.');
hf_transter_assert($settings['create_statuses'] === array('processing'), 'Debe descartar estados no permitidos.');

$map = hf_transter_parse_transport_map("# comentario\nflat_rate:3=Next Day|Next Day\nfree_shipping=Postal - Puerta a Puerta|Puerta a Puerta [hasta 96 Hs.]\nmalformed");
hf_transter_assert(count($map) === 2, 'Debe ignorar comentarios y líneas inválidas.');
hf_transter_assert($map['flat_rate:3']['id'] === 'Next Day', 'Debe mapear la instancia WooCommerce.');
hf_transter_assert($map['free_shipping']['name'] === 'Puerta a Puerta [hasta 96 Hs.]', 'Debe conservar el nombre Transter.');

$inventory_payload = hf_transter_inventory_payload(array('email' => 'api@example.com', 'password' => 'secret'), 'deposito@example.com');
hf_transter_assert($inventory_payload['modelo'] === 'GetInventario', 'Debe usar el modelo GetInventario indicado por la v1.5.');
hf_transter_assert($inventory_payload['inventario_de'] === 'deposito@example.com', 'Debe incluir inventario_de cuando se solicita un inventario autorizado.');

$success = hf_transter_parse_response(array(
    'response' => array('code' => 200),
    'body' => json_encode(array('code' => 200, 'mensaje' => 'Envio ingresado correctamente.')),
));
hf_transter_assert($success['ok'] === true && $success['code'] === 200, 'Debe reconocer respuesta exitosa.');

$duplicate = hf_transter_parse_response(array(
    'response' => array('code' => 200),
    'body' => json_encode(array('code' => 503, 'mensaje' => 'Ya existe una orden')),
));
hf_transter_assert($duplicate['ok'] === false && $duplicate['code'] === 503, 'Debe detectar duplicado como código funcional, no éxito genérico HTTP.');

$sku_missing = hf_transter_parse_response(array(
    'response' => array('code' => 200),
    'body' => '508 El SKU ingresado no corresponde',
));
hf_transter_assert($sku_missing['ok'] === false && $sku_missing['code'] === 508, 'Debe interpretar respuestas no JSON documentadas.');

$network = hf_transter_parse_response(new WP_Error('timeout', 'Tiempo agotado'));
hf_transter_assert($network['transport_error'] === true && $network['ok'] === false, 'Debe distinguir errores de transporte para reintentar.');

$inventory_success = hf_transter_parse_response(array(
    'response' => array('code' => 200),
    'body' => json_encode(array(array('sku' => 'SKU-500-X', 'stock' => 2))),
));
hf_transter_assert($inventory_success['ok'] === true && $inventory_success['code'] === 200, 'Un 500 dentro de datos JSON no debe interpretarse como código de error.');

$order_response = hf_transter_parse_response(array(
    'response' => array('code' => 200),
    'body' => json_encode(array(
        'id' => '1161',
        'estado' => array('code' => 'completed', 'txt' => 'Completado'),
        'external_tracking' => 'TRK-123',
        'external_courier' => 'Correo de prueba',
        'items' => array(array('id' => 1, 'nombre' => 'Top Zenith', 'cantidad' => 1)),
    )),
));
$order_data = hf_transter_parse_order_data($order_response);
hf_transter_assert($order_data['status_code'] === 'completed', 'Debe leer el código de estado de GetOrden v1.5.');
hf_transter_assert($order_data['status_text'] === 'Completado', 'Debe leer el texto de estado de GetOrden v1.5.');
hf_transter_assert($order_data['external_tracking'] === 'TRK-123', 'Debe guardar el tracking externo documentado.');
hf_transter_assert($order_data['external_courier'] === 'Correo de prueba', 'Debe guardar el courier externo documentado.');
hf_transter_assert(hf_transter_is_terminal_status('completed') === true, 'Completed debe detener la sincronización.');
hf_transter_assert(hf_transter_is_terminal_status('processing') === false, 'Processing debe continuar sincronizándose.');

class HF_Test_Product {
    private $sku;
    public function __construct($sku) { $this->sku = $sku; }
    public function get_sku() { return $this->sku; }
}
class HF_Test_Line_Item {
    private $name;
    private $sku;
    private $quantity;
    public function __construct($name, $sku, $quantity) { $this->name = $name; $this->sku = $sku; $this->quantity = $quantity; }
    public function get_product() { return new HF_Test_Product($this->sku); }
    public function get_quantity() { return $this->quantity; }
    public function get_name() { return $this->name; }
}
class HF_Test_Shipping_Item {
    public function get_method_id() { return 'flat_rate'; }
    public function get_instance_id() { return 3; }
}
class HF_Test_Order {
    public function get_id() { return 1161; }
    public function get_items($type) { return $type === 'shipping' ? array(new HF_Test_Shipping_Item()) : array(new HF_Test_Line_Item('Top Zenith', '004-TOP-BOR-S', 2)); }
    public function get_shipping_first_name() { return 'Lautaro'; }
    public function get_billing_first_name() { return ''; }
    public function get_shipping_last_name() { return 'Perrotti'; }
    public function get_billing_last_name() { return ''; }
    public function get_shipping_address_1() { return 'Av. Siempre Viva 123'; }
    public function get_billing_address_1() { return ''; }
    public function get_shipping_address_2() { return '2 B'; }
    public function get_billing_address_2() { return ''; }
    public function get_shipping_city() { return 'CABA'; }
    public function get_billing_city() { return ''; }
    public function get_shipping_state() { return 'C'; }
    public function get_billing_state() { return ''; }
    public function get_shipping_postcode() { return '1425'; }
    public function get_billing_postcode() { return ''; }
    public function get_shipping_country() { return 'AR'; }
    public function get_billing_country() { return ''; }
    public function get_billing_email() { return 'cliente@example.com'; }
    public function get_billing_phone() { return '1122334455'; }
    public function get_customer_note() { return 'Timbre B'; }
    public function get_meta() { return ''; }
}

$built = hf_transter_build_order_payload(new HF_Test_Order(), array(
    'email' => 'api@example.com',
    'password' => 'secret',
    'transport_map' => 'flat_rate:3=Next Day|Next Day',
));
hf_transter_assert($built['errors'] === array(), 'Un pedido completo no debe bloquearse.');
hf_transter_assert($built['payload']['orden']['id'] === '1161', 'El ID externo debe ser estable y compatible con el ejemplo numérico de Transter.');
hf_transter_assert($built['payload']['orden']['items'][0] === array('sku' => '004-TOP-BOR-S', 'cantidad' => 2), 'Debe usar SKU de variación y cantidad real.');
hf_transter_assert($built['payload']['orden']['metodo_transporte_id'] === 'Next Day', 'Debe aplicar el mapeo por instancia.');
hf_transter_assert($built['payload']['orden']['destinatario']['direccion'] === 'Av. Siempre Viva 123 2 B', 'Debe combinar las líneas de dirección.');

fwrite(STDOUT, "Transter integration tests: OK\n");
