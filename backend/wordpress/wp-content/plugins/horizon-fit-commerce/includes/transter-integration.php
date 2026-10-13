<?php
/**
 * Integración logística entre WooCommerce y Transter API v1.1.
 *
 * La integración permanece desactivada hasta que un administrador configure
 * credenciales, transportes y estados de envío. Las credenciales nunca salen
 * al frontend ni se escriben en los logs.
 */

if (! defined('ABSPATH')) {
    exit;
}

const HF_TRANSTER_ENDPOINT = 'https://www.transter.com.ar/wp-content/plugins/transter-api/';
const HF_TRANSTER_MAX_ATTEMPTS = 4;
const HF_TRANSTER_ACTION_GROUP = 'horizon-fit-transter';

const HF_TRANSTER_SENT_AT_META = '_hf_transter_sent_at';
const HF_TRANSTER_REMOTE_ID_META = '_hf_transter_remote_id';
const HF_TRANSTER_STATUS_META = '_hf_transter_status';
const HF_TRANSTER_ATTEMPTS_META = '_hf_transter_attempts';
const HF_TRANSTER_LAST_CODE_META = '_hf_transter_last_code';
const HF_TRANSTER_LAST_MESSAGE_META = '_hf_transter_last_message';
const HF_TRANSTER_CANCELLED_AT_META = '_hf_transter_cancelled_at';
const HF_TRANSTER_LABEL_URL_META = '_hf_transter_label_url';

function hf_transter_default_settings() {
    return array(
        'enabled'                => false,
        'email'                  => '',
        'password'               => '',
        'create_statuses'        => array('processing'),
        'auto_cancel'            => false,
        'validate_skus'          => true,
        'get_sku_method'         => 'POST',
        'transport_map'          => '',
        'default_transport_id'   => '',
        'default_transport_name' => '',
    );
}

function hf_transter_normalize_settings($settings) {
    $settings = is_array($settings) ? $settings : array();
    $defaults = hf_transter_default_settings();
    $normalized = wp_parse_args($settings, $defaults);

    $normalized['enabled'] = ! empty($normalized['enabled']);
    $normalized['auto_cancel'] = ! empty($normalized['auto_cancel']);
    $normalized['validate_skus'] = ! empty($normalized['validate_skus']);
    $normalized['email'] = sanitize_email((string) $normalized['email']);
    $normalized['password'] = (string) $normalized['password'];
    $normalized['get_sku_method'] = strtoupper((string) $normalized['get_sku_method']) === 'DELETE' ? 'DELETE' : 'POST';
    $normalized['transport_map'] = sanitize_textarea_field((string) $normalized['transport_map']);
    $normalized['default_transport_id'] = sanitize_text_field((string) $normalized['default_transport_id']);
    $normalized['default_transport_name'] = sanitize_text_field((string) $normalized['default_transport_name']);

    $allowed_statuses = array('processing', 'completed', 'on-hold');
    $statuses = is_array($normalized['create_statuses']) ? $normalized['create_statuses'] : array();
    $normalized['create_statuses'] = array_values(array_intersect($allowed_statuses, array_map('sanitize_key', $statuses)));
    if (! $normalized['create_statuses']) {
        $normalized['create_statuses'] = array('processing');
    }

    return $normalized;
}

function hf_transter_env($name) {
    if (defined($name)) {
        return trim((string) constant($name));
    }
    $value = getenv($name);
    return false === $value ? '' : trim((string) $value);
}

function hf_transter_settings() {
    $saved = get_option('hf_transter_settings', array());
    $settings = hf_transter_normalize_settings($saved);

    $env_email = hf_transter_env('HF_TRANSTER_EMAIL');
    $env_password = hf_transter_env('HF_TRANSTER_PASSWORD');
    if ($env_email !== '') {
        $settings['email'] = sanitize_email($env_email);
    }
    if ($env_password !== '') {
        $settings['password'] = $env_password;
    }

    return apply_filters('hf_transter_settings', $settings);
}

function hf_transter_is_configured() {
    $settings = hf_transter_settings();
    return ! empty($settings['email']) && ! empty($settings['password']);
}

function hf_transter_is_enabled() {
    $settings = hf_transter_settings();
    return ! empty($settings['enabled']) && hf_transter_is_configured();
}

/**
 * Parse one mapping per line:
 * flat_rate:3=Next Day|Next Day
 * free_shipping=Postal - Puerta a Puerta|Puerta a Puerta [hasta 96 Hs.]
 */
function hf_transter_parse_transport_map($raw) {
    $map = array();
    foreach (preg_split('/\r\n|\r|\n/', (string) $raw) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || ! str_contains($line, '=')) {
            continue;
        }
        list($woo_key, $transter_value) = array_map('trim', explode('=', $line, 2));
        $parts = array_map('trim', explode('|', $transter_value, 2));
        if ($woo_key === '' || empty($parts[0])) {
            continue;
        }
        $map[$woo_key] = array(
            'id'   => sanitize_text_field($parts[0]),
            'name' => sanitize_text_field($parts[1] ?? $parts[0]),
        );
    }
    return $map;
}

