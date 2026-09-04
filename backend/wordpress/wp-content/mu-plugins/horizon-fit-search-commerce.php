<?php
/**
 * Horizon Fit — Search + Merchant groundwork.
 *
 * Runs after the storefront SEO cache has been generated and improves:
 * - product/category/home titles and meta descriptions;
 * - ProductGroup variant semantics in JSON-LD;
 * - a normalized Merchant-ready JSON/TSV source generated from WooCommerce.
 *
 * This file does not submit products to Google Merchant Center. It only builds
 * deterministic artifacts from the same WooCommerce data used by the storefront.
 */

if (! defined('ABSPATH')) {
    exit;
}

function hf_search_text($value) {
    $value = html_entity_decode(wp_strip_all_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $value));
}

function hf_search_excerpt($value, $limit = 158) {
    $value = hf_search_text($value);
    if ($value === '') {
        return '';
    }
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($value, 'UTF-8') <= $limit) {
            return $value;
        }
        return rtrim(mb_substr($value, 0, max(1, $limit - 1), 'UTF-8')) . '…';
    }
    if (strlen($value) <= $limit) {
        return $value;
    }
    return rtrim(substr($value, 0, max(1, $limit - 1))) . '…';
}

function hf_search_strlen($value) {
    return function_exists('mb_strlen') ? mb_strlen((string) $value, 'UTF-8') : strlen((string) $value);
}

function hf_search_contains($haystack, $needle) {
    if ($needle === '') {
        return false;
    }
    if (function_exists('mb_stripos')) {
        return false !== mb_stripos((string) $haystack, (string) $needle, 0, 'UTF-8');
    }
    return false !== stripos((string) $haystack, (string) $needle);
}

function hf_search_useful_copy($value) {
    $value = hf_search_text($value);
    if (hf_search_strlen($value) < 70) {
        return false;
    }
    $words = preg_split('/\s+/u', $value);
    if (count(array_filter($words)) < 10) {
        return false;
    }
    return ! preg_match('/^(.)\1{8,}$/u', preg_replace('/\s+/u', '', $value));
}

function hf_search_product_name($product) {
    if (! $product || ! is_a($product, 'WC_Product')) {
        return '';
    }
    if (function_exists('hf_storefront_display_name')) {
        return hf_storefront_display_name($product);
    }
    if (function_exists('hf_catalog_display_name')) {
        return hf_catalog_display_name($product->get_name());
    }
    return trim((string) $product->get_name());
}

function hf_search_term_label($term) {
    $map = array(
        'calzas' => 'Calzas Deportivas para Mujer',
        'tops' => 'Tops Deportivos para Mujer',
        'shorts' => 'Shorts Deportivos para Mujer',
        'camperas' => 'Camperas Deportivas para Mujer',
        'faldas' => 'Faldas Deportivas para Mujer',
        'conjuntos' => 'Conjuntos Deportivos para Mujer',
        'remeras' => 'Remeras Deportivas para Mujer',
        'musculosas' => 'Musculosas Deportivas para Mujer',
        'buzos' => 'Buzos Deportivos para Mujer',
        'pantalones' => 'Pantalones Deportivos para Mujer',
        'accesorios' => 'Accesorios Deportivos',
    );
    $slug = is_object($term) && isset($term->slug) ? strtolower((string) $term->slug) : '';
    return $map[$slug] ?? (is_object($term) && isset($term->name) ? (string) $term->name : 'Activewear');
}

function hf_search_substr($value, $start, $length) {
    if (function_exists('mb_substr')) {
        return mb_substr((string) $value, (int) $start, (int) $length, 'UTF-8');
    }
    return substr((string) $value, (int) $start, (int) $length);
}

function hf_search_excerpt_phrase($value, $target = 155, $hard_limit = 158) {
    $value = hf_search_text($value);
    if ($value === '') {
        return '';
    }
    $length = hf_search_strlen($value);
    if ($length <= $hard_limit) {
        return $value;
    }

    $sentences = hf_search_sentences($value);
    $acc = '';
    foreach ($sentences as $sentence) {
        $candidate = hf_search_text(trim($acc . ' ' . $sentence));
        if (hf_search_strlen($candidate) <= $hard_limit) {
            $acc = $candidate;
            if (hf_search_strlen($acc) >= $target) {
                return $acc;
            }
            continue;
        }
        if (hf_search_strlen($acc) >= 120) {
            return $acc;
        }
        $window = rtrim(hf_search_substr($candidate, 0, $target));
        $space = function_exists('mb_strrpos')
            ? mb_strrpos($window, ' ', 0, 'UTF-8')
            : strrpos($window, ' ');
        if ($space !== false && $space >= 80) {
            $acc = rtrim(hf_search_substr($window, 0, $space), " \t,;:.—-");
        } else {
            $acc = rtrim($window, " \t,;:.—-");
        }
        break;
    }

    if ($acc === '') {
        $window = rtrim(hf_search_substr($value, 0, $target));
        $space = function_exists('mb_strrpos')
            ? mb_strrpos($window, ' ', 0, 'UTF-8')
            : strrpos($window, ' ');
        if ($space !== false && $space >= 80) {
            $acc = rtrim(hf_search_substr($window, 0, $space), " \t,;:.—-");
        } else {
            $acc = rtrim($window, " \t,;:.—-");
        }
    }

    if ($acc === '') {
        $acc = rtrim(hf_search_substr($value, 0, $target));
    }
    return hf_search_strlen($acc) <= $hard_limit ? $acc : rtrim(hf_search_substr($acc, 0, $hard_limit));
}

function hf_search_sentences($value) {
    $value = hf_search_text($value);
    if ($value === '') {
        return array();
    }
    $parts = preg_split('/(?<=[\.\!\?…])\s+/u', $value, -1, PREG_SPLIT_NO_EMPTY);
    return array_values(array_filter(array_map('trim', $parts)));
}

function hf_search_product_color_value($product) {
    if (function_exists('hf_storefront_product_color')) {
        $color = hf_storefront_product_color($product);
        if ($color !== '') {
            return $color;
        }
    }
    $color = hf_search_attribute_text($product, hf_search_color_attribute_keys());
    if ($color !== '') {
        return $color;
    }
    return function_exists('hf_merchant_detect_color_from_text')
        ? hf_merchant_detect_color_from_text(hf_search_product_name($product))
        : '';
}

function hf_search_product_size_values($product) {
    if (function_exists('hf_storefront_product_sizes')) {
        $sizes = hf_storefront_product_sizes($product);
        if ($sizes) {
            return array_values($sizes);
        }
    }
    $raw = hf_search_attribute_text($product, hf_search_size_attribute_keys());
    if ($raw === '') {
        return array();
    }
    return array_values(array_filter(array_map('trim', preg_split('/\s*[,|\/]\s*/u', $raw))));
}

function hf_search_is_placeholder_copy($value) {
    return (bool) preg_match('/\b(lorem ipsum|placeholder|texto de prueba|test product)\b/iu', (string) $value);
}

function hf_search_is_placeholder_title($value) {
    return (bool) preg_match('/\b(lorem ipsum|placeholder|texto de prueba|test product|copia|copy|demo)\b/iu', (string) $value);
}

function hf_search_product_title($product) {
    $name = hf_search_product_name($product);
    if ($name === '') {
        return 'Horizon Fit';
    }
    $base = $name . ' | Horizon Fit';
    if (hf_search_strlen($base) <= 65) {
        return $base;
    }
    return hf_search_excerpt_phrase($base, 62, 65);
}

function hf_search_product_meta_description($product) {
    $name = hf_search_product_name($product);
    $long = hf_search_text($product->get_description());
    $short = hf_search_text($product->get_short_description());
    $source = '';
    if (hf_search_useful_copy($long) && ! hf_search_is_placeholder_copy($long)) {
        $source = $long;
    } elseif (hf_search_useful_copy($short) && ! hf_search_is_placeholder_copy($short)) {
        $source = $short;
    }

    if ($source !== '') {
        $sentences = hf_search_sentences($source);
        $lead = $name;
        $color = hf_search_product_color_value($product);
        if ($color !== '' && ! hf_search_contains($name, $color) && ! hf_search_contains($lead, $color)) {
            $lead .= ' en color ' . $color;
        }
        $pieces = array();
        if ($name !== '' && (empty($sentences) || ! hf_search_contains($sentences[0], $name))) {
            $pieces[] = rtrim($lead, '.') . '.';
        }
        foreach ($sentences as $sentence) {
            if ($sentence === '') {
                continue;
            }
            if (hf_search_contains(implode(' ', $pieces), $sentence)) {
                continue;
            }
            $pieces[] = $sentence;
            $candidate = hf_search_text(implode(' ', $pieces));
            if (hf_search_strlen($candidate) >= 120) {
                break;
            }
        }
        $meta = hf_search_text(implode(' ', $pieces));
        $horizon_count = preg_match_all('/horizon fit/iu', $meta);
        if ($horizon_count > 1) {
            $meta = preg_replace('/\s*de Horizon Fit\b/iu', '', $meta, 1);
            $meta = hf_search_text($meta);
        }
        return hf_search_excerpt_phrase($meta, 155, 158);
    }

    $parts = array();
    $lead = $name !== '' ? $name : 'Prenda Horizon Fit';
    $color = hf_search_product_color_value($product);
    if ($color !== '' && ! hf_search_contains($lead, $color)) {
        $lead .= ' en color ' . $color;
    }
    $parts[] = $lead;
    $sizes = hf_search_product_size_values($product);
    if ($sizes) {
        $parts[] = 'Disponible en talles ' . implode(', ', array_slice($sizes, 0, 6));
    }
    return hf_search_excerpt_phrase(implode('. ', $parts) . '.', 155, 158);
}

