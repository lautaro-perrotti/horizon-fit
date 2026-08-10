<?php
/**
 * HTML prerender y sitemap del storefront estático.
 *
 * La tienda pública es una SPA. Este cache conserva exactamente el mismo
 * documento y la misma UI, pero reemplaza el <head> para que cada producto,
 * colección y página informativa tenga metadata útil desde el primer byte.
 */

if (! defined('ABSPATH')) {
    exit;
}

function hf_storefront_public_url($path = '/') {
    return 'https://horizonfit.com.ar/' . ltrim((string) $path, '/');
}

function hf_storefront_seo_dir() {
    $uploads = wp_upload_dir();
    return trailingslashit($uploads['basedir']) . 'horizon-fit-seo';
}

function hf_storefront_seo_description($value, $fallback = '') {
    $value = html_entity_decode(wp_strip_all_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $value = trim(preg_replace('/\s+/u', ' ', $value));
    if ($value === '') {
        $value = $fallback;
    }
    return wp_html_excerpt($value, 158, '…');
}

function hf_storefront_replace_head_node($html, $pattern, $replacement) {
    return preg_replace($pattern, $replacement, $html, 1);
}

function hf_storefront_render_seo_html($template, $seo) {
    $title = esc_html($seo['title']);
    $description = esc_attr($seo['description']);
    $canonical = esc_url($seo['canonical']);
    $robots = esc_attr($seo['robots'] ?? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    $type = esc_attr($seo['type'] ?? 'website');
    $image = esc_url($seo['image'] ?? hf_storefront_public_url('LOGOS/favicon-512.png'));
    $schema = wp_json_encode(
        array('@context' => 'https://schema.org', '@graph' => array_values($seo['schema'] ?? array())),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    $html = hf_storefront_replace_head_node($template, '/<title>.*?<\/title>/is', '<title>' . $title . '</title>');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfMetaDescription"[^>]*>/i', '<meta id="hfMetaDescription" name="description" content="' . $description . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfMetaRobots"[^>]*>/i', '<meta id="hfMetaRobots" name="robots" content="' . $robots . '" />');
    $html = hf_storefront_replace_head_node($html, '/<link\s+id="hfCanonicalLink"[^>]*>/i', '<link id="hfCanonicalLink" rel="canonical" href="' . $canonical . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfOgTitle"[^>]*>/i', '<meta id="hfOgTitle" property="og:title" content="' . esc_attr($seo['title']) . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfOgDescription"[^>]*>/i', '<meta id="hfOgDescription" property="og:description" content="' . $description . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfOgUrl"[^>]*>/i', '<meta id="hfOgUrl" property="og:url" content="' . $canonical . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfOgType"[^>]*>/i', '<meta id="hfOgType" property="og:type" content="' . $type . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfOgImage"[^>]*>/i', '<meta id="hfOgImage" property="og:image" content="' . $image . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfTwitterTitle"[^>]*>/i', '<meta id="hfTwitterTitle" name="twitter:title" content="' . esc_attr($seo['title']) . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfTwitterDescription"[^>]*>/i', '<meta id="hfTwitterDescription" name="twitter:description" content="' . $description . '" />');
    $html = hf_storefront_replace_head_node($html, '/<meta\s+id="hfTwitterImage"[^>]*>/i', '<meta id="hfTwitterImage" name="twitter:image" content="' . $image . '" />');
    return hf_storefront_replace_head_node($html, '/<script\s+id="hfSeoJsonLd"[^>]*>.*?<\/script>/is', '<script id="hfSeoJsonLd" type="application/ld+json">' . $schema . '</script>');
}

function hf_storefront_write_route($template, $route, $seo) {
    $relative = trim($route, '/');
    $directory = trailingslashit(hf_storefront_seo_dir()) . $relative;
    if (! wp_mkdir_p($directory)) {
        return false;
    }
    return false !== file_put_contents(trailingslashit($directory) . 'index.html', hf_storefront_render_seo_html($template, $seo), LOCK_EX);
}

function hf_storefront_product_seo($product) {
    $route = 'producto/' . $product->get_slug() . '/';
    $canonical = hf_storefront_public_url($route);
    $description = hf_storefront_seo_description($product->get_short_description(), $product->get_description());
    $image_id = $product->get_image_id();
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    $offer = array(
        '@type' => 'Offer',
        'url' => $canonical,
        'priceCurrency' => get_woocommerce_currency(),
        'availability' => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'itemCondition' => 'https://schema.org/NewCondition',
    );
    if ($product->get_price() !== '') {
        $offer['price'] = (string) wc_format_decimal($product->get_price(), wc_get_price_decimals());
    }
    return array(
        'route' => $route,
        'title' => $product->get_name() . ' | Horizon Fit',
        'description' => $description,
        'canonical' => $canonical,
        'type' => 'product',
        'image' => $image,
        'schema' => array(array(
            '@type' => 'Product',
            '@id' => $canonical . '#product',
            'name' => $product->get_name(),
            'description' => $description,
            'image' => $image ? array($image) : array(),
            'sku' => $product->get_sku(),
            'brand' => array('@type' => 'Brand', 'name' => 'Horizon Fit'),
            'offers' => $offer,
        )),
    );
}

function hf_storefront_term_seo($term) {
    $route = 'coleccion/' . $term->slug . '/';
    $canonical = hf_storefront_public_url($route);
    $fallback = sprintf('Explorá %s de Horizon Fit y encontrá prendas de activewear para combinar, entrenar y usar todos los días.', $term->name);
    $description = hf_storefront_seo_description($term->description, $fallback);
    $image_id = (int) get_term_meta($term->term_id, $term->taxonomy === 'product_cat' ? 'thumbnail_id' : 'hf_image_id', true);
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    return array(
        'route' => $route,
        'title' => $term->name . ' | Horizon Fit',
        'description' => $description,
        'canonical' => $canonical,
        'type' => 'website',
        'image' => $image,
        'schema' => array(array(
            '@type' => 'CollectionPage',
            '@id' => $canonical . '#collection',
            'name' => $term->name,
            'description' => $description,
            'url' => $canonical,
        )),
    );
}

function hf_regenerate_storefront_seo_cache() {
    if (! class_exists('WooCommerce')) {
        return false;
    }
    $template = @file_get_contents(ABSPATH . 'index.html');
    if (! is_string($template) || $template === '') {
        return false;
    }

    $base = hf_storefront_seo_dir();
    wp_mkdir_p($base);
    $urls = array(hf_storefront_public_url('/'));

    $products = wc_get_products(array('status' => 'publish', 'limit' => -1, 'return' => 'objects'));
    foreach ($products as $product) {
        $seo = hf_storefront_product_seo($product);
        hf_storefront_write_route($template, $seo['route'], $seo);
        $urls[] = $seo['canonical'];
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
            $seo = hf_storefront_term_seo($term);
            hf_storefront_write_route($template, $seo['route'], $seo);
            $urls[] = $seo['canonical'];
        }
    }

    if (function_exists('hf_info_pages_get')) {
        foreach (hf_info_pages_get() as $slug => $page) {
            $route = trim($slug, '/') . '/';
            $canonical = hf_storefront_public_url($route);
            $description = hf_storefront_seo_description($page['content'], $page['description']);
            $has_content = trim((string) $page['content']) !== '';
            $seo = array(
                'title' => $page['title'] . ' | Horizon Fit',
                'description' => $description,
                'canonical' => $canonical,
                'robots' => $has_content ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow',
                'type' => 'article',
                'schema' => array(array('@type' => 'WebPage', '@id' => $canonical . '#webpage', 'name' => $page['title'], 'description' => $description, 'url' => $canonical)),
            );
            hf_storefront_write_route($template, $route, $seo);
            if ($has_content) {
                $urls[] = $canonical;
            }
        }
    }

    foreach (array('checkout', 'mi-cuenta', 'recuperar-contrasena') as $slug) {
        $canonical = hf_storefront_public_url($slug . '/');
        hf_storefront_write_route($template, $slug . '/', array(
            'title' => 'Horizon Fit',
            'description' => 'Ruta operativa de Horizon Fit.',
            'canonical' => $canonical,
            'robots' => 'noindex,nofollow',
            'schema' => array(),
        ));
    }

    $urls = array_values(array_unique($urls));
    sort($urls, SORT_STRING);
    $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
    foreach ($urls as $url) {
        $xml .= '  <url><loc>' . esc_xml($url) . "</loc></url>\n";
    }
    $xml .= "</urlset>\n";
    file_put_contents(trailingslashit($base) . 'sitemap.xml', $xml, LOCK_EX);
    return true;
}

function hf_schedule_storefront_seo_cache() {
    if (! wp_next_scheduled('hf_regenerate_storefront_seo_cache_event')) {
        wp_schedule_single_event(time() + 10, 'hf_regenerate_storefront_seo_cache_event');
    }
}

add_action('hf_regenerate_storefront_seo_cache_event', 'hf_regenerate_storefront_seo_cache');
add_action('save_post_product', 'hf_schedule_storefront_seo_cache', 60);
add_action('save_post_product_variation', 'hf_schedule_storefront_seo_cache', 60);
add_action('created_product_cat', 'hf_schedule_storefront_seo_cache', 60);
add_action('edited_product_cat', 'hf_schedule_storefront_seo_cache', 60);
add_action('created_hf_collection', 'hf_schedule_storefront_seo_cache', 60);
add_action('edited_hf_collection', 'hf_schedule_storefront_seo_cache', 60);
add_action('update_option_hf_info_pages', 'hf_schedule_storefront_seo_cache', 10, 0);

add_action('updated_option', function ($option) {
    if ('hf_info_pages' === $option) {
        hf_regenerate_storefront_seo_cache();
    }
}, 20, 1);
