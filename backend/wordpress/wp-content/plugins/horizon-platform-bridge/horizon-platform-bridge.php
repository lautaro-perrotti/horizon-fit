<?php
/**
 * Plugin Name: Horizon Platform Bridge
 * Description: Publishes versioned storefront documents while WooCommerce owns cart, stock and checkout.
 * Version: 0.1.0
 */
if (!defined('ABSPATH')) exit;

function horizon_platform_release_permission() {
    return current_user_can('manage_options');
}
add_action('rest_api_init', function () {
    register_rest_route('horizon-platform/v1', '/releases', array(
        'methods' => 'POST', 'permission_callback' => 'horizon_platform_release_permission',
        'callback' => 'horizon_platform_receive_release',
    ));
    register_rest_route('horizon-platform/v1', '/status', array(
        'methods' => 'GET', 'permission_callback' => 'horizon_platform_release_permission',
        'callback' => function () { return rest_ensure_response(array('active' => get_option('horizon_platform_active_release', null), 'woocommerce' => defined('WC_VERSION') ? WC_VERSION : null)); },
    ));
});

function horizon_platform_validate_page($page) {
    if (!is_array($page) || !isset($page['path'], $page['html']) || !is_string($page['path']) || !is_string($page['html'])) return false;
    if (!preg_match('~^/(?:[a-z0-9-]+/)*$~D', $page['path'])) return false;
    // Transactional and identity routes always remain owned by WooCommerce/WordPress.
    if (preg_match('~^/(?:checkout|cart|carrito|mi-cuenta|my-account|wp-admin|wp-json|product|producto|shop|coleccion)(?:/|$)~', $page['path'])) return false;
    if (strlen($page['html']) > 300000 || !class_exists('DOMDocument')) return false;
    $dom = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $loaded = $dom->loadHTML($page['html'], LIBXML_NONET);
    libxml_clear_errors(); libxml_use_internal_errors($previous);
    if (!$loaded) return false;
    $tags = array('html','head','meta','title','link','style','body','header','nav','main','section','div','h1','h2','h3','p','span','a','img','footer');
    $attrs = array('lang','charset','name','content','rel','href','src','alt','loading','decoding','class','data-node-id','data-block-id','data-block');
    foreach ($dom->getElementsByTagName('*') as $node) {
        if (!in_array(strtolower($node->nodeName), $tags, true)) return false;
        foreach ($node->attributes as $attr) {
            if (!in_array(strtolower($attr->name), $attrs, true)) return false;
            if (in_array(strtolower($attr->name), array('href','src'), true) && !preg_match('~^(?:https?://[^\s]+|/(?!/)[^\s]*|\#[\w-]*|)$~iD', $attr->value)) return false;
        }
        if ($node->nodeName === 'meta' && $node->hasAttribute('http-equiv')) return false;
        if ($node->nodeName === 'link' && $node->getAttribute('rel') !== 'canonical') return false;
        if ($node->nodeName === 'style' && preg_match('~url\s*\(|@import|expression|\\\\~i', $node->textContent)) return false;
    }
    return true;
}