function hf_search_product_description($product) {
    return hf_search_product_meta_description($product);
}

function hf_merchant_compose_title($name, $color, $size) {
    $title_parts = array(trim((string) $name));
    $color = trim((string) $color);
    $size = trim((string) $size);
    if ($color !== '' && ! hf_search_contains($name, $color)) {
        $title_parts[] = $color;
    }
    if ($size !== '') {
        $title_parts[] = 'Talle ' . $size;
    }
    return hf_search_excerpt_phrase(implode(' - ', array_filter($title_parts)), 147, 150);
}

function hf_merchant_product_title($product, $item = null) {
    $item = ($item && is_a($item, 'WC_Product')) ? $item : $product;
    if (! $product || ! is_a($product, 'WC_Product')) {
        return '';
    }
    $name = hf_search_product_name($product);
    $size = hf_search_attribute_text($item, hf_search_size_attribute_keys());
    $color = hf_search_attribute_text($item, hf_search_color_attribute_keys());
    if ($color === '' && function_exists('hf_storefront_product_color')) {
        $color = hf_storefront_product_color($product);
    }
    if ($color === '') {
        $color = hf_merchant_detect_color_from_text($name . ' ' . trim((string) $product->get_name()));
        if ($color === '') {
            $color = hf_merchant_detect_color_from_sku(trim((string) $item->get_sku()) . '-' . trim((string) $product->get_sku()));
        }
    }
    return hf_merchant_compose_title($name, $color, $size);
}

function hf_search_size_attribute_keys() {
    return array('pa_talle', 'talle', 'Talle', 'pa_size', 'size', 'Size');
}

function hf_search_color_attribute_keys() {
    return array('pa_color', 'color', 'Color', 'pa_colour', 'colour', 'Colour');
}

function hf_search_attribute_text($product, $keys) {
    if (! $product || ! is_a($product, 'WC_Product')) {
        return '';
    }
    foreach ((array) $keys as $key) {
        $value = $product->get_attribute($key);
        if (is_array($value)) {
            $value = implode(', ', array_filter(array_map(static function ($part) {
                return trim((string) $part);
            }, $value)));
        } else {
            $value = trim((string) $value);
        }
        if ($value === '') {
            continue;
        }
        $taxonomy = 0 === strpos((string) $key, 'pa_') ? (string) $key : '';
        if ($taxonomy && taxonomy_exists($taxonomy)) {
            $term = get_term_by('slug', $value, $taxonomy);
            if ($term && ! is_wp_error($term)) {
                return (string) $term->name;
            }
        }
        return $value;
    }
    return '';
}

function hf_search_sku_segments($sku) {
    $sku = strtoupper(trim((string) $sku));
    if ($sku === '') {
        return array();
    }
    return array_values(array_filter(array_map('trim', preg_split('/\s*-\s*/', $sku)), 'strlen'));
}

function hf_search_item_group_id($product) {
    if (! $product || ! is_a($product, 'WC_Product')) {
        return '';
    }

    $sku = trim((string) $product->get_sku());
    if ($sku !== '' && function_exists('hf_product_parent_sku_base_from_variation_sku')) {
        $base = hf_product_parent_sku_base_from_variation_sku($sku);
        if ($base !== '') {
            return $base;
        }
    }
    if ($sku !== '') {
        return strtoupper($sku);
    }

    if ($product->is_type('variable') && function_exists('hf_product_parent_sku_derive_from_variations')) {
        $base = hf_product_parent_sku_derive_from_variations($product);
        if ($base !== '') {
            return $base;
        }
    }

    return 'HF-P' . $product->get_id();
}

function hf_search_category_title($term) {
    $candidate = hf_search_term_label($term) . ' | Horizon Fit';
    return hf_search_strlen($candidate) <= 65 ? $candidate : hf_search_excerpt($candidate, 65);
}

function hf_search_category_description($term) {
    $existing = is_object($term) && isset($term->description) ? (string) $term->description : '';
    if (hf_search_useful_copy($existing)) {
        return hf_search_excerpt($existing, 158);
    }
    $label = strtolower(hf_search_term_label($term));
    return hf_search_excerpt('Descubrí ' . $label . ' de Horizon Fit. Explorá modelos, colores y talles disponibles y encontrá activewear pensado para entrenar y vivir en movimiento.', 158);
}

function hf_search_replace_head($html, $title, $description) {
    $title_html = esc_html($title);
    $description_attr = esc_attr($description);
    $html = preg_replace('/<title>.*?<\/title>/is', '<title>' . $title_html . '</title>', $html, 1);

    $replacements = array(
        'hfMetaDescription' => '<meta id="hfMetaDescription" name="description" content="' . $description_attr . '" />',
        'hfOgTitle' => '<meta id="hfOgTitle" property="og:title" content="' . esc_attr($title) . '" />',
        'hfOgDescription' => '<meta id="hfOgDescription" property="og:description" content="' . $description_attr . '" />',
        'hfTwitterTitle' => '<meta id="hfTwitterTitle" name="twitter:title" content="' . esc_attr($title) . '" />',
        'hfTwitterDescription' => '<meta id="hfTwitterDescription" name="twitter:description" content="' . $description_attr . '" />',
    );

    foreach ($replacements as $id => $replacement) {
        $html = preg_replace('/<meta\s+id="' . preg_quote($id, '/') . '"[^>]*>/i', $replacement, $html, 1);
    }
    return $html;
}

function hf_search_variation_dimensions($product) {
    $values = array('size' => array(), 'color' => array(), 'material' => array(), 'pattern' => array());
    $variation_map = array();
    if (! $product || ! is_a($product, 'WC_Product') || ! $product->is_type('variable')) {
        return array('variesBy' => array(), 'variations' => array());
    }

    foreach ($product->get_children() as $variation_id) {
        $variation = wc_get_product($variation_id);
        if (! $variation || 'publish' !== $variation->get_status()) {
            continue;
        }
        $size = hf_search_attribute_text($variation, hf_search_size_attribute_keys());
        $color = hf_search_attribute_text($variation, hf_search_color_attribute_keys());
        $material = hf_search_attribute_text($variation, array('pa_material', 'material'));
        $pattern = hf_search_attribute_text($variation, array('pa_pattern', 'pattern', 'pa_estampa', 'estampa'));
        foreach (array('size' => $size, 'color' => $color, 'material' => $material, 'pattern' => $pattern) as $key => $value) {
            if ($value !== '') {
                $values[$key][] = $value;
            }
        }
        $dimension = array_filter(array(
            'size' => $size,
            'color' => $color,
            'material' => $material,
            'pattern' => $pattern,
        ));
        $sku = trim((string) $variation->get_sku());
        if ($sku !== '') {
            $variation_map[$sku] = $dimension;
        }
        $variation_map['id:' . $variation->get_id()] = $dimension;
    }

    $varies_by = array();
    foreach ($values as $key => $dimension_values) {
        if (count(array_unique($dimension_values)) > 1) {
            $varies_by[] = 'https://schema.org/' . $key;
        }
    }
    return array('variesBy' => $varies_by, 'variations' => $variation_map);
}