function hf_transter_order_transport($order, $settings = null) {
    $settings = is_array($settings) ? $settings : hf_transter_settings();
    $map = hf_transter_parse_transport_map($settings['transport_map'] ?? '');

    foreach ($order->get_items('shipping') as $shipping_item) {
        $method_id = trim((string) $shipping_item->get_method_id());
        $instance_id = method_exists($shipping_item, 'get_instance_id') ? absint($shipping_item->get_instance_id()) : 0;
        $keys = array_filter(array(
            $instance_id ? $method_id . ':' . $instance_id : '',
            $method_id,
        ));
        foreach ($keys as $key) {
            if (isset($map[$key])) {
                return $map[$key];
            }
        }
    }

    $default_id = trim((string) ($settings['default_transport_id'] ?? ''));
    $default_name = trim((string) ($settings['default_transport_name'] ?? ''));
    if ($default_id !== '' && $default_name !== '') {
        return array('id' => $default_id, 'name' => $default_name);
    }
    return array();
}

function hf_transter_order_identifier($order) {
    return (string) apply_filters('hf_transter_order_identifier', (string) $order->get_id(), $order);
}

function hf_transter_state_name($country, $state) {
    $country = strtoupper(trim((string) $country));
    $state = trim((string) $state);
    if ($state === '' || ! function_exists('WC')) {
        return $state;
    }
    $states = WC()->countries->get_states($country);
    return is_array($states) && isset($states[$state]) ? (string) $states[$state] : $state;
}

function hf_transter_build_order_payload($order, $settings = null) {
    $settings = is_array($settings) ? hf_transter_normalize_settings($settings) : hf_transter_settings();
    $errors = array();
    $warnings = array();

    $items = array();
    foreach ($order->get_items('line_item') as $item) {
        $product = $item->get_product();
        $sku = $product ? trim((string) $product->get_sku()) : '';
        $quantity = (int) $item->get_quantity();
        if ($sku === '') {
            $errors[] = sprintf(__('El ítem "%s" no tiene SKU.', 'horizon-fit-commerce'), $item->get_name());
            continue;
        }
        if ($quantity < 1) {
            $errors[] = sprintf(__('El ítem "%s" tiene cantidad inválida.', 'horizon-fit-commerce'), $item->get_name());
            continue;
        }
        $items[] = array('sku' => $sku, 'cantidad' => $quantity);
    }
    if (! $items) {
        $errors[] = __('La orden no tiene ítems válidos para Transter.', 'horizon-fit-commerce');
    }

    $transport = hf_transter_order_transport($order, $settings);
    if (! $transport) {
        $errors[] = __('El método de envío de WooCommerce no tiene mapeo de Transter.', 'horizon-fit-commerce');
    }

    $first_name = $order->get_shipping_first_name() ?: $order->get_billing_first_name();
    $last_name = $order->get_shipping_last_name() ?: $order->get_billing_last_name();
    $address_1 = $order->get_shipping_address_1() ?: $order->get_billing_address_1();
    $address_2 = $order->get_shipping_address_2() ?: $order->get_billing_address_2();
    $city = $order->get_shipping_city() ?: $order->get_billing_city();
    $state = $order->get_shipping_state() ?: $order->get_billing_state();
    $postcode = $order->get_shipping_postcode() ?: $order->get_billing_postcode();
    $country = $order->get_shipping_country() ?: $order->get_billing_country();
    $email = $order->get_billing_email();
    $phone = $order->get_billing_phone();

    $required = array(
        'nombre'        => $first_name,
        'apellido'      => $last_name,
        'direccion'     => $address_1,
        'localidad'     => $city,
        'provincia'     => $state,
        'codigo_postal' => $postcode,
    );
    foreach ($required as $field => $value) {
        if (trim((string) $value) === '') {
            $errors[] = sprintf(__('Falta el dato de entrega obligatorio: %s.', 'horizon-fit-commerce'), $field);
        }
    }
    if (trim((string) $email) === '') {
        $warnings[] = __('El pedido no tiene email de contacto.', 'horizon-fit-commerce');
    }
    if (trim((string) $phone) === '') {
        $warnings[] = __('El pedido no tiene teléfono de contacto.', 'horizon-fit-commerce');
    }

    $comments = trim((string) $order->get_customer_note());
    $payload = array(
        'user' => array(
            'email'    => (string) $settings['email'],
            'password' => (string) $settings['password'],
        ),
        'orden' => array(
            'id' => hf_transter_order_identifier($order),
            'destinatario' => array(
                'nombre'        => sanitize_text_field($first_name),
                'apellido'      => sanitize_text_field($last_name),
                'email'         => sanitize_email($email),
                'movil'         => sanitize_text_field($phone),
                'direccion'     => sanitize_text_field(trim($address_1 . ' ' . $address_2)),
                'localidad'     => sanitize_text_field($city),
                'provincia'     => sanitize_text_field(hf_transter_state_name($country, $state)),
                'codigo_postal' => sanitize_text_field($postcode),
                'comentarios'   => sanitize_textarea_field($comments),
            ),
            'items' => $items,
            'metodo_transporte' => (string) ($transport['name'] ?? ''),
            'metodo_transporte_id' => (string) ($transport['id'] ?? ''),
            'etiqueta' => esc_url_raw((string) $order->get_meta(HF_TRANSTER_LABEL_URL_META, true)),
        ),
    );

    return array('payload' => $payload, 'errors' => $errors, 'warnings' => $warnings);
}

