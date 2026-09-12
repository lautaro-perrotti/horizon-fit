<?php
/** Public booleans vs privileged diagnostics. Configured is not verified. */
if (!defined('ABSPATH')) exit;

function hf_framework_public_capabilities($input) {
    $tracking = is_array($input['tracking'] ?? null) ? $input['tracking'] : array();
    $enabled = !empty($tracking['enabled']);
    $store_api = !empty($input['storeApi']);
    return array(
        'manifestVersion' => 1,
        'platform' => array(
            'wordpress' => !empty($input['wordpress']),
            'woocommerce' => !empty($input['woocommerce']),
        ),
        'commerce' => array(
            'storeApi' => $store_api,
            'cart' => $store_api,
            'checkout' => $store_api,
        ),
        'tracking' => array(
            'ga4' => $enabled && !empty($tracking['ga4Id']),
            'googleAds' => $enabled && !empty($tracking['googleAdsId']),
            'metaPixel' => $enabled && !empty($tracking['metaPixelId']),
            'metaCapi' => $enabled && !empty($tracking['metaPixelId']) && !empty($input['metaCapiToken']),
        ),
        'merchant' => array(
            'feed' => !empty($input['merchantFeed']),
        ),
    );
}

function hf_framework_integration_status($configured) {
    return array('configured' => (bool) $configured, 'verified' => false);
}

function hf_framework_diagnostics_from($input) {
    $capabilities = hf_framework_public_capabilities($input);
    return array(
        'name' => (string) ($input['name'] ?? ''),
        'origin' => (string) ($input['origin'] ?? ''),
        'capabilities' => $capabilities,
        'cache' => is_array($input['cache'] ?? null) ? $input['cache'] : array(),
        'integrations' => array(
            'ga4' => hf_framework_integration_status($capabilities['tracking']['ga4']),
            'googleAds' => hf_framework_integration_status($capabilities['tracking']['googleAds']),
            'metaPixel' => hf_framework_integration_status($capabilities['tracking']['metaPixel']),
            'metaCapi' => hf_framework_integration_status($capabilities['tracking']['metaCapi']),
            'merchantFeed' => hf_framework_integration_status($capabilities['merchant']['feed']),
        ),
        'secrets' => array(
            'webhook' => !empty($input['webhookSecret']),
            'metaCapi' => !empty($input['metaCapiToken']),
        ),
        'note' => 'configured is not connected. verified stays false until a live credential check.',
    );
}