function hf_search_patch_product_schema($html, $product, $description) {
    if (! preg_match('/<script\s+id="hfSeoJsonLd"[^>]*>([\s\S]*?)<\/script>/i', $html, $match)) {
        return $html;
    }
    $schema = json_decode(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), true);
    if (! is_array($schema) || empty($schema['@graph']) || ! is_array($schema['@graph'])) {
        return $html;
    }

    $dimensions = hf_search_variation_dimensions($product);
    $group_id = hf_search_item_group_id($product);

    foreach ($schema['@graph'] as &$node) {
        if (! is_array($node)) {
            continue;
        }
        $type = $node['@type'] ?? '';
        if (in_array($type, array('Product', 'ProductGroup'), true) && isset($node['description'])) {
            $node['description'] = $description;
        }
        if ('ProductGroup' !== $type || empty($node['hasVariant']) || ! is_array($node['hasVariant'])) {
            continue;
        }
        $node['productGroupID'] = $group_id;
        if (! empty($dimensions['variesBy'])) {
            $node['variesBy'] = $dimensions['variesBy'];
        }
        foreach ($node['hasVariant'] as &$variant_node) {
            if (! is_array($variant_node)) {
                continue;
            }
            $sku = isset($variant_node['sku']) ? (string) $variant_node['sku'] : '';
            $variation_id = '';
            if (! empty($variant_node['@id']) && preg_match('/#variation-(\d+)/', (string) $variant_node['@id'], $id_match)) {
                $variation_id = 'id:' . $id_match[1];
            }
            $dimension = array();
            if ($sku !== '' && ! empty($dimensions['variations'][$sku])) {
                $dimension = $dimensions['variations'][$sku];
            } elseif ($variation_id !== '' && ! empty($dimensions['variations'][$variation_id])) {
                $dimension = $dimensions['variations'][$variation_id];
            }
            foreach ($dimension as $key => $value) {
                $variant_node[$key] = $value;
            }
        }
        unset($variant_node);
    }
    unset($node);

    $json = wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return preg_replace('/<script\s+id="hfSeoJsonLd"[^>]*>[\s\S]*?<\/script>/i', '<script id="hfSeoJsonLd" type="application/ld+json">' . $json . '</script>', $html, 1);
}

function hf_search_write_html($path, $title, $description, $product = null) {
    if (! is_readable($path)) {
        return false;
    }
    $html = file_get_contents($path);
    if (! is_string($html) || $html === '') {
        return false;
    }
    $html = hf_search_replace_head($html, $title, $description);
    if ($product && is_a($product, 'WC_Product')) {
        $html = hf_search_patch_product_schema($html, $product, $description);
    }
    return false !== file_put_contents($path, $html, LOCK_EX);
}

function hf_merchant_dir() {
    $uploads = wp_upload_dir();
    $dir = trailingslashit($uploads['basedir']) . 'horizon-fit-merchant';
    if (! is_dir($dir)) {
        wp_mkdir_p($dir);
    }
    return $dir;
}

function hf_merchant_config() {
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $path = __DIR__ . '/config/merchant-category-map.php';
    $loaded = is_readable($path) ? require $path : array();
    if (! is_array($loaded)) {
        $loaded = array();
    }
    if (isset($loaded['categories']) || isset($loaded['sku_types'])) {
        $config = array(
            'categories' => is_array($loaded['categories'] ?? null) ? $loaded['categories'] : array(),
            'sku_types' => is_array($loaded['sku_types'] ?? null) ? $loaded['sku_types'] : array(),
            'merchandising_slugs' => is_array($loaded['merchandising_slugs'] ?? null) ? $loaded['merchandising_slugs'] : array(),
        );
        return $config;
    }
    $config = array(
        'categories' => $loaded,
        'sku_types' => array(),
        'merchandising_slugs' => array('basicos', 'diseno', 'ofertas', 'uncategorized', 'sin-categorizar'),
    );
    return $config;
}

function hf_merchant_default_category_map() {
    return hf_merchant_config()['categories'];
}

function hf_merchant_category_map() {
    $map = hf_merchant_default_category_map();
    $custom = get_option('hf_merchant_category_map', array());
    if (is_array($custom)) {
        foreach ($custom as $slug => $entry) {
            if (! is_string($slug) || ! is_array($entry)) {
                continue;
            }
            $slug = sanitize_title($slug);
            if ($slug === '') {
                continue;
            }
            $map[$slug] = array(
                'product_type' => hf_search_text($entry['product_type'] ?? ''),
                'google_product_category' => hf_search_text($entry['google_product_category'] ?? ''),
                'google_product_category_label' => hf_search_text($entry['google_product_category_label'] ?? ''),
            );
        }
    }
    return apply_filters('hf_merchant_category_map', $map);
}

function hf_merchant_sku_type_map() {
    return apply_filters('hf_merchant_sku_type_map', hf_merchant_config()['sku_types']);
}

function hf_merchant_merchandising_slugs() {
    return hf_merchant_config()['merchandising_slugs'];
}

function hf_merchant_sku_type($product, $item = null) {
    $skus = array();
    if ($item && is_a($item, 'WC_Product')) {
        $skus[] = (string) $item->get_sku();
    }
    if ($product && is_a($product, 'WC_Product')) {
        $skus[] = (string) $product->get_sku();
    }
    foreach ($skus as $sku) {
        $parts = hf_search_sku_segments($sku);
        if (isset($parts[1]) && preg_match('/^[A-Z]{2,4}$/', $parts[1])) {
            return $parts[1];
        }
    }
    return '';
}

function hf_merchant_product_terms($product) {
    $terms = wp_get_post_terms($product->get_id(), 'product_cat');
    if (is_wp_error($terms) || ! $terms) {
        return array();
    }
    usort($terms, static function ($a, $b) {
        return count(get_ancestors($b->term_id, 'product_cat')) <=> count(get_ancestors($a->term_id, 'product_cat'));
    });
    $skip = array_merge(array('uncategorized', 'sin-categorizar'), hf_merchant_merchandising_slugs());
    return array_values(array_filter($terms, static function ($term) use ($skip) {
        return ! in_array($term->slug, $skip, true);
    }));
}

function hf_merchant_product_type_from_term($term) {
    if (! $term || ! is_object($term)) {
        return 'Ropa deportiva mujer';
    }
    $names = array();
    foreach (array_reverse(get_ancestors($term->term_id, 'product_cat')) as $ancestor_id) {
        $ancestor = get_term($ancestor_id, 'product_cat');
        if ($ancestor && ! is_wp_error($ancestor)) {
            $names[] = $ancestor->name;
        }
    }
    $names[] = $term->name;
    return 'Ropa deportiva mujer > ' . implode(' > ', array_filter($names));
}

function hf_merchant_category_mapping($product, $item = null) {
    $sku_type = hf_merchant_sku_type($product, $item);
    $sku_map = hf_merchant_sku_type_map();
    if ($sku_type !== '' && isset($sku_map[$sku_type])) {
        return array_merge(array(
            'term_slug' => strtolower($sku_type),
            'mapped' => true,
            'source' => 'sku_type',
        ), $sku_map[$sku_type]);
    }

    $terms = hf_merchant_product_terms($product);
    $map = hf_merchant_category_map();
    foreach ($terms as $term) {
        $slug = sanitize_title($term->slug);
        if (isset($map[$slug])) {
            return array_merge(array(
                'term_slug' => $slug,
                'mapped' => true,
                'source' => 'category',
            ), $map[$slug]);
        }
    }
    $term = $terms[0] ?? null;
    return array(
        'term_slug' => $term && is_object($term) ? sanitize_title($term->slug) : '',
        'mapped' => false,
        'source' => 'fallback',
        'product_type' => $term ? hf_merchant_product_type_from_term($term) : 'Ropa deportiva mujer',
        'google_product_category' => '',
        'google_product_category_label' => '',
    );
}

function hf_merchant_product_type($product) {
    $mapping = hf_merchant_category_mapping($product);
    return $mapping['product_type'];
}

function hf_merchant_image_urls($product, $parent = null) {
    $image_id = (int) $product->get_image_id();
    $inherited = false;
    if (! $image_id && $parent && is_a($parent, 'WC_Product')) {
        $image_id = (int) $parent->get_image_id();
        $inherited = $image_id > 0;
    }
    $primary = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    $gallery_owner = $parent && is_a($parent, 'WC_Product') ? $parent : $product;
    $additional = array();
    foreach ((array) $gallery_owner->get_gallery_image_ids() as $gallery_id) {
        if ((int) $gallery_id === $image_id) {
            continue;
        }
        $url = wp_get_attachment_image_url((int) $gallery_id, 'full');
        if ($url) {
            $additional[] = $url;
        }
    }
    return array('primary' => $primary ?: '', 'additional' => array_values(array_unique($additional)), 'inherited' => $inherited);
}

function hf_merchant_availability($product) {
    $status = (string) $product->get_stock_status();
    if ('instock' === $status) {
        return 'in_stock';
    }
    if ('onbackorder' === $status) {
        return 'backorder';
    }
    return 'out_of_stock';
}

function hf_merchant_model_name($name) {
    return trim(preg_replace('/\s+(sky blue|blanco|blanca|negro|negra|azul|celeste|verde|rosa|rojo|roja|bordeaux|bord[oó]|gris|beige|marr[oó]n|white|black|blue|green|pink|red|wine)\s*$/iu', '', (string) $name));
}