function hf_transter_parse_response($response) {
    if (is_wp_error($response)) {
        return array(
            'ok' => false,
            'transport_error' => true,
            'http_code' => 0,
            'code' => 0,
            'message' => sanitize_text_field($response->get_error_message()),
            'body' => array(),
        );
    }

    $http_code = (int) wp_remote_retrieve_response_code($response);
    $raw_body = trim((string) wp_remote_retrieve_body($response));
    $decoded = json_decode($raw_body, true);
    $body = is_array($decoded) ? $decoded : array();
    $normalized_body = array();
    foreach ($body as $key => $value) {
        $normalized_body[strtolower((string) $key)] = $value;
    }
    $code = 0;
    foreach (array('code', 'codigo', 'status') as $key) {
        if (isset($normalized_body[$key]) && is_numeric($normalized_body[$key])) {
            $code = (int) $normalized_body[$key];
            break;
        }
    }
    if (! $code && preg_match('/\b(200|50[0-8])\b/', $raw_body, $match)) {
        $code = (int) $match[1];
    }
    $message = '';
    foreach (array('message', 'mensaje', 'error', 'detail') as $key) {
        if (! empty($normalized_body[$key]) && is_scalar($normalized_body[$key])) {
            $message = sanitize_text_field((string) $normalized_body[$key]);
            break;
        }
    }
    if ($message === '') {
        $message = sanitize_text_field(wp_html_excerpt(wp_strip_all_tags($raw_body), 300, '...'));
    }

    $effective_code = $code ?: $http_code;
    return array(
        'ok' => 200 === $effective_code || (! $code && $http_code >= 200 && $http_code < 300),
        'transport_error' => false,
        'http_code' => $http_code,
        'code' => $effective_code,
        'message' => $message,
        'body' => $body,
    );
}

function hf_transter_request($method, $payload) {
    $endpoint = (string) apply_filters('hf_transter_api_endpoint', HF_TRANSTER_ENDPOINT);
    if ('https' !== wp_parse_url($endpoint, PHP_URL_SCHEME)) {
        return hf_transter_parse_response(new WP_Error('hf_transter_insecure_endpoint', __('Transter requiere un endpoint HTTPS.', 'horizon-fit-commerce')));
    }
    $response = wp_remote_request($endpoint, array(
        'method'      => strtoupper((string) $method),
        'timeout'     => 20,
        'redirection' => 0,
        'headers'     => array('Content-Type' => 'application/json; charset=utf-8'),
        'body'        => wp_json_encode($payload),
        'data_format' => 'body',
    ));
    return hf_transter_parse_response($response);
}

function hf_transter_logger($level, $message, $context = array()) {
    if (! function_exists('wc_get_logger')) {
        return;
    }
    $context['source'] = 'horizon-fit-transter';
    wc_get_logger()->log($level, $message, $context);
}

function hf_transter_check_sku($sku, $force = false) {
    $sku = trim((string) $sku);
    if ($sku === '') {
        return array('ok' => false, 'code' => 508, 'message' => __('SKU vacío.', 'horizon-fit-commerce'));
    }
    $cache_key = 'hf_transter_sku_' . md5($sku);
    if (! $force) {
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return $cached;
        }
    }
    $settings = hf_transter_settings();
    $result = hf_transter_request($settings['get_sku_method'], array(
        'user' => array('email' => $settings['email'], 'password' => $settings['password']),
        'modelo' => 'GetSKU',
        'sku' => $sku,
    ));
    if (508 === (int) ($result['code'] ?? 0)) {
        $result['ok'] = false;
    }
    if (! empty($result['ok'])) {
        set_transient($cache_key, $result, 12 * HOUR_IN_SECONDS);
    }
    return $result;
}

