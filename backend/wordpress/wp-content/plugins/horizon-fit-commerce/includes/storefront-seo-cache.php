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

function hf_storefront_product_meta_description($product) {
    $name = $product instanceof WC_Product ? $product->get_name() : 'Activewear Horizon Fit';
    if (function_exists('hf_catalog_display_name')) {
        $name = hf_catalog_display_name($name);
    }
    return hf_storefront_seo_description(sprintf(
        'Descubrí %s de Horizon Fit: una prenda de activewear cómoda y funcional para entrenar, combinar con tu set y acompañarte todos los días.',
        $name
    ));
}

function hf_storefront_product_group_id($product) {
    if (! $product instanceof WC_Product) {
        return '';
    }
    $skus = array_filter(array($product->get_sku()));
    if ($product->is_type('variable')) {
        foreach ($product->get_children() as $variation_id) {
            $variation = wc_get_product($variation_id);
            if ($variation && $variation->get_sku()) {
                $skus[] = $variation->get_sku();
            }
        }
    }
    foreach ($skus as $sku) {
        if (preg_match('/^(\d{3})-([A-Z]{3})-/i', (string) $sku, $matches)) {
            return strtoupper($matches[1] . '-' . $matches[2]);
        }
    }
    return '';
}

function hf_storefront_product_primary_sku($product) {
    if (! $product instanceof WC_Product) {
        return '';
    }
    if ($product->get_sku()) {
        return $product->get_sku();
    }
    if ($product->is_type('variable')) {
        foreach ($product->get_children() as $variation_id) {
            $variation = wc_get_product($variation_id);
            if ($variation && $variation->get_sku()) {
                return $variation->get_sku();
            }
        }
    }
    return '';
}

function hf_storefront_product_attribute_text($product, $names) {
    foreach ((array) $names as $name) {
        $value = trim((string) $product->get_attribute($name));
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}

function hf_storefront_return_policy_schema() {
    return array(
        '@type' => 'MerchantReturnPolicy',
        'applicableCountry' => 'AR',
        'returnPolicyCategory' => 'https://schema.org/MerchantReturnFiniteReturnWindow',
        'merchantReturnDays' => 15,
    );
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
    $display_name = function_exists('hf_catalog_display_name') ? hf_catalog_display_name($product->get_name()) : $product->get_name();
    $description = hf_storefront_product_meta_description($product);
    $image_id = $product->get_image_id();
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    $offer = array(
        '@type' => 'Offer',
        'url' => $canonical,
        'priceCurrency' => get_woocommerce_currency(),
        'availability' => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'itemCondition' => 'https://schema.org/NewCondition',
        'hasMerchantReturnPolicy' => hf_storefront_return_policy_schema(),
    );
    if ($product->get_price() !== '') {
        $offer['price'] = (string) wc_format_decimal($product->get_price(), wc_get_price_decimals());
    }
    $product_schema = array(
        '@type' => 'Product',
        '@id' => $canonical . '#product',
        'name' => $display_name,
        'description' => $description,
        'image' => $image ? array($image) : array(),
        'sku' => hf_storefront_product_primary_sku($product),
        'brand' => array('@type' => 'Brand', 'name' => 'Horizon Fit'),
        'offers' => $offer,
    );
    $group_id = hf_storefront_product_group_id($product);
    if ($group_id !== '') {
        $product_schema['isVariantOf'] = array(
            '@type' => 'ProductGroup',
            'productGroupID' => $group_id,
            'name' => preg_replace('/\s+(blanco|negro|azul|celeste|verde|rosa|rojo|bordó|bordo)$/iu', '', $display_name),
        );
    }
    $color = hf_storefront_product_attribute_text($product, array('pa_color', 'color', 'Color'));
    $sizes = hf_storefront_product_attribute_text($product, array('pa_talle', 'talle', 'Talle'));
    if ($color !== '') {
        $product_schema['color'] = $color;
    }
    if ($sizes !== '') {
        $product_schema['size'] = $sizes;
    }

    return array(
        'route' => $route,
        'title' => $display_name . ' | Horizon Fit',
        'description' => $description,
        'canonical' => $canonical,
        'type' => 'product',
        'image' => $image,
        'robots' => $image ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
        'schema' => array($product_schema),
    );
}

function hf_storefront_term_seo($term) {
    $route = 'coleccion/' . $term->slug . '/';
    $canonical = hf_storefront_public_url($route);
    $fallback = sprintf('Explorá %s de Horizon Fit y encontrá prendas de activewear para combinar, entrenar y usar todos los días.', $term->name);
    $description = hf_storefront_seo_description($term->description, $fallback);
    $image_id = (int) get_term_meta($term->term_id, $term->taxonomy === 'product_cat' ? 'thumbnail_id' : 'hf_image_id', true);
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    $item_list = array();
    $product_ids = get_objects_in_term($term->term_id, $term->taxonomy);
    if (! is_wp_error($product_ids)) {
        $position = 1;
        foreach (array_unique(array_map('intval', $product_ids)) as $product_id) {
            $product = wc_get_product($product_id);
            if (! $product || 'publish' !== $product->get_status()) {
                continue;
            }
            $item_list[] = array(
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => $product->get_name(),
                'url' => hf_storefront_public_url('producto/' . $product->get_slug() . '/'),
            );
        }
    }

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
            'mainEntity' => array(
                '@type' => 'ItemList',
                'numberOfItems' => count($item_list),
                'itemListElement' => $item_list,
            ),
        )),
    );
}

