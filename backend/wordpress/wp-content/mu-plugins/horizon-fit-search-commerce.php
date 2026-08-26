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

function hf_search_product_title($product) {
    $name = hf_search_product_name($product);
    $base = $name . ' | Horizon Fit';
    if ($name === '') {
        return 'Horizon Fit';
    }
    if (! hf_search_contains($name, 'mujer')) {
        $candidate = $name . ' para Mujer | Horizon Fit';
        if (hf_search_strlen($candidate) <= 65) {
            return $candidate;
        }
    }
    return hf_search_strlen($base) <= 65 ? $base : hf_search_excerpt($base, 65);
}

function hf_search_attribute_text($product, $keys) {
    if (! $product || ! is_a($product, 'WC_Product')) {
        return '';
    }
    foreach ((array) $keys as $key) {
        $value = trim((string) $product->get_attribute($key));
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

function hf_search_product_description($product) {
    $name = hf_search_product_name($product);
    $raw = trim((string) $product->get_description());
    if (! hf_search_useful_copy($raw)) {
        $raw = trim((string) $product->get_short_description());
    }
    if (hf_search_useful_copy($raw)) {
        return hf_search_excerpt($raw, 158);
    }

    $parts = array();
    $parts[] = 'Descubrí ' . $name . ' de Horizon Fit';

    $color = function_exists('hf_storefront_product_color') ? hf_storefront_product_color($product) : hf_search_attribute_text($product, array('pa_color', 'color'));
    $material = hf_search_attribute_text($product, array('pa_material', 'material'));
    $sizes = function_exists('hf_storefront_product_sizes') ? hf_storefront_product_sizes($product) : array();

    if ($color !== '') {
        $parts[] = 'color ' . $color;
    }
    if ($material !== '') {
        $parts[] = 'confeccionado en ' . $material;
    }
    if ($sizes) {
        $parts[] = 'disponible en talles ' . implode(', ', array_slice($sizes, 0, 6));
    }
    $parts[] = 'Consultá stock y opciones de compra online';

    return hf_search_excerpt(implode('. ', $parts) . '.', 158);
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
        $size = hf_search_attribute_text($variation, array('pa_talle', 'talle', 'pa_size', 'size'));
        $color = hf_search_attribute_text($variation, array('pa_color', 'color'));
        $material = hf_search_attribute_text($variation, array('pa_material', 'material'));
        $pattern = hf_search_attribute_text($variation, array('pa_pattern', 'pattern', 'pa_estampa', 'estampa'));
        foreach (array('size' => $size, 'color' => $color, 'material' => $material, 'pattern' => $pattern) as $key => $value) {
            if ($value !== '') {
                $values[$key][] = $value;
            }
        }
        $variation_map[(string) $variation->get_sku()] = array_filter(array(
            'size' => $size,
            'color' => $color,
            'material' => $material,
            'pattern' => $pattern,
        ));
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
    $group_id = function_exists('hf_storefront_product_group_id') ? hf_storefront_product_group_id($product) : '';

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
        if ($group_id !== '') {
            $node['productGroupID'] = $group_id;
        }
        if (! empty($dimensions['variesBy'])) {
            $node['variesBy'] = $dimensions['variesBy'];
        }
        foreach ($node['hasVariant'] as &$variant_node) {
            if (! is_array($variant_node)) {
                continue;
            }
            $sku = isset($variant_node['sku']) ? (string) $variant_node['sku'] : '';
            if ($sku === '' || empty($dimensions['variations'][$sku])) {
                continue;
            }
            foreach ($dimensions['variations'][$sku] as $key => $value) {
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

function hf_merchant_product_type($product) {
    $terms = wp_get_post_terms($product->get_id(), 'product_cat');
    if (is_wp_error($terms) || ! $terms) {
        return 'Ropa deportiva mujer';
    }
    usort($terms, static function ($a, $b) {
        return count(get_ancestors($b->term_id, 'product_cat')) <=> count(get_ancestors($a->term_id, 'product_cat'));
    });
    $term = $terms[0];
    if (in_array($term->slug, array('uncategorized', 'sin-categorizar'), true) && isset($terms[1])) {
        $term = $terms[1];
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

function hf_merchant_image_urls($product, $parent = null) {
    $image_id = (int) $product->get_image_id();
    if (! $image_id && $parent && is_a($parent, 'WC_Product')) {
        $image_id = (int) $parent->get_image_id();
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
    return array('primary' => $primary ?: '', 'additional' => array_values(array_unique($additional)));
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
    return trim(preg_replace('/\s+(blanco|negro|azul|celeste|verde|rosa|rojo|bordeaux|bord[oó]|gris|beige|marr[oó]n)\s*$/iu', '', (string) $name));
}

function hf_merchant_row($item, $parent = null) {
    $product = $parent && is_a($parent, 'WC_Product') ? $parent : $item;
    $name = hf_search_product_name($product);
    $is_variant = $parent && is_a($parent, 'WC_Product');
    $size = hf_search_attribute_text($item, array('pa_talle', 'talle', 'pa_size', 'size'));
    $color = hf_search_attribute_text($item, array('pa_color', 'color'));
    if ($color === '' && function_exists('hf_storefront_product_color')) {
        $color = hf_storefront_product_color($product);
    }
    $material = hf_search_attribute_text($item, array('pa_material', 'material'));
    if ($material === '') {
        $material = hf_search_attribute_text($product, array('pa_material', 'material'));
    }

    $title_parts = array($name);
    if ($color !== '' && ! hf_search_contains($name, $color)) {
        $title_parts[] = $color;
    }
    if ($size !== '') {
        $title_parts[] = 'Talle ' . $size;
    }
    $title = hf_search_excerpt(implode(' - ', $title_parts), 150);

    $canonical = function_exists('hf_storefront_public_url')
        ? hf_storefront_public_url('producto/' . $product->get_slug() . '/')
        : 'https://horizonfit.com.ar/producto/' . $product->get_slug() . '/';

    $images = hf_merchant_image_urls($item, $parent);
    $sku = trim((string) $item->get_sku());
    $id = $sku !== '' ? $sku : ($is_variant ? 'HF-V' . $item->get_id() : 'HF-P' . $item->get_id());
    $group_id = '';
    if ($is_variant || $product->is_type('variable')) {
        $group_id = function_exists('hf_storefront_product_group_id') ? hf_storefront_product_group_id($product) : '';
        if ($group_id === '') {
            $group_id = trim((string) $product->get_sku());
        }
        if ($group_id === '') {
            $group_id = 'HF-P' . $product->get_id();
        }
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
    $mpn = $sku;
    $description = hf_search_product_description($product);
    $description_long = hf_search_text($product->get_description());
    if (hf_search_useful_copy($description_long)) {
        $description = hf_search_excerpt($description_long, 4500);
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
        'size' => $size,
        'gender' => apply_filters('hf_merchant_default_gender', 'female', $product),
        'age_group' => apply_filters('hf_merchant_default_age_group', 'adult', $product),
        'material' => $material,
        'product_type' => hf_merchant_product_type($product),
        'google_product_category' => apply_filters('hf_merchant_google_product_category', '', $product),
        'gtin' => $gtin,
        'mpn' => $mpn,
        'identifier_exists' => ($gtin !== '' || $mpn !== '') ? 'yes' : 'no',
    );

    $issues = array();
    if ($row['image_link'] === '') {
        $issues[] = 'missing_image';
    }
    if ($row['price'] === '') {
        $issues[] = 'missing_price';
    }
    if ($row['color'] === '') {
        $issues[] = 'missing_color';
    }
    if ($is_variant && $row['size'] === '') {
        $issues[] = 'missing_size';
    }
    if ($row['description'] === '') {
        $issues[] = 'missing_description';
    }

    return array('data' => $row, 'issues' => $issues, 'ready' => empty($issues));
}

function hf_merchant_tsv_value($value) {
    return trim(preg_replace('/[\t\r\n]+/u', ' ', (string) $value));
}

function hf_merchant_write_artifacts($products) {
    $items = array();
    foreach ($products as $product) {
        if (! $product || 'publish' !== $product->get_status()) {
            continue;
        }
        if (function_exists('hf_storefront_is_duplicate_copy_product') && hf_storefront_is_duplicate_copy_product($product)) {
            continue;
        }
        if ($product->is_type('variable') && $product->get_children()) {
            foreach ($product->get_children() as $variation_id) {
                $variation = wc_get_product($variation_id);
                if (! $variation || 'publish' !== $variation->get_status()) {
                    continue;
                }
                $items[] = hf_merchant_row($variation, $product);
            }
        } else {
            $items[] = hf_merchant_row($product);
        }
    }

    $ready = array_values(array_filter($items, static function ($item) { return ! empty($item['ready']); }));
    $report = array(
        'generatedAt' => gmdate('c'),
        'currency' => get_woocommerce_currency(),
        'total' => count($items),
        'ready' => count($ready),
        'blocked' => count($items) - count($ready),
        'items' => $items,
    );

    $dir = hf_merchant_dir();
    file_put_contents(trailingslashit($dir) . 'merchant-products.json', wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);

    $headers = array(
        'id', 'item_group_id', 'item_group_title', 'title', 'description', 'link', 'image_link', 'additional_image_link',
        'availability', 'price', 'sale_price', 'brand', 'condition', 'color', 'size', 'gender', 'age_group', 'material',
        'product_type', 'google_product_category', 'gtin', 'mpn', 'identifier_exists',
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
    return $report;
}

function hf_search_regenerate_commerce_artifacts() {
    if (! function_exists('wc_get_products')) {
        return false;
    }

    $seo_dir = function_exists('hf_storefront_seo_dir')
        ? hf_storefront_seo_dir()
        : trailingslashit(wp_upload_dir()['basedir']) . 'horizon-fit-seo';

    $home_title = 'Ropa Deportiva para Mujer | Horizon Fit';
    $home_description = 'Descubrí activewear y ropa deportiva para mujer en Horizon Fit: calzas, tops, shorts, conjuntos y prendas pensadas para entrenar y vivir en movimiento.';
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
        hf_search_write_html($path, hf_search_product_title($product), hf_search_product_description($product), $product);
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
    if ('hf_info_pages' === $option) {
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
            WP_CLI::success(sprintf('Search/Merchant regenerado: %d items listos, %d bloqueados.', $report['ready'], $report['blocked']));
        });
    }
});