function hf_transter_schedule_action($hook, $order_id, $delay = 0) {
    $args = array(absint($order_id));
    if (function_exists('as_has_scheduled_action') && as_has_scheduled_action($hook, $args, HF_TRANSTER_ACTION_GROUP)) {
        return false;
    }
    if (function_exists('as_schedule_single_action')) {
        as_schedule_single_action(time() + max(0, (int) $delay), $hook, $args, HF_TRANSTER_ACTION_GROUP, true);
        return true;
    }
    if (! wp_next_scheduled($hook, $args)) {
        wp_schedule_single_event(time() + max(0, (int) $delay), $hook, $args);
        return true;
    }
    return false;
}

function hf_transter_schedule_retry($order, $hook) {
    $attempts = (int) $order->get_meta(HF_TRANSTER_ATTEMPTS_META, true);
    $delays = array(300, 1800, 7200);
    if ($attempts >= HF_TRANSTER_MAX_ATTEMPTS || ! isset($delays[$attempts - 1])) {
        return false;
    }
    return hf_transter_schedule_action($hook, $order->get_id(), $delays[$attempts - 1]);
}

function hf_transter_save_result($order, $result, $status) {
    $order->update_meta_data(HF_TRANSTER_STATUS_META, sanitize_key($status));
    $order->update_meta_data(HF_TRANSTER_LAST_CODE_META, (int) ($result['code'] ?? 0));
    $order->update_meta_data(HF_TRANSTER_LAST_MESSAGE_META, wp_html_excerpt((string) ($result['message'] ?? ''), 300, '...'));
    $order->save_meta_data();
}

function hf_transter_send_order($order_id, $force = false, $allow_disabled = false) {
    if ((! $allow_disabled && ! hf_transter_is_enabled()) || ($allow_disabled && ! hf_transter_is_configured()) || ! function_exists('wc_get_order')) {
        return false;
    }
    $order = wc_get_order(absint($order_id));
    if (! $order instanceof WC_Order) {
        return false;
    }
    if (! $force && $order->get_meta(HF_TRANSTER_SENT_AT_META, true)) {
        return true;
    }

    $lock_key = 'hf_transter_lock_' . $order->get_id();
    $existing_lock = (int) get_option($lock_key, 0);
    if ($existing_lock && $existing_lock < time() - (10 * MINUTE_IN_SECONDS)) {
        delete_option($lock_key);
    }
    if (! add_option($lock_key, time(), '', false)) {
        return false;
    }

    try {
        $attempts = (int) $order->get_meta(HF_TRANSTER_ATTEMPTS_META, true) + 1;
        $order->update_meta_data(HF_TRANSTER_ATTEMPTS_META, $attempts);
        $order->save_meta_data();

        $built = hf_transter_build_order_payload($order);
        if ($built['errors']) {
            $result = array('code' => 0, 'message' => implode(' ', $built['errors']));
            hf_transter_save_result($order, $result, 'blocked');
            $order->add_order_note(sprintf(__('Transter: pedido bloqueado. %s', 'horizon-fit-commerce'), $result['message']));
            hf_transter_logger('error', sprintf('Pedido %d bloqueado antes del envío: %s', $order->get_id(), $result['message']));
            return false;
        }

        $settings = hf_transter_settings();
        if (! empty($settings['validate_skus'])) {
            foreach ($built['payload']['orden']['items'] as $item) {
                $sku_result = hf_transter_check_sku($item['sku']);
                if (empty($sku_result['ok'])) {
                    $result = array(
                        'code' => (int) ($sku_result['code'] ?? 0),
                        'message' => sprintf('SKU %s: %s', $item['sku'], $sku_result['message'] ?? __('no validado', 'horizon-fit-commerce')),
                    );
                    hf_transter_save_result($order, $result, 'sku_error');
                    hf_transter_logger('error', sprintf('Pedido %d no enviado: %s', $order->get_id(), $result['message']));
                    if (! empty($sku_result['transport_error']) && $attempts < HF_TRANSTER_MAX_ATTEMPTS) {
                        hf_transter_schedule_retry($order, 'hf_transter_send_order_action');
                    } else {
                        $order->add_order_note(sprintf(__('Transter: no se pudo validar el producto. %s', 'horizon-fit-commerce'), $result['message']));
                    }
                    return false;
                }
            }
        }

        $result = hf_transter_request('POST', $built['payload']);
        $duplicate = 503 === (int) ($result['code'] ?? 0);
        if (! empty($result['ok']) || $duplicate) {
            $sent_at = gmdate('c');
            $order->update_meta_data(HF_TRANSTER_SENT_AT_META, $sent_at);
            $order->update_meta_data(HF_TRANSTER_REMOTE_ID_META, $built['payload']['orden']['id']);
            hf_transter_save_result($order, $result, $duplicate ? 'duplicate_confirmed' : 'sent');
            $order->add_order_note($duplicate
                ? __('Transter confirmó que la orden ya existía; se tomó como sincronizada.', 'horizon-fit-commerce')
                : sprintf(__('Orden enviada a Transter con identificador %s.', 'horizon-fit-commerce'), $built['payload']['orden']['id'])
            );
            hf_transter_logger('info', sprintf('Pedido %d sincronizado con Transter (código %d).', $order->get_id(), (int) ($result['code'] ?? 0)));
            return true;
        }

        hf_transter_save_result($order, $result, 'error');
        hf_transter_logger('error', sprintf('Transter rechazó el pedido %d (código %d): %s', $order->get_id(), (int) ($result['code'] ?? 0), $result['message'] ?? ''));
        $http_code = (int) ($result['http_code'] ?? 0);
        $retryable = ! empty($result['transport_error']) || 429 === $http_code || $http_code >= 500;
        if ($retryable && $attempts < HF_TRANSTER_MAX_ATTEMPTS) {
            hf_transter_schedule_retry($order, 'hf_transter_send_order_action');
        } else {
            $order->add_order_note(sprintf(__('Transter rechazó el pedido (código %d): %s', 'horizon-fit-commerce'), (int) ($result['code'] ?? 0), $result['message'] ?? ''));
        }
        return false;
    } finally {
        delete_option($lock_key);
    }
}