function hf_regenerate_storefront_seo_cache() {
    if (! class_exists('WooCommerce')) {
        return false;
    }
    $template_path = ABSPATH . 'index.html';
    $template = @file_get_contents($template_path);
    if (! is_string($template) || $template === '') {
        return false;
    }

    $base = hf_storefront_seo_dir();
    wp_mkdir_p($base);
    $urls = array(hf_storefront_public_url('/'));
    $lastmods = array(hf_storefront_public_url('/') => gmdate('c', filemtime($template_path) ?: time()));
    $sitemap_images = array();

    $products = wc_get_products(array('status' => 'publish', 'limit' => -1, 'return' => 'objects'));
    foreach ($products as $product) {
        $seo = hf_storefront_product_seo($product);
        hf_storefront_write_route($template, $seo['route'], $seo);
        // Los productos sin imagen permanecen accesibles, pero no se envían a
        // Google hasta que el catálogo tenga una fotografía real.
        if (! empty($seo['image'])) {
            $urls[] = $seo['canonical'];
            $sitemap_images[$seo['canonical']] = $seo['image'];
            $lastmods[$seo['canonical']] = get_post_modified_time('c', true, $product->get_id()) ?: gmdate('c');
        }
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
            if (! empty($seo['image'])) {
                $sitemap_images[$seo['canonical']] = $seo['image'];
            }
        }
    }

    if (function_exists('hf_info_pages_get')) {
        foreach (hf_info_pages_get() as $slug => $page) {
            $route = trim($slug, '/') . '/';
            $canonical = hf_storefront_public_url($route);
            $description = hf_storefront_seo_description($page['content'], $page['description']);
            $has_content = trim((string) $page['content']) !== '';
            $page_type = 'WebPage';
            if ('quienes-somos' === $slug) {
                $page_type = 'AboutPage';
            } elseif ('contacto' === $slug) {
                $page_type = 'ContactPage';
            }
            $page_schema = array(
                '@type' => $page_type,
                '@id' => $canonical . '#webpage',
                'name' => $page['title'],
                'description' => $description,
                'url' => $canonical,
            );
            $schemas = array($page_schema);
            if ('preguntas-frecuentes' === $slug) {
                $faq_items = array(
                    array('¿Cómo elijo mi talle?', 'Consultá la guía de talles y la información específica de cada producto. Si seguís con dudas, escribinos con tus medidas y el nombre de la prenda.'),
                    array('¿Qué cuotas están disponibles?', 'Ofrecemos 3 cuotas sin interés desde $60.000 y 6 cuotas sin interés desde $150.000, sujeto a las tarjetas y medios habilitados en el checkout.'),
                    array('¿Cuándo el envío es gratis?', 'El envío es gratuito en compras iguales o superiores a $150.000.'),
                    array('¿Cómo sigo mi pedido?', 'Después del despacho enviamos la información de seguimiento al correo utilizado en la compra.'),
                    array('¿Cuánto tiempo tengo para cambiar una prenda?', 'Podés solicitar un cambio dentro de los 6 meses o una devolución dentro de los 15 días, respetando las condiciones publicadas.'),
                );
                $schemas[] = array(
                    '@type' => 'FAQPage',
                    '@id' => $canonical . '#faq',
                    'mainEntity' => array_map(static function ($item) {
                        return array(
                            '@type' => 'Question',
                            'name' => $item[0],
                            'acceptedAnswer' => array('@type' => 'Answer', 'text' => $item[1]),
                        );
                    }, $faq_items),
                );
            }
            $seo = array(
                'title' => $page['title'] . ' | Horizon Fit',
                'description' => $description,
                'canonical' => $canonical,
                'robots' => $has_content ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow',
                'type' => 'article',
                'schema' => $schemas,
            );
            hf_storefront_write_route($template, $route, $seo);
            if ($has_content) {
                $urls[] = $canonical;
                $lastmods[$canonical] = gmdate('c');
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
    $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\">\n";
    foreach ($urls as $url) {
        $xml .= '  <url><loc>' . esc_xml($url) . '</loc>';
        if (! empty($lastmods[$url])) {
            $xml .= '<lastmod>' . esc_xml($lastmods[$url]) . '</lastmod>';
        }
        if (! empty($sitemap_images[$url])) {
            $xml .= '<image:image><image:loc>' . esc_xml($sitemap_images[$url]) . '</image:loc></image:image>';
        }
        $xml .= "</url>\n";
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
