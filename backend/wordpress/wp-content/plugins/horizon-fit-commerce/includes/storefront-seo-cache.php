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

function hf_storefront_template_path() {
    $configured = trim((string) getenv('HF_STOREFRONT_TEMPLATE_PATH'));
    if ($configured !== '' && is_readable($configured)) {
        return $configured;
    }
    return ABSPATH . 'index.html';
}

function hf_storefront_seo_description($value, $fallback = '') {
    $value = preg_replace('/<\s*\/?\s*(p|br|div|section|article|header|footer|h[1-6]|li|ul|ol)\b[^>]*>/i', ' ', (string) $value);
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

function hf_storefront_shipping_service_schema() {
    return array(
        '@type' => 'ShippingService',
        '@id' => hf_storefront_public_url('envios-y-entregas/#envios'),
        'name' => 'Envíos a todo el país',
        'fulfillmentType' => 'https://schema.org/FulfillmentTypeDelivery',
        'shippingConditions' => array(
            '@type' => 'ShippingConditions',
            'shippingDestination' => array(
                '@type' => 'DefinedRegion',
                'addressCountry' => 'AR',
            ),
        ),
    );
}

function hf_storefront_offer_shipping_reference_schema() {
    return array(
        '@type' => 'OfferShippingDetails',
        'hasShippingService' => array(
            '@id' => hf_storefront_public_url('envios-y-entregas/#envios'),
        ),
    );
}

function hf_storefront_display_name($product) {
    if (! $product instanceof WC_Product) {
        return '';
    }
    return function_exists('hf_catalog_display_name')
        ? hf_catalog_display_name($product->get_name())
        : $product->get_name();
}

function hf_storefront_product_image_id($product) {
    if (! $product instanceof WC_Product) {
        return 0;
    }
    $image_id = (int) $product->get_image_id();
    if ($image_id) {
        return $image_id;
    }
    $gallery = array_values(array_filter(array_map('intval', (array) $product->get_gallery_image_ids())));
    return $gallery ? $gallery[0] : 0;
}

function hf_storefront_product_color($product) {
    $color = hf_storefront_product_attribute_text($product, array('pa_color', 'color', 'Color'));
    if ($color !== '') {
        return $color;
    }
    $name = hf_storefront_display_name($product);
    $colors = array(
        'Bordeaux' => '/\b(bordeaux|bord[oó])\b/iu',
        'Blanco' => '/\bblanc[oa]\b/iu',
        'Negro' => '/\bnegr[oa]\b/iu',
        'Celeste' => '/\bceleste\b/iu',
        'Verde' => '/\bverde\b/iu',
        'Rosa' => '/\brosa\b/iu',
        'Rojo' => '/\broj[oa]\b/iu',
        'Azul' => '/\bazul\b/iu',
    );
    foreach ($colors as $label => $pattern) {
        if (preg_match($pattern, $name)) {
            return $label;
        }
    }
    return '';
}

function hf_storefront_product_sizes($product) {
    $sizes = hf_storefront_product_attribute_text($product, array('pa_talle', 'talle', 'Talle'));
    if ($sizes !== '') {
        return array_values(array_filter(array_map('trim', preg_split('/\s*[|,]\s*/u', $sizes))));
    }
    if (! $product instanceof WC_Product || ! $product->is_type('variable')) {
        return array();
    }
    $values = array();
    foreach ($product->get_children() as $variation_id) {
        $variation = wc_get_product($variation_id);
        if (! $variation) {
            continue;
        }
        $size = hf_storefront_product_attribute_text($variation, array('pa_talle', 'talle', 'Talle'));
        if ($size !== '') {
            $values[] = $size;
        }
    }
    return array_values(array_unique($values));
}

function hf_storefront_product_categories($product) {
    if (! $product instanceof WC_Product) {
        return '';
    }
    $terms = wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names'));
    return is_wp_error($terms) ? '' : implode(', ', array_filter($terms));
}

function hf_storefront_product_offer_schema($product, $canonical) {
    $offer = array(
        '@type' => 'Offer',
        'url' => $canonical,
        'priceCurrency' => get_woocommerce_currency(),
        'availability' => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'itemCondition' => 'https://schema.org/NewCondition',
        'hasMerchantReturnPolicy' => hf_storefront_return_policy_schema(),
        'shippingDetails' => hf_storefront_offer_shipping_reference_schema(),
    );
    if ($product->get_price() !== '') {
        $offer['price'] = (string) wc_format_decimal($product->get_price(), wc_get_price_decimals());
    }
    return $offer;
}

function hf_storefront_price_text($product) {
    if (! $product instanceof WC_Product || $product->get_price() === '') {
        return '';
    }
    return trim(wp_strip_all_tags(wc_price($product->get_price())));
}

function hf_storefront_prerender_chrome() {
    $message = esc_html__('3 Y 6 CUOTAS SIN INTERÉS', 'horizon-fit-commerce');
    $marquee_items = '';
    for ($index = 0; $index < 10; $index++) {
        $marquee_items .= '<span class="hf-prerender__marquee-item">' . $message . '</span>' .
            '<span class="hf-prerender__marquee-separator" aria-hidden="true"></span>';
    }

    return '<div class="hf-prerender__chrome" aria-hidden="true">' .
        '<div class="hf-prerender__marquee"><div class="hf-prerender__marquee-track">' . $marquee_items . '</div></div>' .
        '<div class="hf-prerender__nav">' .
            '<div class="hf-prerender__nav-left">' .
                '<span class="hf-prerender__nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></span>' .
                '<span class="hf-prerender__nav-icon hf-prerender__nav-search-mobile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>' .
            '</div>' .
            '<span class="hf-prerender__brand">' .
                '<span class="hf-prerender__brand-isotipo"></span>' .
                '<span class="hf-prerender__brand-logotipo"></span>' .
            '</span>' .
            '<div class="hf-prerender__nav-right">' .
                '<span class="hf-prerender__nav-icon hf-prerender__nav-search-desktop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>' .
                '<span class="hf-prerender__nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg></span>' .
                '<span class="hf-prerender__nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></span>' .
            '</div>' .
        '</div>' .
    '</div>';
}

function hf_storefront_product_card_html($product, $heading_level = 2) {
    if (! $product instanceof WC_Product) {
        return '';
    }
    $name = hf_storefront_display_name($product);
    $url = hf_storefront_public_url('producto/' . $product->get_slug() . '/');
    $image_id = hf_storefront_product_image_id($product);
    $image = $image_id ? wp_get_attachment_image($image_id, 'large', false, array(
        'alt' => $name,
        'loading' => 'lazy',
        'decoding' => 'async',
    )) : '';
    $heading = max(2, min(3, (int) $heading_level));
    return '<a class="hf-prerender__card" href="' . esc_url($url) . '">' .
        $image .
        '<h' . $heading . '>' . esc_html($name) . '</h' . $heading . '>' .
        ($product->get_price() !== '' ? '<p>' . esc_html(hf_storefront_price_text($product)) . '</p>' : '') .
        '</a>';
}

function hf_storefront_product_body($product, $image_id) {
    $name = hf_storefront_display_name($product);
    $description = trim((string) $product->get_description());
    if ($description === '') {
        $description = trim((string) $product->get_short_description());
    }
    $image = $image_id ? wp_get_attachment_image($image_id, 'full', false, array(
        'class' => 'hf-prerender__image',
        'alt' => $name,
        'loading' => 'eager',
        'fetchpriority' => 'high',
        'decoding' => 'async',
    )) : '';
    $sizes = hf_storefront_product_sizes($product);
    $color = hf_storefront_product_color($product);
    $category = hf_storefront_product_categories($product);
    return '<div class="hf-prerender hf-prerender--product" data-hf-prerender>' .
        hf_storefront_prerender_chrome() .
        '<article class="hf-prerender__product">' .
        ($image ? '<div class="hf-prerender__product-media">' . $image . '</div>' : '') .
        '<div class="hf-prerender__product-info">' .
        ($category ? '<p class="hf-prerender__product-kicker">' . esc_html($category) . '</p>' : '') .
        '<h1>' . esc_html($name) . '</h1>' .
        ($product->get_price() !== '' ? '<p class="hf-prerender__price">' . esc_html(hf_storefront_price_text($product)) . '</p>' : '') .
        '<p><strong>' . esc_html($product->is_in_stock() ? 'Disponible' : 'Sin stock') . '</strong></p>' .
        ($color ? '<p><strong>Color:</strong> ' . esc_html($color) . '</p>' : '') .
        ($sizes ? '<p><strong>Talles:</strong> ' . esc_html(implode(', ', $sizes)) . '</p>' : '') .
        ($description ? '<div class="hf-prerender__copy">' . wp_kses_post(wpautop($description)) . '</div>' : '') .
        '</div></article></div>';
}

function hf_storefront_collection_body($term, $products, $description) {
    $cards = '';
    foreach ($products as $product) {
        $cards .= hf_storefront_product_card_html($product, 2);
    }
    return '<div class="hf-prerender hf-prerender--collection" data-hf-prerender>' .
        hf_storefront_prerender_chrome() .
        '<h1>' . esc_html($term->name) . '</h1>' .
        '<div class="hf-prerender__grid">' . $cards . '</div></div>';
}

function hf_storefront_info_body($page) {
    return '<div class="hf-prerender hf-prerender--info" data-hf-prerender>' .
        hf_storefront_prerender_chrome() .
        '<div class="hf-prerender__info-inner">' .
        '<p class="hf-prerender__info-kicker">' . esc_html__('Ayuda', 'horizon-fit-commerce') . '</p>' .
        '<h1>' . esc_html($page['title']) . '</h1>' .
        '<div class="hf-prerender__copy">' . wp_kses_post((string) $page['content']) . '</div></div></div>';
}

function hf_storefront_home_body() {
    return '<div class="hf-prerender hf-prerender--home" data-hf-prerender>' .
        hf_storefront_prerender_chrome() .
        '<section class="hf-prerender__hero">' .
        '<div class="hf-seo-only"><h1>Horizon Fit: activewear para entrenar y vivir en movimiento</h1>' .
        '<p>Descubrí tops, calzas, shorts, camperas y conjuntos Horizon Fit pensados para combinar comodidad, diseño y movimiento todos los días.</p></div>' .
        '<picture><source media="(max-width: 768px)" srcset="' . esc_url(hf_storefront_public_url('assets/hero-poster-mobile.jpg')) . '">' .
        '<img class="hf-prerender__image" src="' . esc_url(hf_storefront_public_url('assets/hero-poster-desktop.jpg')) . '" alt="Activewear Horizon Fit" width="1920" height="1080" loading="eager" fetchpriority="high" decoding="async"></picture></section>' .
        '</div>';
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
    $organization_schema = array(
            '@type' => 'Organization',
            '@id' => hf_storefront_public_url('/#organization'),
            'name' => 'Horizon Fit',
            'url' => hf_storefront_public_url('/'),
            'email' => 'hola@horizonfit.com.ar',
            'logo' => hf_storefront_public_url('LOGOS/favicon-512.png'),
            'sameAs' => array(
                'https://www.instagram.com/horizonfit.oficial/',
                'https://www.tiktok.com/@horizon.fit',
                'https://www.facebook.com/profile.php?id=61582311777195',
                'https://open.spotify.com/playlist/6SM4GvEnXAoI3wfHlHh8aC',
            ),
    );
    if (hf_storefront_public_url('envios-y-entregas/') === $seo['canonical']) {
        $organization_schema['hasShippingService'] = hf_storefront_shipping_service_schema();
    }
    $global_schema = array(
        $organization_schema,
        array(
            '@type' => 'WebSite',
            '@id' => hf_storefront_public_url('/#website'),
            'name' => 'Horizon Fit',
            'url' => hf_storefront_public_url('/'),
            'description' => 'Activewear funcional para entrenar y vivir en movimiento.',
        ),
    );
    $page_schema = array_values($seo['schema'] ?? array());
    $schema = wp_json_encode(
        array('@context' => 'https://schema.org', '@graph' => array_merge($global_schema, $page_schema)),
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
    $html = hf_storefront_replace_head_node($html, '/<script\s+id="hfSeoJsonLd"[^>]*>.*?<\/script>/is', '<script id="hfSeoJsonLd" type="application/ld+json">' . $schema . '</script>');
    return $html;
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
    $image_id = hf_storefront_product_image_id($product);
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    $offer = hf_storefront_product_offer_schema($product, $canonical);
    $color = hf_storefront_product_color($product);
    $sizes = hf_storefront_product_sizes($product);
    $category = hf_storefront_product_categories($product);
    $material = hf_storefront_product_attribute_text($product, array('pa_material', 'material', 'Material'));
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
    if ($category !== '') {
        $product_schema['category'] = $category;
    }
    if ($material !== '') {
        $product_schema['material'] = $material;
    }
    if ($color !== '') {
        $product_schema['color'] = $color;
    }
    $group_id = hf_storefront_product_group_id($product);
    if ($group_id !== '' && ! $product->is_type('variable')) {
        $product_schema['isVariantOf'] = array(
            '@type' => 'ProductGroup',
            'productGroupID' => $group_id,
            'name' => preg_replace('/\s+(blanco|negro|azul|celeste|verde|rosa|rojo|bordó|bordo)$/iu', '', $display_name),
        );
    }
    if ($sizes && ! $product->is_type('variable')) {
        $product_schema['size'] = implode(', ', $sizes);
    }

    if ($product->is_type('variable') && $product->get_children()) {
        $variants = array();
        foreach ($product->get_children() as $variation_id) {
            $variation = wc_get_product($variation_id);
            if (! $variation || 'publish' !== $variation->get_status()) {
                continue;
            }
            $variation_sizes = hf_storefront_product_sizes($variation);
            $variation_schema = array(
                '@type' => 'Product',
                '@id' => $canonical . '#variation-' . $variation->get_id(),
                'name' => $display_name . ($variation_sizes ? ' - ' . implode(', ', $variation_sizes) : ''),
                'url' => $canonical,
                'sku' => $variation->get_sku(),
                'image' => $image ? array($image) : array(),
                'brand' => array('@type' => 'Brand', 'name' => 'Horizon Fit'),
                'offers' => hf_storefront_product_offer_schema($variation, $canonical),
            );
            if ($variation_sizes) {
                $variation_schema['size'] = implode(', ', $variation_sizes);
            }
            if ($color !== '') {
                $variation_schema['color'] = $color;
            }
            if ($category !== '') {
                $variation_schema['category'] = $category;
            }
            if ($material !== '') {
                $variation_schema['material'] = $material;
            }
            $variants[] = $variation_schema;
        }
        if ($variants) {
            $product_schema = array(
                '@type' => 'ProductGroup',
                '@id' => $canonical . '#product-group',
                'name' => $display_name,
                'description' => $description,
                'url' => $canonical,
                'image' => $image ? array($image) : array(),
                'brand' => array('@type' => 'Brand', 'name' => 'Horizon Fit'),
                'productGroupID' => $group_id ?: 'HF-' . $product->get_id(),
                'variesBy' => array('https://schema.org/size'),
                'hasVariant' => $variants,
            );
            if ($color !== '') {
                $product_schema['color'] = $color;
            }
            if ($category !== '') {
                $product_schema['category'] = $category;
            }
            if ($material !== '') {
                $product_schema['material'] = $material;
            }
        }
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
        'body' => hf_storefront_product_body($product, $image_id),
    );
}

function hf_storefront_term_seo($term) {
    $route = 'coleccion/' . $term->slug . '/';
    $canonical = hf_storefront_public_url($route);
    $fallback = sprintf('Explorá %s de Horizon Fit y encontrá prendas de activewear cómodas y funcionales para combinar, entrenar y acompañarte todos los días.', $term->name);
    $description_source = trim((string) $term->description);
    if ($description_source !== '' && function_exists('mb_strlen') && mb_strlen(wp_strip_all_tags($description_source)) < 120) {
        $description_source .= ' Descubrí modelos, colores y prendas diseñadas para combinar comodidad, movimiento y estilo.';
    }
    $description = hf_storefront_seo_description($description_source, $fallback);
    $image_id = (int) get_term_meta($term->term_id, $term->taxonomy === 'product_cat' ? 'thumbnail_id' : 'hf_image_id', true);
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'full') : '';
    $item_list = array();
    $products = array();
    $product_ids = get_objects_in_term($term->term_id, $term->taxonomy);
    if (! is_wp_error($product_ids)) {
        $position = 1;
        foreach (array_unique(array_map('intval', $product_ids)) as $product_id) {
            $product = wc_get_product($product_id);
            if (! $product || 'publish' !== $product->get_status()) {
                continue;
            }
            $products[] = $product;
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
        'body' => hf_storefront_collection_body($term, $products, $description),
    );
}

function hf_regenerate_storefront_seo_cache() {
    if (! class_exists('WooCommerce')) {
        return false;
    }
    $template_path = hf_storefront_template_path();
    $template = @file_get_contents($template_path);
    if (! is_string($template) || $template === '') {
        return false;
    }

    $base = hf_storefront_seo_dir();
    wp_mkdir_p($base);
    $urls = array(hf_storefront_public_url('/'));
    $lastmods = array(hf_storefront_public_url('/') => gmdate('c', filemtime($template_path) ?: time()));
    $sitemap_images = array();

    $products = wc_get_products(array(
        'status' => 'publish',
        'limit' => -1,
        'return' => 'objects',
        'orderby' => 'date',
        'order' => 'DESC',
    ));
    $home_description = hf_storefront_seo_description(
        'Descubrí activewear funcional de Horizon Fit: tops, calzas, shorts, camperas y conjuntos cómodos para entrenar y vivir en movimiento.'
    );
    $home_image = hf_storefront_public_url('assets/hero-poster-desktop.jpg');
    hf_storefront_write_route($template, '', array(
        'title' => 'Horizon Fit | Ropa deportiva y conjuntos',
        'description' => $home_description,
        'canonical' => hf_storefront_public_url('/'),
        'type' => 'website',
        'image' => $home_image,
        'schema' => array(
            array(
                '@type' => 'WebPage',
                '@id' => hf_storefront_public_url('/#webpage'),
                'name' => 'Horizon Fit | Ropa deportiva y conjuntos',
                'url' => hf_storefront_public_url('/'),
                'description' => $home_description,
            ),
        ),
        'body' => hf_storefront_home_body(),
    ));
    $sitemap_images[hf_storefront_public_url('/')] = $home_image;
    foreach ($products as $product) {
        // Si el producto tiene galería pero perdió la imagen destacada,
        // promovemos la primera foto existente. No crea ni borra medios.
        if (! $product->get_image_id()) {
            $fallback_image_id = hf_storefront_product_image_id($product);
            if ($fallback_image_id) {
                set_post_thumbnail($product->get_id(), $fallback_image_id);
            }
        }
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
                    array('¿Qué cuotas están disponibles?', 'Ofrecemos 3 y 6 cuotas sin interés, sujeto a las tarjetas y medios habilitados en el checkout.'),
                    array('¿Cómo se calcula el envío?', 'Las opciones de envío, costos y plazos disponibles se muestran durante el checkout.'),
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
                'body' => hf_storefront_info_body($page),
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
