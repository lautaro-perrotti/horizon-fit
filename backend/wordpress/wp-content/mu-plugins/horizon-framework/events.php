<?php
/** Identity-only cache events: sign, verify, then rebuild. */
if (!defined('ABSPATH')) exit;

function hf_framework_signing_string($timestamp, $raw_body) {
    return $timestamp . '.' . $raw_body;
}

function hf_framework_sign($secret, $timestamp, $raw_body) {
    return hash_hmac('sha256', hf_framework_signing_string($timestamp, $raw_body), $secret);
}

function hf_framework_signature_matches($expected, $received) {
    return is_string($expected) && is_string($received) && $expected !== '' && hash_equals($expected, $received);
}

function hf_framework_event_payload($event, $resource, $id = null, $slug = null, $delivery_id = null) {
    return array(
        'event' => $event,
        'resource' => $resource,
        'id' => $id === null ? null : (string) $id,
        'slug' => $slug === null ? null : (string) $slug,
        'changedAt' => gmdate('c'),
        'deliveryId' => $delivery_id ?: bin2hex(random_bytes(16)),
    );
}

function hf_framework_encode_event($payload) {
    return (string) (function_exists('wp_json_encode') ? wp_json_encode($payload) : json_encode($payload));
}

function hf_framework_closed_events() {
    return array(
        'product.created', 'product.updated', 'product.deleted',
        'product-category.created', 'product-category.updated', 'product-category.deleted',
        'settings.updated',
    );
}

function hf_framework_event_shape_error($payload) {
    if (!is_array($payload)) return 'invalid_shape';
    foreach (array('price', 'email', 'sku', 'token', 'password', 'customer') as $leaked) {
        if (array_key_exists($leaked, $payload)) return 'leaked_data';
    }
    if (!in_array($payload['event'] ?? '', hf_framework_closed_events(), true)) return 'unknown_event';
    if (!isset($payload['resource'], $payload['deliveryId']) || !is_string($payload['deliveryId']) || $payload['deliveryId'] === '') return 'invalid_shape';
    return null;
}

function hf_framework_receive_event($secret, $timestamp, $raw_body, $signature, $now, array $claimed, $freshness = 300, $replay_ttl = 600) {
    if (!is_string($secret) || $secret === '') return array('ok' => false, 'reason' => 'missing_secret', 'claimed' => $claimed);
    if (!hf_framework_signature_matches(hf_framework_sign($secret, (string) $timestamp, (string) $raw_body), (string) $signature)) {
        return array('ok' => false, 'reason' => 'invalid_signature', 'claimed' => $claimed);
    }
    $age = abs((int) $now - (int) $timestamp);
    if ($age > $freshness) return array('ok' => false, 'reason' => 'stale', 'claimed' => $claimed);
    $payload = json_decode((string) $raw_body, true);
    $shape = hf_framework_event_shape_error($payload);
    if ($shape) return array('ok' => false, 'reason' => $shape, 'claimed' => $claimed);
    $delivery = $payload['deliveryId'];
    if (isset($claimed[$delivery]) && ((int) $now - (int) $claimed[$delivery]) < $replay_ttl) {
        return array('ok' => true, 'duplicate' => true, 'payload' => $payload, 'claimed' => $claimed);
    }
    $claimed[$delivery] = (int) $now;
    return array('ok' => true, 'duplicate' => false, 'payload' => $payload, 'claimed' => $claimed);
}