function hf_merchant_known_colors() {
    return array(
        'blanco' => 'Blanco',
        'blanca' => 'Blanco',
        'white' => 'Blanco',
        'negro' => 'Negro',
        'negra' => 'Negro',
        'black' => 'Negro',
        'azul' => 'Azul',
        'blue' => 'Azul',
        'celeste' => 'Celeste',
        'sky blue' => 'Celeste',
        'skyblue' => 'Celeste',
        'verde' => 'Verde',
        'green' => 'Verde',
        'rosa' => 'Rosa',
        'pink' => 'Rosa',
        'rojo' => 'Rojo',
        'roja' => 'Rojo',
        'red' => 'Rojo',
        'bordeaux' => 'Bordeaux',
        'bordo' => 'Bordeaux',
        'bordó' => 'Bordeaux',
        'wine' => 'Bordeaux',
        'vino' => 'Bordeaux',
        'gris' => 'Gris',
        'gray' => 'Gris',
        'grey' => 'Gris',
        'beige' => 'Beige',
        'marron' => 'Marrón',
        'marrón' => 'Marrón',
        'brown' => 'Marrón',
    );
}

function hf_merchant_sku_color_codes() {
    return array(
        'BLA' => 'Blanco',
        'NEG' => 'Negro',
        'AZU' => 'Azul',
        'CEL' => 'Celeste',
        'VER' => 'Verde',
        'ROS' => 'Rosa',
        'ROJ' => 'Rojo',
        'BOR' => 'Bordeaux',
        'GRI' => 'Gris',
        'BEI' => 'Beige',
        'MAR' => 'Marrón',
    );
}

function hf_merchant_normalize_text($value) {
    $value = strtolower(hf_search_text($value));
    return str_replace(
        array('á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'),
        array('a', 'e', 'i', 'o', 'u', 'u', 'n'),
        $value
    );
}

function hf_merchant_normalize_size($value) {
    $value = strtoupper(trim((string) $value));
    $value = preg_replace('/^(TALLE|SIZE)\s+/i', '', $value);
    $parts = preg_split('/\s*[,\/|]\s*/', $value);
    $parts = array_values(array_filter(array_map('trim', $parts), 'strlen'));
    return $parts ? $parts[0] : '';
}

function hf_merchant_values_equivalent($left, $right, $field = '') {
    $left = hf_search_text($left);
    $right = hf_search_text($right);
    if ($left === '' || $right === '') {
        return $left === $right;
    }
    if ($field === 'size') {
        return hf_merchant_normalize_size($left) === hf_merchant_normalize_size($right);
    }
    $left_n = hf_merchant_normalize_text($left);
    $right_n = hf_merchant_normalize_text($right);
    if ($left_n === $right_n) {
        return true;
    }
    $left_tokens = preg_split('/\s*[,\/|]\s*/', $left_n);
    $right_tokens = preg_split('/\s*[,\/|]\s*/', $right_n);
    return in_array($left_n, $right_tokens, true) || in_array($right_n, $left_tokens, true);
}

function hf_merchant_detect_color_from_text($value) {
    $normalized = hf_merchant_normalize_text($value);
    $colors = hf_merchant_known_colors();
    uksort($colors, static function ($a, $b) {
        return hf_search_strlen($b) <=> hf_search_strlen($a);
    });
    foreach ($colors as $needle => $label) {
        $needle = hf_merchant_normalize_text($needle);
        if (preg_match('/(^|[^a-z0-9])' . preg_quote($needle, '/') . '([^a-z0-9]|$)/u', $normalized)) {
            return $label;
        }
    }
    return '';
}

function hf_merchant_detect_color_from_sku($sku) {
    $parts = hf_search_sku_segments($sku);
    $codes = hf_merchant_sku_color_codes();
    foreach ($parts as $part) {
        if (isset($codes[$part])) {
            return $codes[$part];
        }
    }
    return '';
}

function hf_merchant_issue_rules() {
    static $rules = null;
    if ($rules !== null) {
        return $rules;
    }
    $path = __DIR__ . '/config/merchant-issue-rules.php';
    $loaded = is_readable($path) ? require $path : array();
    $rules = is_array($loaded) ? $loaded : array();
    return $rules;
}

function hf_search_issue_rules() {
    static $rules = null;
    if ($rules !== null) {
        return $rules;
    }
    $path = __DIR__ . '/config/search-issue-rules.php';
    $loaded = is_readable($path) ? require $path : array();
    $rules = is_array($loaded) ? $loaded : array();
    return $rules;
}

function hf_merchant_issue($severity, $code, $message, $field = '') {
    return array_filter(array(
        'severity' => $severity,
        'code' => $code,
        'message' => $message,
        'field' => $field,
    ));
}

function hf_merchant_add_issue(&$issues, $severity, $code, $message, $field = '') {
    $rules = hf_merchant_issue_rules();
    if (isset($rules[$code]['severity'])) {
        $severity = $rules[$code]['severity'];
    }
    $issues[] = hf_merchant_issue($severity, $code, $message, $field);
}

function hf_merchant_has_error($issues) {
    foreach ((array) $issues as $issue) {
        if (($issue['severity'] ?? '') === 'error') {
            return true;
        }
    }
    return false;
}

function hf_merchant_blocking_codes($issues) {
    $rules = hf_merchant_issue_rules();
    $codes = array();
    foreach ((array) $issues as $issue) {
        $code = $issue['code'] ?? '';
        if ($code === '' || $code === 'incomplete_variant') {
            continue;
        }
        if (($issue['severity'] ?? '') === 'error' || ! empty($rules[$code]['blocks_merchant'])) {
            $codes[] = $code;
        }
    }
    return array_values(array_unique($codes));
}

function hf_merchant_gtin_is_valid($gtin) {
    $digits = preg_replace('/\D+/', '', (string) $gtin);
    if (! in_array(strlen($digits), array(8, 12, 13, 14), true)) {
        return false;
    }
    $sum = 0;
    $length = strlen($digits);
    for ($i = 0; $i < $length - 1; $i++) {
        $digit = (int) $digits[$length - 2 - $i];
        $sum += $digit * ($i % 2 === 0 ? 3 : 1);
    }
    $check = (10 - ($sum % 10)) % 10;
    return $check === (int) $digits[$length - 1];
}

function hf_merchant_unique_mpn($sku, $product = null) {
    $sku = trim((string) $sku);
    if ($sku === '') {
        return '';
    }
    $use_sku = true;
    if (function_exists('apply_filters')) {
        $use_sku = (bool) apply_filters('hf_merchant_use_sku_as_mpn', true, $product);
    }
    return $use_sku ? $sku : '';
}

function hf_merchant_identifier_exists($brand, $mpn, $gtin) {
    if (trim((string) $gtin) !== '' || trim((string) $mpn) !== '' || trim((string) $brand) !== '') {
        return '';
    }
    return 'no';
}

function hf_merchant_size_type($item, $parent = null) {
    $haystack = '';
    foreach (array($item, $parent) as $product) {
        if (! $product || ! is_a($product, 'WC_Product')) {
            continue;
        }
        $haystack .= ' ' . $product->get_name();
        $haystack .= ' ' . hf_search_attribute_text($product, array('pa_size_type', 'size_type', 'Size type', 'tipo_talle'));
    }
    $normalized = hf_merchant_normalize_text($haystack);
    foreach (array('maternity', 'petite', 'plus', 'tall', 'big', 'maternidad') as $token) {
        if (preg_match('/(^|[^a-z0-9])' . preg_quote($token, '/') . '([^a-z0-9]|$)/u', $normalized)) {
            return $token === 'maternidad' ? 'maternity' : $token;
        }
    }
    return '';
}

function hf_merchant_stock_issues($item, &$issues) {
    $availability = hf_merchant_availability($item);
    $managing_stock = method_exists($item, 'managing_stock') ? (bool) $item->managing_stock() : false;
    $stock_quantity = method_exists($item, 'get_stock_quantity') ? $item->get_stock_quantity() : null;
    if ('in_stock' === $availability && $managing_stock && $stock_quantity !== null && (int) $stock_quantity <= 0) {
        hf_merchant_add_issue($issues, 'warning', 'incoherent_stock', 'Figura con stock disponible, pero la cantidad administrada es cero o menor.', 'stock');
    }
    if (! $managing_stock && 'in_stock' === $availability) {
        hf_merchant_add_issue($issues, 'info', 'stock_not_managed', 'El producto está publicado con stock disponible, pero no administra cantidad real.', 'stock');
    }
}

