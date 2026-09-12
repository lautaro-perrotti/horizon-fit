<?php
/** Checkout run-once: absent → pending → done. A failed attempt is forgotten. */
if (!defined('ABSPATH')) exit;

function hf_framework_cart_user_id($token) {
    if (!is_string($token) || substr_count($token, '.') < 2) return '';
    $payload = explode('.', $token)[1];
    $b64 = strtr($payload, '-_', '+/');
    $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
    $decoded = json_decode(base64_decode($b64), true);
    return is_array($decoded) && array_key_exists('user_id', $decoded) ? (string) $decoded['user_id'] : '';
}

function hf_framework_checkout_key($cart_user_id, $raw_body) {
    return hash('sha256', (string) $cart_user_id . '.' . (string) $raw_body);
}

function hf_framework_idempotency_claim($store, $key, $now, $pending_ttl = 60) {
    $existing = $store['get']($key);
    if (is_array($existing)) {
        if (($existing['state'] ?? '') === 'done') return $existing;
        if (($existing['state'] ?? '') === 'pending' && ((int) $now - (int) ($existing['at'] ?? 0)) < $pending_ttl) {
            return $existing;
        }
        $store['delete']($key);
    }
    $pending = array('state' => 'pending', 'at' => (int) $now);
    if (!$store['setIfAbsent']($key, $pending)) {
        $again = $store['get']($key);
        return is_array($again) ? $again : $pending;
    }
    return array_merge($pending, array('claimed' => true));
}

function hf_framework_idempotency_complete($store, $key, $result, $now) {
    $safe = array(
        'state' => 'done',
        'at' => (int) $now,
        'order_id' => isset($result['order_id']) ? (int) $result['order_id'] : 0,
        'order_key' => (string) ($result['order_key'] ?? ''),
        'order_number' => (string) ($result['order_number'] ?? ''),
        'status' => (string) ($result['status'] ?? ''),
        'customer_id' => isset($result['customer_id']) ? (int) $result['customer_id'] : 0,
    );
    $store['set']($key, $safe);
    return $safe;
}

function hf_framework_idempotency_fail($store, $key) {
    $store['delete']($key);
}

function hf_framework_checkout_replay_body($record) {
    return array(
        'order_id' => (int) ($record['order_id'] ?? 0),
        'order_key' => (string) ($record['order_key'] ?? ''),
        'order_number' => (string) ($record['order_number'] ?? ''),
        'status' => (string) ($record['status'] ?? ''),
        'customer_id' => (int) ($record['customer_id'] ?? 0),
        'payment_result' => array('payment_status' => 'success'),
    );
}