function hf_transter_cancel_order($order_id, $allow_disabled = false) {
    if ((! $allow_disabled && ! hf_transter_is_enabled()) || ($allow_disabled && ! hf_transter_is_configured()) || ! function_exists('wc_get_order')) {
        return false;
    }
    $order = wc_get_order(absint($order_id));
    if (! $order instanceof WC_Order || ! $order->get_meta(HF_TRANSTER_SENT_AT_META, true) || $order->get_meta(HF_TRANSTER_CANCELLED_AT_META, true)) {
        return false;
    }
    $settings = hf_transter_settings();
    $remote_id = trim((string) $order->get_meta(HF_TRANSTER_REMOTE_ID_META, true));
    $result = hf_transter_request('DELETE', array(
        'user' => array('email' => $settings['email'], 'password' => $settings['password']),
        'orden' => array('id' => $remote_id !== '' ? $remote_id : hf_transter_order_identifier($order)),
    ));
    if (! empty($result['ok']) || 506 === (int) ($result['code'] ?? 0)) {
        $order->update_meta_data(HF_TRANSTER_CANCELLED_AT_META, gmdate('c'));
        hf_transter_save_result($order, $result, 'cancelled');
        $order->add_order_note(__('Orden anulada en Transter.', 'horizon-fit-commerce'));
        return true;
    }
    hf_transter_save_result($order, $result, 'cancel_error');
    $order->add_order_note(sprintf(__('Transter no pudo anular la orden (código %d): %s', 'horizon-fit-commerce'), (int) ($result['code'] ?? 0), $result['message'] ?? ''));
    hf_transter_logger('error', sprintf('No se pudo anular el pedido %d en Transter: %s', $order->get_id(), $result['message'] ?? ''));
    return false;
}

function hf_transter_on_order_status_changed($order_id, $from, $to) {
    if (! hf_transter_is_enabled()) {
        return;
    }
    $settings = hf_transter_settings();
    if (in_array($to, $settings['create_statuses'], true)) {
        hf_transter_schedule_action('hf_transter_send_order_action', $order_id);
    }
    if ('cancelled' === $to && ! empty($settings['auto_cancel'])) {
        hf_transter_schedule_action('hf_transter_cancel_order_action', $order_id);
    }
}
add_action('woocommerce_order_status_changed', 'hf_transter_on_order_status_changed', 40, 3);
add_action('hf_transter_send_order_action', 'hf_transter_send_order', 10, 1);
add_action('hf_transter_cancel_order_action', 'hf_transter_cancel_order', 10, 1);
add_action('hf_transter_manual_send_order_action', 'hf_transter_manual_send_worker', 10, 1);
add_action('hf_transter_manual_cancel_order_action', 'hf_transter_manual_cancel_worker', 10, 1);

function hf_transter_order_actions($actions, $order) {
    if (! $order instanceof WC_Order || ! hf_transter_is_configured()) {
        return $actions;
    }
    if (! $order->get_meta(HF_TRANSTER_SENT_AT_META, true)) {
        $actions['hf_transter_send'] = __('Enviar a Transter', 'horizon-fit-commerce');
    } elseif (! $order->get_meta(HF_TRANSTER_CANCELLED_AT_META, true)) {
        $actions['hf_transter_cancel'] = __('Anular en Transter', 'horizon-fit-commerce');
    }
    return $actions;
}
add_filter('woocommerce_order_actions', 'hf_transter_order_actions', 10, 2);

function hf_transter_manual_send_action($order) {
    hf_transter_schedule_action('hf_transter_manual_send_order_action', $order->get_id());
}
function hf_transter_manual_cancel_action($order) {
    hf_transter_schedule_action('hf_transter_manual_cancel_order_action', $order->get_id());
}
function hf_transter_manual_send_worker($order_id) {
    return hf_transter_send_order($order_id, false, true);
}
function hf_transter_manual_cancel_worker($order_id) {
    return hf_transter_cancel_order($order_id, true);
}
add_action('woocommerce_order_action_hf_transter_send', 'hf_transter_manual_send_action');
add_action('woocommerce_order_action_hf_transter_cancel', 'hf_transter_manual_cancel_action');