function hf_merchant_row($item, $parent = null) {
    $product = $parent && is_a($parent, 'WC_Product') ? $parent : $item;
    $name = hf_search_product_name($product);
    $raw_name = trim((string) $product->get_name());
    $is_variant = $parent && is_a($parent, 'WC_Product');
    $size = hf_search_attribute_text($item, hf_search_size_attribute_keys());
    $color = hf_search_attribute_text($item, hf_search_color_attribute_keys());
    if ($color === '' && function_exists('hf_storefront_product_color')) {
        $color = hf_storefront_product_color($product);
    }
    $detected_color = hf_merchant_detect_color_from_text($name . ' ' . $raw_name);
    $sku_color = hf_merchant_detect_color_from_sku(trim((string) $item->get_sku()) . '-' . trim((string) $product->get_sku()));
    if ($color === '') {
        $color = $detected_color !== '' ? $detected_color : $sku_color;
    }
    $material = hf_search_attribute_text($item, array('pa_material', 'material', 'Material'));
    if ($material === '') {
        $material = hf_search_attribute_text($product, array('pa_material', 'material', 'Material'));
    }
    $category_mapping = hf_merchant_category_mapping($product, $item);

    $title = hf_merchant_compose_title($name, $color, $size);

    $canonical = function_exists('hf_storefront_public_url')
        ? hf_storefront_public_url('producto/' . $product->get_slug() . '/')
        : 'https://horizonfit.com.ar/producto/' . $product->get_slug() . '/';

    $images = hf_merchant_image_urls($item, $parent);
    $sku = trim((string) $item->get_sku());
    $id = $sku !== '' ? $sku : ($is_variant ? 'HF-V' . $item->get_id() : 'HF-P' . $item->get_id());
    $used_fallback_group = false;
    $group_id = '';
    if ($is_variant || $product->is_type('variable')) {
        $group_id = hf_search_item_group_id($product);
        $used_fallback_group = 0 === strpos($group_id, 'HF-P');
    }

    $regular_price = (string) $item->get_regular_price();
    $current_price = (string) $item->get_price();
    $sale_price = (string) $item->get_sale_price();
    $currency = get_woocommerce_currency();
    $price_value = ($sale_price !== '' && $regular_price !== '') ? $regular_price : $current_price;
    $price = $price_value !== '' ? wc_format_decimal($price_value, 2) . ' ' . $currency : '';
    $sale = ($sale_price !== '' && $regular_price !== '') ? wc_format_decimal($sale_price, 2) . ' ' . $currency : '';

    $gtin = '';
    if (method_exists($item, 'get_global_unique_id')) {
        $gtin = trim((string) $item->get_global_unique_id());
    }
    $mpn = hf_merchant_unique_mpn($sku, $product);
    $has_valid_gtin = $gtin !== '' && hf_merchant_gtin_is_valid($gtin);
    $description_long = hf_search_text($product->get_description());
    $description_short = hf_search_text($product->get_short_description());
    if (hf_search_useful_copy($description_long)) {
        $description = hf_search_excerpt($description_long, 4500);
    } elseif (hf_search_useful_copy($description_short)) {
        $description = hf_search_excerpt($description_short, 4500);
    } else {
        $description = $description_long !== '' ? $description_long : ($description_short !== '' ? $description_short : $name);
    }

    $row = array(
        'id' => $id,
        'item_group_id' => $group_id,
        'item_group_title' => $group_id !== '' ? hf_merchant_model_name($name) : '',
        'title' => $title,
        'description' => $description,
        'link' => $canonical,
        'image_link' => $images['primary'],
        'additional_image_link' => $images['additional'][0] ?? '',
        'availability' => hf_merchant_availability($item),
        'price' => $price,
        'sale_price' => $sale,
        'brand' => 'Horizon Fit',
        'condition' => 'new',
        'color' => $color,
        'size' => hf_merchant_normalize_size($size) ?: $size,
        // size_system omitted on purpose: Google has no AR, and S/M/L are
        // standard sizes. Do not send US (or any other system) without evidence.
        'size_system' => '',
        // size_type omitted unless petite/maternity/plus/tall/big is explicit.
        // Google already defaults to regular.
        'size_type' => hf_merchant_size_type($item, $parent),
        'gender' => apply_filters('hf_merchant_default_gender', 'female', $product),
        'age_group' => apply_filters('hf_merchant_default_age_group', 'adult', $product),
        'material' => $material,
        'product_type' => $category_mapping['product_type'],
        'google_product_category' => apply_filters('hf_merchant_google_product_category', $category_mapping['google_product_category'], $product),
        'google_product_category_label' => $category_mapping['google_product_category_label'],
        'gtin' => $has_valid_gtin ? $gtin : '',
        'mpn' => $mpn,
        'identifier_exists' => hf_merchant_identifier_exists('Horizon Fit', $mpn, $has_valid_gtin ? $gtin : ''),
    );

    $issues = array();
    if ($sku === '') {
        hf_merchant_add_issue($issues, 'warning', 'missing_sku', 'Falta SKU interno. El feed usa un ID estable y determinístico (' . $id . ').', 'id');
    }
    if ($row['image_link'] === '') {
        hf_merchant_add_issue($issues, 'error', 'missing_image', 'Falta imagen principal.', 'image_link');
    } elseif (! empty($images['inherited']) && $is_variant) {
        hf_merchant_add_issue($issues, 'warning', 'inherited_image', 'La variante usa la imagen del producto padre; revisar si corresponde a ese color/talle.', 'image_link');
    }
    if ($row['price'] === '') {
        hf_merchant_add_issue($issues, 'error', 'missing_price', 'Falta precio.', 'price');
    }
    if ($row['color'] === '') {
        hf_merchant_add_issue($issues, 'error', 'missing_color', 'Falta color.', 'color');
    } elseif ($detected_color !== '' && ! hf_merchant_values_equivalent($detected_color, $row['color'], 'color')) {
        hf_merchant_add_issue($issues, 'warning', 'color_name_mismatch', 'El color detectado en el nombre no coincide con el atributo de color.', 'color');
    }
    if ($is_variant && $row['size'] === '') {
        hf_merchant_add_issue($issues, 'error', 'missing_size', 'La variante no tiene talle.', 'size');
    }
    if ($row['description'] === '') {
        hf_merchant_add_issue($issues, 'error', 'missing_description', 'Falta descripción.', 'description');
    } elseif (hf_search_strlen($row['description']) < 90) {
        hf_merchant_add_issue($issues, 'warning', 'weak_description', 'La descripción SEO/Merchant es demasiado corta.', 'description');
    }
    if (preg_match('/\b(copia|copy|test|demo|placeholder|prueba)\b/iu', $raw_name . ' ' . $name)) {
        hf_merchant_add_issue($issues, 'error', 'placeholder_name', 'El nombre parece copia, placeholder o dato de prueba.', 'title');
    }
    if (preg_match('/\b(lorem ipsum|placeholder|texto de prueba|test product)\b/iu', $description_long . ' ' . $row['description'])) {
        hf_merchant_add_issue($issues, 'error', 'placeholder_description', 'La descripción parece placeholder o dato de prueba.', 'description');
    }
    if ($is_variant && $row['item_group_id'] === '') {
        hf_merchant_add_issue($issues, 'error', 'missing_item_group_id', 'La variante no tiene item_group_id.', 'item_group_id');
    } elseif ($is_variant && $used_fallback_group) {
        hf_merchant_add_issue($issues, 'info', 'fallback_item_group_id', 'El item_group_id usa fallback estable HF-P{id} porque no hay SKU de grupo.', 'item_group_id');
    }
    if (empty($category_mapping['mapped'])) {
        hf_merchant_add_issue($issues, 'warning', 'unmapped_google_category', 'La categoría no tiene google_product_category confirmado.', 'google_product_category');
    }
    if ($gtin !== '' && ! $has_valid_gtin) {
        hf_merchant_add_issue($issues, 'error', 'invalid_gtin', 'El GTIN existe pero no pasa la validación de dígito verificador.', 'gtin');
    }
    hf_merchant_stock_issues($item, $issues);
    if ($is_variant && hf_merchant_blocking_codes($issues)) {
        hf_merchant_add_issue($issues, 'error', 'incomplete_variant', 'La variante está publicada, pero le faltan datos mínimos de Merchant: ' . implode(', ', hf_merchant_blocking_codes($issues)) . '.', 'variant');
    }

    return array(
        'product_id' => $product->get_id(),
        'variant_id' => $is_variant ? $item->get_id() : 0,
        'is_variant' => $is_variant,
        'sku' => $sku,
        'data' => $row,
        'issues' => $issues,
        'ready' => ! hf_merchant_has_error($issues),
    );
}

function hf_merchant_tsv_value($value) {
    return trim(preg_replace('/[\t\r\n]+/u', ' ', (string) $value));
}

function hf_merchant_issue_totals($items) {
    $totals = array('error' => 0, 'warning' => 0, 'info' => 0);
    foreach ($items as $item) {
        foreach ((array) ($item['issues'] ?? array()) as $issue) {
            $severity = $issue['severity'] ?? 'info';
            if (! isset($totals[$severity])) {
                $totals[$severity] = 0;
            }
            $totals[$severity]++;
        }
    }
    return $totals;
}

