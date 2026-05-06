<?php
if (! defined('ABSPATH')) {
    exit;
}

function hf_commerce_storefront_source_path() {
    $env_path = getenv('HF_STOREFRONT_SOURCE_PATH');
    if ($env_path && file_exists($env_path) && is_readable($env_path)) {
        return $env_path;
    }

    $candidates = array(
        ABSPATH . 'hf-storefront-source/index.html',
        dirname(__FILE__, 7) . '/index.html',
    );

    foreach ($candidates as $candidate) {
        if (file_exists($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }

    return dirname(__FILE__, 7) . '/index.html';
}

function hf_commerce_parse_storefront_blueprint() {
    $path = hf_commerce_storefront_source_path();
    if (! file_exists($path) || ! is_readable($path)) {
        return array(
            'products'    => array(),
            'collections' => array(),
            'categories'  => array(),
        );
    }

    $html = file_get_contents($path);
    if (! $html) {
        return array(
            'products'    => array(),
            'collections' => array(),
            'categories'  => array(),
        );
    }

    $products    = array();
    $collections = array();
    $categories  = array();

    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);

    $product_nodes = $xpath->query("//article[contains(concat(' ', normalize-space(@class), ' '), ' hf-product-item--slider ')]");
    foreach ($product_nodes as $node) {
        $title = hf_commerce_dom_node_text($xpath, ".//*[contains(concat(' ', normalize-space(@class), ' '), ' hf-product-item__title ')]", $node);
        if (! $title || isset($products[ $title ])) {
            continue;
        }

        $price   = hf_commerce_dom_node_text($xpath, ".//*[contains(concat(' ', normalize-space(@class), ' '), ' hf-product-item__price ')]", $node);
        $compare = hf_commerce_dom_node_text($xpath, ".//*[contains(concat(' ', normalize-space(@class), ' '), ' hf-product-item__price-original ')]", $node);
        $images  = array();
        $sizes   = array();

        foreach ($xpath->query(".//*[contains(concat(' ', normalize-space(@class), ' '), ' hf-product-item__slide ')]//img", $node) as $image_node) {
            $src = trim((string) $image_node->getAttribute('src'));
            if ($src) {
                $images[] = $src;
            }
        }

        foreach ($xpath->query(".//*[contains(concat(' ', normalize-space(@class), ' '), ' hf-product-item__size ')]", $node) as $size_node) {
            $size = trim(html_entity_decode($size_node->textContent, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($size) {
                $sizes[] = $size;
            }
        }

        $products[ $title ] = array(
            'title'   => $title,
            'price'   => $price,
            'compare' => $compare,
            'images'  => array_values(array_unique($images)),
            'sizes'   => ! empty($sizes) ? array_values(array_unique($sizes)) : array('S', 'M', 'L'),
        );
    }

    $collection_nodes = $xpath->query("//article[contains(concat(' ', normalize-space(@class), ' '), ' hf-set-desktop-slider__slide ')]");
    foreach ($collection_nodes as $node) {
        $title = trim(html_entity_decode((string) $node->getAttribute('data-title'), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if (! $title) {
            continue;
        }

        $image_node = $xpath->query('.//img', $node)->item(0);
        $collections[ $title ] = array(
            'title'   => $title,
            'meta'    => trim(html_entity_decode((string) $node->getAttribute('data-meta'), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
            'items'   => array_values(array_filter(array_map('trim', explode('|', html_entity_decode((string) $node->getAttribute('data-items'), ENT_QUOTES | ENT_HTML5, 'UTF-8'))))),
            'price'   => trim(html_entity_decode((string) $node->getAttribute('data-price'), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
            'compare' => trim(html_entity_decode((string) $node->getAttribute('data-compare'), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
            'image'   => $image_node ? trim((string) $image_node->getAttribute('src')) : '',
        );
    }

    $category_nodes = $xpath->query("//a[contains(concat(' ', normalize-space(@class), ' '), ' hf-category-card ')]");
    foreach ($category_nodes as $node) {
        $title_node = $xpath->query(".//*[contains(concat(' ', normalize-space(@class), ' '), ' hf-category-card__title ')]", $node)->item(0);
        $image_node = $xpath->query('.//img', $node)->item(0);
        $name       = $title_node ? trim(html_entity_decode($title_node->textContent, ENT_QUOTES | ENT_HTML5, 'UTF-8')) : '';
        if (! $name) {
            continue;
        }

        $categories[ $name ] = array(
            'name'  => $name,
            'image' => $image_node ? trim((string) $image_node->getAttribute('src')) : '',
        );
    }

    return array(
        'products'    => array_values($products),
        'collections' => array_values($collections),
        'categories'  => array_values($categories),
    );
}

function hf_commerce_dom_node_text($xpath, $expression, $context = null) {
    $node = $xpath->query($expression, $context)->item(0);
    if (! $node) {
        return '';
    }

    return trim(html_entity_decode($node->textContent, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}