function hf_transter_render_order_label_field($order) {
    if (! $order instanceof WC_Order) {
        return;
    }
    $value = (string) $order->get_meta(HF_TRANSTER_LABEL_URL_META, true);
    ?>
    <p class="form-field form-field-wide">
        <label for="hf-transter-label-url"><?php esc_html_e('URL de etiqueta Transter', 'horizon-fit-commerce'); ?></label>
        <input id="hf-transter-label-url" type="url" name="hf_transter_label_url" value="<?php echo esc_attr($value); ?>" placeholder="https://...">
        <span class="description"><?php esc_html_e('Opcional. Transter descargará la etiqueta desde esta URL al recibir la orden.', 'horizon-fit-commerce'); ?></span>
    </p>
    <?php
}
add_action('woocommerce_admin_order_data_after_shipping_address', 'hf_transter_render_order_label_field');

function hf_transter_save_order_label_field($order_id) {
    if (! current_user_can('edit_shop_order', $order_id) || ! isset($_POST['hf_transter_label_url'])) {
        return;
    }
    $order = wc_get_order($order_id);
    if (! $order instanceof WC_Order) {
        return;
    }
    $order->update_meta_data(HF_TRANSTER_LABEL_URL_META, esc_url_raw(wp_unslash($_POST['hf_transter_label_url'])));
    $order->save_meta_data();
}
add_action('woocommerce_process_shop_order_meta', 'hf_transter_save_order_label_field');

function hf_transter_available_shipping_methods() {
    if (! class_exists('WC_Shipping_Zones')) {
        return array();
    }
    $rows = array();
    $zones = WC_Shipping_Zones::get_zones();
    $rest = WC_Shipping_Zones::get_zone(0);
    $zones[] = array(
        'zone_name' => __('Resto de las ubicaciones', 'horizon-fit-commerce'),
        'shipping_methods' => $rest->get_shipping_methods(),
    );
    foreach ($zones as $zone) {
        foreach ((array) ($zone['shipping_methods'] ?? array()) as $method) {
            $method_id = isset($method->id) ? (string) $method->id : '';
            $instance_id = isset($method->instance_id) ? absint($method->instance_id) : 0;
            if ($method_id === '') {
                continue;
            }
            $rows[] = array(
                'zone' => (string) ($zone['zone_name'] ?? ''),
                'key' => $instance_id ? $method_id . ':' . $instance_id : $method_id,
                'title' => method_exists($method, 'get_title') ? (string) $method->get_title() : $method_id,
                'enabled' => ! method_exists($method, 'is_enabled') || $method->is_enabled(),
            );
        }
    }
    return $rows;
}