function hf_merchant_top_issues($items, $include_info = false) {
    $counts = array();
    foreach ($items as $item) {
        foreach ((array) ($item['issues'] ?? array()) as $issue) {
            $severity = $issue['severity'] ?? 'info';
            if (! $include_info && $severity === 'info') {
                continue;
            }
            $code = $issue['code'] ?? 'unknown';
            $counts[$code] = ($counts[$code] ?? 0) + 1;
        }
    }
    arsort($counts);
    return $counts;
}

function hf_merchant_refresh_ready(&$items) {
    foreach ($items as &$item) {
        $item['ready'] = ! hf_merchant_has_error($item['issues'] ?? array());
    }
    unset($item);
}

function hf_merchant_enforce_global_quality(&$items) {
    $sku_map = array();
    $group_map = array();
    foreach ($items as $index => $item) {
        $sku = trim((string) ($item['sku'] ?? ''));
        if ($sku !== '') {
            $sku_map[$sku][] = $index;
        }
        $group_id = trim((string) ($item['data']['item_group_id'] ?? ''));
        if ($group_id !== '') {
            $group_map[$group_id][(string) ($item['product_id'] ?? '')] = true;
        }
    }
    $id_map = array();
    foreach ($items as $index => $item) {
        $id = trim((string) ($item['data']['id'] ?? ''));
        if ($id !== '') {
            $id_map[$id][] = $index;
        }
    }
    foreach ($sku_map as $sku => $indexes) {
        if (count($indexes) < 2) {
            continue;
        }
        foreach ($indexes as $index) {
            hf_merchant_add_issue($items[$index]['issues'], 'error', 'duplicate_sku', 'El SKU está repetido en más de un item del catálogo.', 'sku');
        }
    }
    foreach ($id_map as $id => $indexes) {
        if (count($indexes) < 2) {
            continue;
        }
        foreach ($indexes as $index) {
            hf_merchant_add_issue($items[$index]['issues'], 'error', 'duplicate_id', 'El ID Merchant está repetido en más de un item del catálogo.', 'id');
        }
    }
    foreach ($items as &$item) {
        $group_id = trim((string) ($item['data']['item_group_id'] ?? ''));
        if (! empty($item['is_variant']) && $group_id !== '' && isset($group_map[$group_id]) && count($group_map[$group_id]) > 1) {
            hf_merchant_add_issue($item['issues'], 'warning', 'shared_item_group_id', 'El item_group_id aparece asociado a más de un producto padre.', 'item_group_id');
        }
    }
    unset($item);
    hf_merchant_refresh_ready($items);
}

function hf_merchant_parse_price_number($value) {
    if (is_numeric($value)) {
        return (float) $value;
    }
    $value = preg_replace('/[^0-9.,-]+/', '', (string) $value);
    if ($value === '') {
        return null;
    }
    if (false !== strpos($value, ',') && false !== strpos($value, '.')) {
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
    } elseif (false !== strpos($value, ',')) {
        $value = str_replace(',', '.', $value);
    }
    return is_numeric($value) ? (float) $value : null;
}

function hf_merchant_flatten_schema_products($node, &$products) {
    if (! is_array($node)) {
        return;
    }
    $type = $node['@type'] ?? '';
    if (is_array($type)) {
        $type = reset($type);
    }
    if (in_array($type, array('Product', 'ProductGroup'), true)) {
        $products[] = $node;
    }
    foreach (array('hasVariant', '@graph') as $key) {
        if (! empty($node[$key]) && is_array($node[$key])) {
            foreach ($node[$key] as $child) {
                hf_merchant_flatten_schema_products($child, $products);
            }
        }
    }
}

