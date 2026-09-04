<?php
/**
 * Meta Conversions API integration for paid WooCommerce orders.
 *
 * Browser and server Purchase events share hf-order-{order_id} as event_id.
 * Meta can therefore keep the server event when the browser redirect is lost,
 * while deduplicating both copies when the buyer returns to the storefront.
 */

if (! defined('ABSPATH')) {
    exit;
}

const HF_META_CAPI_SENT_META = '_hf_meta_capi_purchase_sent';
const HF_META_CAPI_ATTEMPTS_META = '_hf_meta_capi_purchase_attempts';
const HF_META_CAPI_ERROR_META = '_hf_meta_capi_purchase_error';
const HF_META_CAPI_MAX_ATTEMPTS = 4;

function hf_meta_capi_settings() {
    if (function_exists('hf_storefront_tracking_settings')) {
        return hf_storefront_tracking_settings();
    }
    $saved = get_option('hf_tracking_settings', array());
    return is_array($saved) ? $saved : array();
}

function hf_meta_capi_is_configured() {
    $settings = hf_meta_capi_settings();
    return ! empty($settings['meta_pixel_id']) && ! empty($settings['meta_capi_access_token']);
}

function hf_meta_capi_hash($value, $kind = 'text') {
    $value = trim((string) $value);
    if ($value === '') {
        return '';
    }
    if ($kind === 'phone' || $kind === 'postcode') {
        $value = preg_replace('/\D+/', '', $value);
    } else {
        $value = function_exists('remove_accents') ? remove_accents($value) : $value;
        $value = strtolower($value);
        $value = preg_replace('/\s+/u', '', $value);
    }
    return $value === '' ? '' : hash('sha256', $value);
}

function hf_meta_capi_user_data(WC_Order $order) {
    $fields = array(
        'em' => hf_meta_capi_hash($order->get_billing_email()),
        'ph' => hf_meta_capi_hash($order->get_billing_phone(), 'phone'),
        'fn' => hf_meta_capi_hash($order->get_billing_first_name()),
        'ln' => hf_meta_capi_hash($order->get_billing_last_name()),
        'ct' => hf_meta_capi_hash($order->get_billing_city()),
        'st' => hf_meta_capi_hash($order->get_billing_state()),
        'zp' => hf_meta_capi_hash($order->get_billing_postcode(), 'postcode'),
        'country' => hf_meta_capi_hash($order->get_billing_country()),
        'external_id' => hf_meta_capi_hash($order->get_customer_id() ? 'wc-customer-' . $order->get_customer_id() : 'wc-order-' . $order->get_id()),
    );
    $fields = array_filter($fields);
    foreach ($fields as $key => $value) {
        $fields[$key] = array($value);
    }

    $ip = trim((string) $order->get_customer_ip_address());
    $agent = trim((string) $order->get_customer_user_agent());
    if ($ip !== '') {
        $fields['client_ip_address'] = $ip;
    }
    if ($agent !== '') {
        $fields['client_user_agent'] = $agent;
    }
    $fbp = trim((string) $order->get_meta('_hf_meta_fbp', true));
    $fbc = trim((string) $order->get_meta('_hf_meta_fbc', true));
    if ($fbp !== '') {
        $fields['fbp'] = $fbp;
    }
    if ($fbc !== '') {
        $fields['fbc'] = $fbc;
    }
    return $fields;
}

function hf_meta_capi_capture_browser_ids(WC_Order $order) {
    foreach (array('_fbp' => '_hf_meta_fbp', '_fbc' => '_hf_meta_fbc') as $cookie => $meta_key) {
        if (empty($_COOKIE[$cookie])) {
            continue;
        }
        $value = preg_replace('/[^A-Za-z0-9._-]/', '', (string) wp_unslash($_COOKIE[$cookie]));
        if ($value !== '') {
            $order->update_meta_data($meta_key, $value);
        }
    }
}

function hf_meta_capi_capture_classic_checkout_ids($order) {
    if ($order instanceof WC_Order) {
        hf_meta_capi_capture_browser_ids($order);
    }
}
add_action('woocommerce_checkout_create_order', 'hf_meta_capi_capture_classic_checkout_ids', 20, 1);

function hf_meta_capi_capture_store_api_ids($order) {
    if ($order instanceof WC_Order) {
        hf_meta_capi_capture_browser_ids($order);
    }
}
add_action('woocommerce_store_api_checkout_update_order_from_request', 'hf_meta_capi_capture_store_api_ids', 20, 1);

function hf_meta_capi_content_id($product) {
    if (! $product instanceof WC_Product) {
        return '';
    }
    if (function_exists('hf_storefront_product_group_id')) {
        $group_id = trim((string) hf_storefront_product_group_id($product));
        if ($group_id !== '') {
            return $group_id;
        }
    }
    $sku = trim((string) $product->get_sku());
    if ($sku !== '' && function_exists('hf_product_parent_sku_base_from_variation_sku')) {
        $sku = hf_product_parent_sku_base_from_variation_sku($sku);
    }
    return $sku !== '' ? strtoupper($sku) : (string) $product->get_id();
}