function hf_transter_render_admin() {
    if (! current_user_can('manage_woocommerce')) {
        return;
    }
    $saved = false;
    if (! empty($_POST['hf_transter_submit'])) {
        check_admin_referer('hf_transter_settings_action');
        $current = hf_transter_normalize_settings(get_option('hf_transter_settings', array()));
        $password = $current['password'];
        $submitted_password = (string) wp_unslash($_POST['hf_transter_password'] ?? '');
        if ($submitted_password !== '') {
            $password = $submitted_password;
        }
        if (! empty($_POST['hf_transter_clear_password'])) {
            $password = '';
        }
        $settings = hf_transter_normalize_settings(array(
            'enabled' => ! empty($_POST['hf_transter_enabled']),
            'email' => wp_unslash($_POST['hf_transter_email'] ?? ''),
            'password' => $password,
            'create_statuses' => (array) wp_unslash($_POST['hf_transter_create_statuses'] ?? array()),
            'auto_cancel' => ! empty($_POST['hf_transter_auto_cancel']),
            'validate_skus' => ! empty($_POST['hf_transter_validate_skus']),
            'get_sku_method' => wp_unslash($_POST['hf_transter_get_sku_method'] ?? 'POST'),
            'transport_map' => wp_unslash($_POST['hf_transter_transport_map'] ?? ''),
            'default_transport_id' => wp_unslash($_POST['hf_transter_default_transport_id'] ?? ''),
            'default_transport_name' => wp_unslash($_POST['hf_transter_default_transport_name'] ?? ''),
        ));
        update_option('hf_transter_settings', $settings, false);
        $saved = true;
    }
    $settings = hf_transter_settings();
    $password_configured = $settings['password'] !== '';
    $shipping_methods = hf_transter_available_shipping_methods();
    ?>
    <?php if ($saved) : ?><div class="notice notice-success"><p><?php esc_html_e('Configuración de Transter guardada.', 'horizon-fit-commerce'); ?></p></div><?php endif; ?>
    <h2><?php esc_html_e('Logística Transter', 'horizon-fit-commerce'); ?></h2>
    <p><?php esc_html_e('Envía pedidos de WooCommerce a Transter de forma asíncrona, con control de duplicados, validación de SKU, reintentos y registro en las notas del pedido.', 'horizon-fit-commerce'); ?></p>
    <div class="notice notice-warning inline" style="max-width:1000px;"><p><strong><?php esc_html_e('Importante:', 'horizon-fit-commerce'); ?></strong> <?php esc_html_e('la guía v1.1 contradice POST/DELETE para GetSKU y no documenta tracking. El método puede configurarse abajo. Esta integración no cambia estados de WooCommerce.', 'horizon-fit-commerce'); ?></p></div>
    <p><strong><?php echo hf_transter_is_enabled() ? esc_html__('Estado: activo', 'horizon-fit-commerce') : esc_html__('Estado: inactivo', 'horizon-fit-commerce'); ?></strong> · <?php echo hf_transter_is_configured() ? esc_html__('Credenciales configuradas', 'horizon-fit-commerce') : esc_html__('Faltan credenciales', 'horizon-fit-commerce'); ?></p>
    <form method="post" style="max-width:1000px;">
        <?php wp_nonce_field('hf_transter_settings_action'); ?>
        <table class="form-table" role="presentation"><tbody>
            <tr><th><?php esc_html_e('Activación', 'horizon-fit-commerce'); ?></th><td><label><input type="checkbox" name="hf_transter_enabled" value="1" <?php checked($settings['enabled']); ?>> <?php esc_html_e('Enviar automáticamente los pedidos que alcancen los estados elegidos', 'horizon-fit-commerce'); ?></label></td></tr>
            <tr><th><label for="hf-transter-email"><?php esc_html_e('Email de Transter', 'horizon-fit-commerce'); ?></label></th><td><input id="hf-transter-email" type="email" name="hf_transter_email" value="<?php echo esc_attr($settings['email']); ?>" class="regular-text" autocomplete="off"></td></tr>
            <tr><th><label for="hf-transter-password"><?php esc_html_e('Contraseña de Transter', 'horizon-fit-commerce'); ?></label></th><td><input id="hf-transter-password" type="password" name="hf_transter_password" value="" class="regular-text" autocomplete="new-password" placeholder="<?php echo esc_attr($password_configured ? __('Configurada; dejar vacío para conservar', 'horizon-fit-commerce') : __('Ingresar contraseña', 'horizon-fit-commerce')); ?>"><br><label><input type="checkbox" name="hf_transter_clear_password" value="1"> <?php esc_html_e('Eliminar contraseña guardada', 'horizon-fit-commerce'); ?></label><p class="description"><?php esc_html_e('También puede definirse en el servidor con HF_TRANSTER_EMAIL y HF_TRANSTER_PASSWORD; esas variables tienen prioridad.', 'horizon-fit-commerce'); ?></p></td></tr>
            <tr><th><?php esc_html_e('Enviar al alcanzar', 'horizon-fit-commerce'); ?></th><td><?php foreach (array('processing' => 'Procesando', 'completed' => 'Completado', 'on-hold' => 'En espera') as $status => $label) : ?><label style="display:block;"><input type="checkbox" name="hf_transter_create_statuses[]" value="<?php echo esc_attr($status); ?>" <?php checked(in_array($status, $settings['create_statuses'], true)); ?>> <?php echo esc_html($label); ?></label><?php endforeach; ?></td></tr>
            <tr><th><?php esc_html_e('Cancelaciones', 'horizon-fit-commerce'); ?></th><td><label><input type="checkbox" name="hf_transter_auto_cancel" value="1" <?php checked($settings['auto_cancel']); ?>> <?php esc_html_e('Intentar anular en Transter cuando WooCommerce pase a Cancelado', 'horizon-fit-commerce'); ?></label></td></tr>
            <tr><th><?php esc_html_e('Validación de SKU', 'horizon-fit-commerce'); ?></th><td><label><input type="checkbox" name="hf_transter_validate_skus" value="1" <?php checked($settings['validate_skus']); ?>> <?php esc_html_e('Consultar cada SKU en Transter antes de crear la orden', 'horizon-fit-commerce'); ?></label><br><select name="hf_transter_get_sku_method"><option value="POST" <?php selected($settings['get_sku_method'], 'POST'); ?>>POST (indicado por el texto)</option><option value="DELETE" <?php selected($settings['get_sku_method'], 'DELETE'); ?>>DELETE (indicado por el ejemplo)</option></select></td></tr>
            <tr><th><label for="hf-transter-map"><?php esc_html_e('Mapeo de transportes', 'horizon-fit-commerce'); ?></label></th><td><textarea id="hf-transter-map" name="hf_transter_transport_map" rows="9" class="large-text code" placeholder="flat_rate:3=Next Day|Next Day"><?php echo esc_textarea($settings['transport_map']); ?></textarea><p class="description"><?php esc_html_e('Una regla por línea: metodo_woo:instancia=metodo_transporte_id|metodo_transporte. También puede usarse solo metodo_woo.', 'horizon-fit-commerce'); ?></p></td></tr>
            <tr><th><?php esc_html_e('Transporte predeterminado', 'horizon-fit-commerce'); ?></th><td><input type="text" name="hf_transter_default_transport_id" value="<?php echo esc_attr($settings['default_transport_id']); ?>" placeholder="ID Transter" class="regular-text"><br><input type="text" name="hf_transter_default_transport_name" value="<?php echo esc_attr($settings['default_transport_name']); ?>" placeholder="Nombre Transter" class="regular-text" style="margin-top:6px;"><p class="description"><?php esc_html_e('Se usa únicamente si el método WooCommerce no tiene una regla específica. Dejar ambos vacíos para bloquear pedidos sin mapear.', 'horizon-fit-commerce'); ?></p></td></tr>
        </tbody></table>
        <p class="submit"><button type="submit" class="button button-primary" name="hf_transter_submit" value="1"><?php esc_html_e('Guardar logística', 'horizon-fit-commerce'); ?></button></p>
    </form>
    <?php if ($shipping_methods) : ?>
        <h3><?php esc_html_e('Métodos de envío detectados en WooCommerce', 'horizon-fit-commerce'); ?></h3>
        <table class="widefat striped" style="max-width:1000px;"><thead><tr><th><?php esc_html_e('Zona', 'horizon-fit-commerce'); ?></th><th><?php esc_html_e('Clave para el mapeo', 'horizon-fit-commerce'); ?></th><th><?php esc_html_e('Nombre', 'horizon-fit-commerce'); ?></th><th><?php esc_html_e('Estado', 'horizon-fit-commerce'); ?></th></tr></thead><tbody>
        <?php foreach ($shipping_methods as $method) : ?><tr><td><?php echo esc_html($method['zone']); ?></td><td><code><?php echo esc_html($method['key']); ?></code></td><td><?php echo esc_html($method['title']); ?></td><td><?php echo $method['enabled'] ? esc_html__('Activo', 'horizon-fit-commerce') : esc_html__('Inactivo', 'horizon-fit-commerce'); ?></td></tr><?php endforeach; ?>
        </tbody></table>
    <?php endif; ?>
    <h3><?php esc_html_e('Operación manual', 'horizon-fit-commerce'); ?></h3>
    <p><?php esc_html_e('Dentro de cada pedido, en Acciones del pedido, aparecen “Enviar a Transter” o “Anular en Transter”. Los resultados quedan en las notas del pedido y en WooCommerce → Estado → Registros, fuente horizon-fit-transter.', 'horizon-fit-commerce'); ?></p>
    <?php
}