function hf_merchant_extract_search_snapshot($html) {
    $snapshot = array('canonical' => '', 'products' => array());
    if (preg_match('/<link\s+[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']/i', $html, $match)) {
        $snapshot['canonical'] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    } elseif (preg_match('/<link\s+[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']canonical["\']/i', $html, $match)) {
        $snapshot['canonical'] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    if (preg_match('/<script\s+id="hfSeoJsonLd"[^>]*>([\s\S]*?)<\/script>/i', $html, $match)) {
        $schema = json_decode(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), true);
        if (is_array($schema)) {
            hf_merchant_flatten_schema_products($schema, $snapshot['products']);
        }
    }
    return $snapshot;
}

function hf_merchant_schema_offer($node) {
    $offers = $node['offers'] ?? array();
    if (isset($offers['price']) || isset($offers['availability'])) {
        return $offers;
    }
    if (is_array($offers) && isset($offers[0])) {
        return $offers[0];
    }
    return array();
}

function hf_merchant_schema_node_type($node) {
    $type = $node['@type'] ?? '';
    if (is_array($type)) {
        $type = reset($type);
    }
    return (string) $type;
}

function hf_merchant_schema_group_id($search) {
    foreach ((array) ($search['products'] ?? array()) as $node) {
        if (hf_merchant_schema_node_type($node) === 'ProductGroup' && ! empty($node['productGroupID'])) {
            return (string) $node['productGroupID'];
        }
        if (! empty($node['isVariantOf']['productGroupID'])) {
            return (string) $node['isVariantOf']['productGroupID'];
        }
    }
    return '';
}

function hf_merchant_schema_match_variant($search, $data) {
    $target_id = (string) ($data['id'] ?? '');
    $target_size = hf_merchant_normalize_size($data['size'] ?? '');
    $target_color = hf_merchant_normalize_text($data['color'] ?? '');
    $fallback = null;
    foreach ((array) ($search['products'] ?? array()) as $node) {
        $type = hf_merchant_schema_node_type($node);
        if ($type === 'ProductGroup') {
            continue;
        }
        if ($target_id !== '' && (string) ($node['sku'] ?? '') === $target_id) {
            return $node;
        }
        $node_size = hf_merchant_normalize_size($node['size'] ?? '');
        $node_color = hf_merchant_normalize_text($node['color'] ?? '');
        if ($target_size !== '' && $node_size === $target_size && ($target_color === '' || $node_color === '' || $node_color === $target_color)) {
            $fallback = $node;
        }
    }
    return $fallback;
}

function hf_merchant_compare_search_and_merchant($merchant, $search) {
    $issues = array();
    $data = $merchant['data'] ?? $merchant;
    if (! empty($search['canonical']) && ! empty($data['link']) && untrailingslashit($search['canonical']) !== untrailingslashit($data['link'])) {
        hf_merchant_add_issue($issues, 'error', 'canonical_feed_url_mismatch', 'La canonical prerender no coincide con la URL del feed.', 'link');
    }
    $schema_product = hf_merchant_schema_match_variant($search, $data);
    if (! $schema_product) {
        foreach ((array) ($search['products'] ?? array()) as $node) {
            if (hf_merchant_schema_node_type($node) === 'Product') {
                $schema_product = $node;
                break;
            }
        }
    }
    if (! $schema_product && empty($search['products'])) {
        hf_merchant_add_issue($issues, 'info', 'schema_product_missing', 'No se encontró Product/ProductGroup en el HTML prerender.', 'schema');
        return $issues;
    }
    if ($schema_product && ! empty($schema_product['sku']) && (string) $schema_product['sku'] !== (string) ($data['id'] ?? '') && (string) $schema_product['sku'] !== (string) ($data['mpn'] ?? '')) {
        hf_merchant_add_issue($issues, 'warning', 'schema_sku_mismatch', 'El SKU del schema no coincide con el ID Merchant.', 'sku');
    }
    $offer = hf_merchant_schema_offer($schema_product ?: array());
    if (! empty($offer['price']) && ! empty($data['price'])) {
        $schema_price = hf_merchant_parse_price_number($offer['price']);
        $feed_price = hf_merchant_parse_price_number($data['price']);
        if ($schema_price !== null && $feed_price !== null && abs($schema_price - $feed_price) > 0.01) {
            hf_merchant_add_issue($issues, 'error', 'schema_price_mismatch', 'El precio del schema no coincide con el precio Merchant.', 'price');
        }
    }
    if (! empty($offer['availability']) && ! empty($data['availability'])) {
        $schema_available = hf_search_contains($offer['availability'], 'InStock') ? 'in_stock' : (hf_search_contains($offer['availability'], 'BackOrder') ? 'backorder' : 'out_of_stock');
        if ($schema_available !== $data['availability']) {
            hf_merchant_add_issue($issues, 'warning', 'schema_availability_mismatch', 'La disponibilidad del schema no coincide con Merchant.', 'availability');
        }
    }
    if ($schema_product) {
        foreach (array('color', 'size') as $field) {
            if (! empty($schema_product[$field]) && ! empty($data[$field]) && ! hf_merchant_values_equivalent($schema_product[$field], $data[$field], $field)) {
                hf_merchant_add_issue($issues, 'warning', 'schema_' . $field . '_mismatch', 'El campo ' . $field . ' no coincide entre schema y Merchant.', $field);
            }
        }
    }
    $schema_group = hf_merchant_schema_group_id($search);
    if ($schema_group !== '' && ! empty($data['item_group_id']) && (string) $schema_group !== (string) $data['item_group_id']) {
        hf_merchant_add_issue($issues, 'warning', 'schema_item_group_id_mismatch', 'El ProductGroupID no coincide con item_group_id.', 'item_group_id');
    }
    return $issues;
}

function hf_merchant_apply_search_consistency_issues(&$items) {
    if (! function_exists('hf_storefront_seo_dir')) {
        return;
    }
    $seo_dir = hf_storefront_seo_dir();
    foreach ($items as &$item) {
        $link = (string) ($item['data']['link'] ?? '');
        $path = parse_url($link, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            continue;
        }
        $html_path = trailingslashit($seo_dir) . ltrim($path, '/') . 'index.html';
        if (! is_readable($html_path)) {
            hf_merchant_add_issue($item['issues'], 'info', 'search_html_missing', 'No se encontró HTML prerender para comparar Search ↔ Merchant.', 'schema');
            continue;
        }
        $snapshot = hf_merchant_extract_search_snapshot((string) file_get_contents($html_path));
        foreach (hf_merchant_compare_search_and_merchant($item, $snapshot) as $issue) {
            $item['issues'][] = $issue;
        }
    }
    unset($item);
    hf_merchant_refresh_ready($items);
}

function hf_merchant_build_catalog_report($products) {
    $items = array();
    $products_analyzed = 0;
    $variants_analyzed = 0;
    foreach ($products as $product) {
        if (! $product || 'publish' !== $product->get_status()) {
            continue;
        }
        if (function_exists('hf_storefront_is_duplicate_copy_product') && hf_storefront_is_duplicate_copy_product($product)) {
            continue;
        }
        $products_analyzed++;
        if ($product->is_type('variable') && $product->get_children()) {
            foreach ($product->get_children() as $variation_id) {
                $variation = wc_get_product($variation_id);
                if (! $variation || 'publish' !== $variation->get_status()) {
                    continue;
                }
                $variants_analyzed++;
                $items[] = hf_merchant_row($variation, $product);
            }
        } else {
            $items[] = hf_merchant_row($product);
        }
    }
    hf_merchant_enforce_global_quality($items);
    hf_merchant_apply_search_consistency_issues($items);

    $ready = array_values(array_filter($items, static function ($item) { return ! empty($item['ready']); }));
    $issue_totals = hf_merchant_issue_totals($items);
    $report = array(
        'generatedAt' => gmdate('c'),
        'currency' => get_woocommerce_currency(),
        'products_analyzed' => $products_analyzed,
        'variants_analyzed' => $variants_analyzed,
        'total' => count($items),
        'ready' => count($ready),
        'blocked' => count($items) - count($ready),
        'issue_totals' => $issue_totals,
        'top_issues' => hf_merchant_top_issues($items),
        'top_issues_all' => hf_merchant_top_issues($items, true),
        'rules' => hf_merchant_issue_rules(),
        'catalog_notes' => array(
            'identifier_exists' => 'Brand Horizon Fit + MPN=SKU único cuando Horizon Fit actúa como fabricante. Filtro hf_merchant_use_sku_as_mpn: si un producto es de un tercero, devolver false y no usar SKU como MPN. identifier_exists se omite si hay brand/MPN/GTIN.',
            'size_system' => 'Omitido a propósito: Google no tiene AR y S/M/L son talles estándar. No se afirma US.',
            'size_type' => 'Omitido salvo petite/maternity/plus/tall/big reales. regular es el default de Google.',
            'shipping' => 'No se envía shipping en el feed hasta confirmar costo y plazo reales.',
            'return_policy' => 'No se envía return_policy de Merchant Center; la política pública de 15 días queda en schema y páginas.',
            'item_group_id' => 'Fuente única: SKU padre color (001-TOP-AZU). Schema y Merchant reutilizan hf_search_item_group_id().',
            'search_titles' => 'Search usa {nombre Woo} | Horizon Fit. Merchant usa Nombre - Color - Talle. No se mezclan.',
        ),
        'items' => $items,
    );
    return $report;
}

function hf_merchant_report_console_summary($report) {
    $lines = array(
        'Productos analizados: ' . (int) ($report['products_analyzed'] ?? 0),
        'Variantes analizadas: ' . (int) ($report['variants_analyzed'] ?? 0),
        'Merchant ready: ' . (int) ($report['ready'] ?? 0),
        'Bloqueados: ' . (int) ($report['blocked'] ?? 0),
        'Errores: ' . (int) ($report['issue_totals']['error'] ?? 0),
        'Warnings: ' . (int) ($report['issue_totals']['warning'] ?? 0),
        '',
        'Top issues (errores/warnings):',
    );
    $top = array_slice((array) ($report['top_issues'] ?? array()), 0, 10, true);
    if (! $top) {
        $lines[] = '- none: 0';
    }
    foreach ($top as $code => $count) {
        $lines[] = '- ' . $code . ': ' . (int) $count;
    }
    $lines[] = '';
    $lines[] = 'Reglas (issue / severity / blocks_merchant):';
    foreach (hf_merchant_issue_rules() as $code => $rule) {
        $lines[] = sprintf(
            '- %s  %s  %s',
            $code,
            $rule['severity'] ?? 'info',
            ! empty($rule['blocks_merchant']) ? 'yes' : 'no'
        );
    }
    return implode("\n", $lines);
}

function hf_search_product_has_useful_copy($product) {
    if (! $product || ! is_a($product, 'WC_Product')) {
        return false;
    }
    $long = hf_search_text($product->get_description());
    if (hf_search_useful_copy($long) && ! hf_search_is_placeholder_copy($long)) {
        return true;
    }
    $short = hf_search_text($product->get_short_description());
    return hf_search_useful_copy($short) && ! hf_search_is_placeholder_copy($short);
}

function hf_search_add_issue(&$issues, $severity, $code, $message, $field = '') {
    $rules = hf_search_issue_rules();
    if (isset($rules[$code]['severity'])) {
        $severity = $rules[$code]['severity'];
    }
    $issues[] = array(
        'severity' => $severity,
        'code' => $code,
        'message' => $message,
        'field' => $field,
        'blocks_merchant' => false,
    );
}

function hf_search_issue_totals($items) {
    $totals = array('error' => 0, 'warning' => 0, 'info' => 0);
    $codes = array();
    foreach ((array) $items as $item) {
        foreach ((array) ($item['issues'] ?? array()) as $issue) {
            $severity = $issue['severity'] ?? 'info';
            if (isset($totals[$severity])) {
                $totals[$severity]++;
            }
            $code = $issue['code'] ?? '';
            if ($code !== '') {
                $codes[$code] = ($codes[$code] ?? 0) + 1;
            }
        }
    }
    arsort($codes);
    return array('severity' => $totals, 'codes' => $codes);
}

function hf_search_build_snippets_report($products) {
    $items = array();
    foreach ((array) $products as $product) {
        if (! $product || ! is_a($product, 'WC_Product') || 'publish' !== $product->get_status()) {
            continue;
        }
        if (function_exists('hf_storefront_is_duplicate_copy_product') && hf_storefront_is_duplicate_copy_product($product)) {
            continue;
        }
        $title = hf_search_product_title($product);
        $meta = hf_search_product_meta_description($product);
        $issues = array();
        $title_len = hf_search_strlen($title);
        $meta_len = hf_search_strlen($meta);

        if (hf_search_is_placeholder_title($title) || hf_search_is_placeholder_title(hf_search_product_name($product))) {
            hf_search_add_issue($issues, 'warning', 'seo_title_placeholder', 'El title parece placeholder o dato de prueba.', 'title');
        }
        if ($title_len > 65) {
            hf_search_add_issue($issues, 'warning', 'seo_title_too_long', 'El title SEO supera 65 caracteres.', 'title');
        }
        if ($meta_len > 158) {
            hf_search_add_issue($issues, 'warning', 'meta_description_too_long', 'La meta description supera 158 caracteres.', 'description');
        } elseif ($meta_len < 70) {
            hf_search_add_issue($issues, 'warning', 'meta_description_too_short', 'La meta description es demasiado corta.', 'description');
        }
        if (! hf_search_product_has_useful_copy($product) || $meta_len < 120) {
            hf_search_add_issue($issues, 'warning', 'weak_meta_description', 'La meta usa fallback mínimo o copy Woo insuficiente.', 'description');
        }

        $items[] = array(
            'id' => (int) $product->get_id(),
            'sku' => trim((string) $product->get_sku()),
            'slug' => (string) $product->get_slug(),
            'name' => hf_search_product_name($product),
            'title' => $title,
            'meta_description' => $meta,
            'title_len' => $title_len,
            'meta_len' => $meta_len,
            'issues' => $issues,
        );
    }

    $title_map = array();
    $meta_map = array();
    foreach ($items as $index => $item) {
        $title_key = function_exists('mb_strtolower') ? mb_strtolower($item['title'], 'UTF-8') : strtolower($item['title']);
        $meta_key = function_exists('mb_strtolower') ? mb_strtolower($item['meta_description'], 'UTF-8') : strtolower($item['meta_description']);
        $title_map[$title_key][] = $index;
        $meta_map[$meta_key][] = $index;
    }
    foreach ($title_map as $indexes) {
        if (count($indexes) < 2) {
            continue;
        }
        foreach ($indexes as $index) {
            hf_search_add_issue($items[$index]['issues'], 'warning', 'duplicate_seo_title', 'Hay otro PDP con el mismo title SEO.', 'title');
        }
    }
    foreach ($meta_map as $indexes) {
        if (count($indexes) < 2) {
            continue;
        }
        foreach ($indexes as $index) {
            hf_search_add_issue($items[$index]['issues'], 'warning', 'duplicate_meta_description', 'Hay otro PDP con la misma meta description.', 'description');
        }
    }

    $totals = hf_search_issue_totals($items);
    $warning_count = (int) ($totals['severity']['warning'] ?? 0) + (int) ($totals['severity']['error'] ?? 0);
    $titles = array_column($items, 'title');
    $metas = array_column($items, 'meta_description');

    return array(
        'generatedAt' => gmdate('c'),
        'products' => count($items),
        'unique_titles' => count(array_unique($titles)),
        'unique_meta_descriptions' => count(array_unique($metas)),
        'quality' => $warning_count > 0 ? 'warnings' : 'OK',
        'issue_totals' => $totals['severity'],
        'top_issues' => $totals['codes'],
        'rules' => hf_search_issue_rules(),
        'items' => $items,
    );
}

function hf_search_report_console_summary($report) {
    $lines = array(
        'Search products: ' . (int) ($report['products'] ?? 0),
        'Unique titles: ' . (int) ($report['unique_titles'] ?? 0),
        'Unique meta descriptions: ' . (int) ($report['unique_meta_descriptions'] ?? 0),
        'Meta quality: ' . (string) ($report['quality'] ?? 'OK'),
        'Errores: ' . (int) ($report['issue_totals']['error'] ?? 0),
        'Warnings: ' . (int) ($report['issue_totals']['warning'] ?? 0),
        '',
        'Issues:',
    );
    $top = (array) ($report['top_issues'] ?? array());
    if (! $top) {
        $lines[] = '- none: 0';
    }
    foreach ($top as $code => $count) {
        $lines[] = '- ' . $code . ': ' . (int) $count;
    }
    $lines[] = '';
    $lines[] = 'Productos afectados:';
    $affected = 0;
    foreach ((array) ($report['items'] ?? array()) as $item) {
        if (empty($item['issues'])) {
            continue;
        }
        $affected++;
        $codes = array_values(array_unique(array_map(static function ($issue) {
            return $issue['code'] ?? '';
        }, $item['issues'])));
        $lines[] = sprintf(
            '- %s  %s  %s',
            $item['sku'] !== '' ? $item['sku'] : ('id:' . ($item['id'] ?? '')),
            $item['slug'] ?? '',
            implode(', ', array_filter($codes))
        );
    }
    if ($affected === 0) {
        $lines[] = '- none';
    }
    return implode("\n", $lines);
}

function hf_merchant_write_artifacts($products) {
    $report = hf_merchant_build_catalog_report($products);
    $ready = array_values(array_filter($report['items'], static function ($item) { return ! empty($item['ready']); }));

    $dir = hf_merchant_dir();
    file_put_contents(trailingslashit($dir) . 'merchant-products.json', wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    file_put_contents(trailingslashit($dir) . 'merchant-diagnostics.txt', hf_merchant_report_console_summary($report) . "\n", LOCK_EX);

    $headers = array(
        'id', 'item_group_id', 'item_group_title', 'title', 'description', 'link', 'image_link', 'additional_image_link',
        'availability', 'price', 'sale_price', 'brand', 'condition', 'color', 'size', 'size_system', 'size_type', 'gender', 'age_group', 'material',
        'product_type', 'google_product_category', 'google_product_category_label', 'gtin', 'mpn', 'identifier_exists',
    );
    $lines = array(implode("\t", $headers));
    foreach ($ready as $item) {
        $row = $item['data'];
        $values = array();
        foreach ($headers as $header) {
            $values[] = hf_merchant_tsv_value($row[$header] ?? '');
        }
        $lines[] = implode("\t", $values);
    }
    file_put_contents(trailingslashit($dir) . 'merchant-products.tsv', implode("\n", $lines) . "\n", LOCK_EX);

    $search = hf_search_build_snippets_report($products);
    $report['search'] = $search;
    file_put_contents(trailingslashit($dir) . 'search-snippets.json', wp_json_encode($search, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    file_put_contents(trailingslashit($dir) . 'search-snippets.txt', hf_search_report_console_summary($search) . "\n", LOCK_EX);

    return $report;
}

function hf_search_regenerate_commerce_artifacts() {
    if (! function_exists('wc_get_products')) {
        return false;
    }

    $seo_dir = function_exists('hf_storefront_seo_dir')
        ? hf_storefront_seo_dir()
        : trailingslashit(wp_upload_dir()['basedir']) . 'horizon-fit-seo';

    $home_seo = function_exists('hf_storefront_home_seo_settings')
        ? hf_storefront_home_seo_settings()
        : array(
            'title' => 'Horizon Fit | Ropa deportiva y conjuntos',
            'description' => 'Descubrí activewear funcional de Horizon Fit: tops, calzas, shorts, camperas y conjuntos cómodos para entrenar y vivir en movimiento.',
        );
    $home_title = (string) ($home_seo['title'] ?? 'Horizon Fit');
    $home_description = (string) ($home_seo['description'] ?? '');
    hf_search_write_html(trailingslashit($seo_dir) . 'index.html', $home_title, hf_search_excerpt($home_description, 158));

    $products = wc_get_products(array(
        'status' => 'publish',
        'limit' => -1,
        'return' => 'objects',
        'orderby' => 'date',
        'order' => 'DESC',
    ));

    foreach ($products as $product) {
        if (function_exists('hf_storefront_is_duplicate_copy_product') && hf_storefront_is_duplicate_copy_product($product)) {
            continue;
        }
        $path = trailingslashit($seo_dir) . 'producto/' . $product->get_slug() . '/index.html';
        hf_search_write_html($path, hf_search_product_title($product), hf_search_product_meta_description($product), $product);
    }

    foreach (array('product_cat', 'hf_collection') as $taxonomy) {
        $terms = get_terms(array('taxonomy' => $taxonomy, 'hide_empty' => true));
        if (is_wp_error($terms)) {
            continue;
        }
        foreach ($terms as $term) {
            if ($taxonomy === 'product_cat' && in_array($term->slug, array('uncategorized', 'sin-categorizar'), true)) {
                continue;
            }
            if ($taxonomy === 'hf_collection' && 0 === strpos($term->slug, 'featured-row-')) {
                continue;
            }
            $path = trailingslashit($seo_dir) . 'coleccion/' . $term->slug . '/index.html';
            hf_search_write_html($path, hf_search_category_title($term), hf_search_category_description($term));
        }
    }

    return hf_merchant_write_artifacts($products);
}

add_action('hf_regenerate_storefront_seo_cache_event', 'hf_search_regenerate_commerce_artifacts', 20);
add_action('updated_option', static function ($option) {
    if (in_array($option, array('hf_info_pages', 'hf_home_seo'), true)) {
        hf_search_regenerate_commerce_artifacts();
    }
}, 30, 1);

add_action('plugins_loaded', static function () {
    if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
        WP_CLI::add_command('horizon-fit regenerate-search-commerce', static function () {
            $report = hf_search_regenerate_commerce_artifacts();
            if (! is_array($report)) {
                WP_CLI::error('No se pudieron regenerar los artefactos Search/Merchant.');
                return;
            }
            WP_CLI::line(hf_merchant_report_console_summary($report));
            if (! empty($report['search']) && is_array($report['search'])) {
                WP_CLI::line('');
                WP_CLI::line(hf_search_report_console_summary($report['search']));
            }
            WP_CLI::success(sprintf('Search/Merchant regenerado: %d items listos, %d bloqueados.', $report['ready'], $report['blocked']));
        });
    }
});