function hf_meta_capi_custom_data(WC_Order $order) {
    $contents = array();
    foreach ($order->get_items('line_item') as $item) {
        if (! $item instanceof WC_Order_Item_Product) {
            continue;
        }
        $product = $item->get_product();
        $content_id = hf_meta_capi_content_id($product);
        if ($content_id === '') {
            continue;
        }
        $quantity = max(1, (int) $item->get_quantity());
        $line_total = (float) $item->get_total();
        $contents[] = array(
            'id' => $content_id,
            'quantity' => $quantity,
            'item_price' => round($line_total / $quantity, 2),
        );
    }

    return array(
        'currency' => strtoupper((string) $order->get_currency()),
        'value' => round((float) $order->get_total(), 2),
        'content_type' => 'product',
        'content_ids' => array_values(array_unique(wp_list_pluck($contents, 'id'))),
        'contents' => $contents,
        'num_items' => array_sum(array_map(static function ($content) {
            return (int) $content['quantity'];
        }, $contents)),
        'order_id' => (string) $order->get_id(),
    );
}

function hf_meta_capi_purchase_event(WC_Order $order) {
    $paid_at = $order->get_date_paid();
    return array(
        'event_name' => 'Purchase',
        'event_time' => $paid_at ? $paid_at->getTimestamp() : time(),
        'event_id' => 'hf-order-' . $order->get_id(),
        'event_source_url' => 'https://horizonfit.com.ar/checkout/pedido-recibido/?order=' . $order->get_id(),
        'action_source' => 'website',
        'user_data' => hf_meta_capi_user_data($order),
        'custom_data' => hf_meta_capi_custom_data($order),
    );
}

function hf_meta_capi_schedule_retry($order_id) {
    if (! wp_next_scheduled('hf_meta_capi_retry_purchase', array((int) $order_id))) {
        wp_schedule_single_event(time() + (5 * MINUTE_IN_SECONDS), 'hf_meta_capi_retry_purchase', array((int) $order_id));
    }
}

function hf_meta_capi_send_purchase($order_id) {
    if (! hf_meta_capi_is_configured() || ! function_exists('wc_get_order')) {
        return false;
    }
    $order = wc_get_order($order_id);
    if (! $order instanceof WC_Order || ! $order->is_paid() || $order->get_meta(HF_META_CAPI_SENT_META, true)) {
        return false;
    }

    $attempts = (int) $order->get_meta(HF_META_CAPI_ATTEMPTS_META, true);
    if ($attempts >= HF_META_CAPI_MAX_ATTEMPTS) {
        return false;
    }
    $order->update_meta_data(HF_META_CAPI_ATTEMPTS_META, $attempts + 1);
    $order->save_meta_data();

    $settings = hf_meta_capi_settings();
    $api_version = (string) apply_filters('hf_meta_capi_graph_version', 'v26.0');
    $endpoint = sprintf(
        'https://graph.facebook.com/%s/%s/events?access_token=%s',
        rawurlencode($api_version),
        rawurlencode($settings['meta_pixel_id']),
        rawurlencode($settings['meta_capi_access_token'])
    );
    $payload = array('data' => array(hf_meta_capi_purchase_event($order)));
    if (! empty($settings['meta_capi_test_event_code'])) {
        $payload['test_event_code'] = $settings['meta_capi_test_event_code'];
    }

    $response = wp_remote_post($endpoint, array(
        'timeout' => 15,
        'headers' => array('Content-Type' => 'application/json'),
        'body' => wp_json_encode($payload),
        'data_format' => 'body',
    ));
    $status = is_wp_error($response) ? 0 : (int) wp_remote_retrieve_response_code($response);
    $body = is_wp_error($response) ? $response->get_error_message() : (string) wp_remote_retrieve_body($response);
    $decoded = json_decode($body, true);
    $accepted = $status >= 200 && $status < 300 && ! empty($decoded['events_received']);

    if ($accepted) {
        $order->update_meta_data(HF_META_CAPI_SENT_META, gmdate('c'));
        $order->delete_meta_data(HF_META_CAPI_ERROR_META);
        $order->save_meta_data();
        return true;
    }

    $safe_error = is_array($decoded) && ! empty($decoded['error']['message'])
        ? sanitize_text_field($decoded['error']['message'])
        : sanitize_text_field($body ?: 'HTTP ' . $status);
    $order->update_meta_data(HF_META_CAPI_ERROR_META, wp_html_excerpt($safe_error, 300, '...'));
    $order->save_meta_data();
    if (function_exists('wc_get_logger')) {
        wc_get_logger()->error(
            sprintf('Meta CAPI Purchase falló para la orden %d (HTTP %d): %s', $order->get_id(), $status, $safe_error),
            array('source' => 'horizon-fit-meta-capi')
        );
    }
    if ($attempts + 1 < HF_META_CAPI_MAX_ATTEMPTS) {
        hf_meta_capi_schedule_retry($order->get_id());
    } else {
        $order->add_order_note(__('Meta CAPI no pudo enviar Purchase luego de 4 intentos. Revisar WooCommerce → Estado → Registros (horizon-fit-meta-capi).', 'horizon-fit-commerce'));
    }
    return false;
}

function hf_meta_capi_on_payment_complete($order_id) {
    hf_meta_capi_send_purchase(absint($order_id));
}
add_action('woocommerce_payment_complete', 'hf_meta_capi_on_payment_complete', 30);
add_action('hf_meta_capi_retry_purchase', 'hf_meta_capi_on_payment_complete', 10);

function hf_meta_capi_on_order_status_changed($order_id, $from, $to) {
    if (in_array($to, array('processing', 'completed'), true)) {
        hf_meta_capi_send_purchase(absint($order_id));
    }
}
add_action('woocommerce_order_status_changed', 'hf_meta_capi_on_order_status_changed', 30, 3);