if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('horizon-fit transter status', static function () {
        $settings = hf_transter_settings();
        WP_CLI::line('enabled=' . (! empty($settings['enabled']) ? 'yes' : 'no'));
        WP_CLI::line('configured=' . (hf_transter_is_configured() ? 'yes' : 'no'));
        WP_CLI::line('get_sku_method=' . $settings['get_sku_method']);
        WP_CLI::line('transport_rules=' . count(hf_transter_parse_transport_map($settings['transport_map'])));
    });
    WP_CLI::add_command('horizon-fit transter send', static function ($args, $assoc_args) {
        $order_id = absint($args[0] ?? 0);
        if (! $order_id) {
            WP_CLI::error('Falta el ID del pedido.');
        }
        $ok = hf_transter_send_order($order_id, ! empty($assoc_args['force']), true);
        $ok ? WP_CLI::success('Pedido sincronizado con Transter.') : WP_CLI::error('No se pudo sincronizar. Revisar notas y logs.');
    });
    WP_CLI::add_command('horizon-fit transter cancel', static function ($args) {
        $order_id = absint($args[0] ?? 0);
        if (! $order_id) {
            WP_CLI::error('Falta el ID del pedido.');
        }
        hf_transter_cancel_order($order_id, true) ? WP_CLI::success('Orden anulada en Transter.') : WP_CLI::error('No se pudo anular. Revisar notas y logs.');
    });
    WP_CLI::add_command('horizon-fit transter check-sku', static function ($args) {
        $sku = trim((string) ($args[0] ?? ''));
        if ($sku === '') {
            WP_CLI::error('Falta el SKU.');
        }
        $result = hf_transter_check_sku($sku, true);
        WP_CLI::line(wp_json_encode(array_intersect_key($result, array_flip(array('ok', 'http_code', 'code', 'message'))), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        if (empty($result['ok'])) {
            WP_CLI::halt(1);
        }
    });
}