function horizon_platform_receive_release(WP_REST_Request $request) {
    $data = $request->get_json_params();
    if (!is_array($data) || !isset($data['releaseId'], $data['pages'], $data['document']) || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', (string)$data['releaseId']) || !is_array($data['pages']) || count($data['pages']) > 30 || !count($data['pages'])) return new WP_Error('invalid_release', 'Invalid release', array('status'=>400));
    $paths = array();
    foreach ($data['pages'] as $page) {
        if (!horizon_platform_validate_page($page) || isset($paths[$page['path']])) return new WP_Error('invalid_page', 'Invalid storefront page', array('status'=>400));
        $paths[$page['path']] = true;
    }
    if (!isset($paths['/'])) return new WP_Error('missing_home', 'Home is required', array('status'=>400));
    $uploads = wp_upload_dir();
    $base = trailingslashit($uploads['basedir']) . 'horizon-platform/' . $data['releaseId'];
    if (file_exists($base)) return new WP_Error('release_exists', 'Release already exists', array('status'=>409));
    if (!wp_mkdir_p($base)) return new WP_Error('write_failed', 'Could not create release', array('status'=>500));
    foreach ($data['pages'] as $page) {
        $dir = $base . $page['path'];
        if (!wp_mkdir_p($dir) || file_put_contents(trailingslashit($dir).'index.html', $page['html'], LOCK_EX) === false) return new WP_Error('write_failed', 'Previous release preserved', array('status'=>500));
    }
    if (file_put_contents($base.'/document.json', wp_json_encode($data['document']), LOCK_EX) === false) return new WP_Error('write_failed', 'Previous release preserved', array('status'=>500));
    // Readers switch only after every artifact has been written successfully.
    update_option('horizon_platform_active_release', array('id'=>$data['releaseId'], 'revision'=>absint($data['revision'] ?? 0), 'paths'=>array_keys($paths)), false);
    return rest_ensure_response(array('published'=>true,'releaseId'=>$data['releaseId']));
}

add_action('template_redirect', function () {
    if (is_admin() || is_feed() || is_preview() || isset($_GET['add-to-cart']) || (function_exists('is_checkout') && (is_checkout() || is_cart() || is_account_page()))) return;
    $active = get_option('horizon_platform_active_release', null);
    if (!$active) return;
    $request_path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = '/' . trim((string)$request_path, '/') . '/'; if ($path === '//') $path = '/';
    if (!in_array($path, $active['paths'], true)) return;
    $uploads = wp_upload_dir(); $file = trailingslashit($uploads['basedir']).'horizon-platform/'.$active['id'].$path.'index.html';
    if (!is_readable($file)) return;
    status_header(200); header('Content-Type: text/html; charset=UTF-8'); header('X-Content-Type-Options: nosniff'); header('Cache-Control: no-cache');
    readfile($file); exit;
}, 1);

// Product values in published pages are refreshed on product writes; no model is involved.
add_action('woocommerce_update_product', 'horizon_platform_refresh_product', 50);
function horizon_platform_refresh_product($product_id) {
    $active=get_option('horizon_platform_active_release',null); if (!$active || !class_exists('DOMDocument')) return;
    $uploads=wp_upload_dir(); $base=trailingslashit($uploads['basedir']).'horizon-platform/'.$active['id'];
    $raw=@file_get_contents($base.'/document.json'); $document=$raw ? json_decode($raw,true) : null; if (!$document) return;
    $product=wc_get_product($product_id); if (!$product) return;
    foreach ($document['pages'] as $page) {
        $bindings=array(); foreach ($page['blocks'] as $block) foreach ($block['nodes'] as $node) if (isset($node['binding']) && (int)$node['binding']['productId']===(int)$product_id) $bindings[$node['id']]=$node['binding']['field'];
        if (!$bindings) continue;
        $file=$base.$page['path'].'index.html'; $html=@file_get_contents($file); if (!$html) continue;
        $dom=new DOMDocument(); $previous=libxml_use_internal_errors(true); $dom->loadHTML($html,LIBXML_NONET); libxml_clear_errors(); libxml_use_internal_errors($previous);
        foreach ($dom->getElementsByTagName('*') as $element) {
            $id=$element->getAttribute('data-node-id'); if (!isset($bindings[$id])) continue;
            if ($bindings[$id]==='image') $element->setAttribute('src',wp_get_attachment_url($product->get_image_id()) ?: '');
            else { while($element->firstChild) $element->removeChild($element->firstChild); $element->appendChild($dom->createTextNode($bindings[$id]==='name' ? $product->get_name() : get_woocommerce_currency().' '.$product->get_price())); }
        }
        $temporary=$file.'.tmp-'.wp_generate_uuid4(); if (file_put_contents($temporary,$dom->saveHTML(),LOCK_EX)!==false) rename($temporary,$file);
    }
}
