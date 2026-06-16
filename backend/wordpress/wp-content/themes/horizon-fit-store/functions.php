<?php
if (! defined('ABSPATH')) {
    exit;
}

function hf_store_theme_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support(
        'html5',
        array(
            'search-form',
            'comment-form',
            'comment-list',
            'gallery',
            'caption',
            'script',
            'style',
        )
    );
    add_theme_support('woocommerce');
    add_theme_support('wc-product-gallery-lightbox');
    add_theme_support('wc-product-gallery-slider');
    add_theme_support('wc-product-gallery-zoom');

    register_nav_menus(
        array(
            'primary' => __('Primary Menu', 'horizon-fit-store'),
            'footer'  => __('Footer Menu', 'horizon-fit-store'),
        )
    );
}
add_action('after_setup_theme', 'hf_store_theme_setup');

function hf_store_enqueue_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'hf-storefront',
        get_template_directory_uri() . '/assets/css/storefront.css',
        array(),
        $theme->get('Version')
    );
    wp_enqueue_script(
        'hf-storefront',
        get_template_directory_uri() . '/assets/js/storefront.js',
        array('jquery'),
        $theme->get('Version'),
        true
    );

    wp_localize_script(
        'hf-storefront',
        'hfStorefront',
        array(
            'cartUrl'     => hf_store_normalize_public_url(function_exists('wc_get_cart_url') ? wc_get_cart_url() : home_url('/cart/')),
            'checkoutUrl' => hf_store_normalize_public_url(function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : home_url('/checkout/')),
        )
    );
}
add_action('wp_enqueue_scripts', 'hf_store_enqueue_assets');

function hf_store_brand_name() {
    $name = get_bloginfo('name');
    return $name ? $name : 'Horizon Fit';
}

function hf_store_home_seo_description() {
    $site_description = get_bloginfo('description');
    if ($site_description) {
        return $site_description;
    }

    return __('Activewear funcional, colecciones pensadas para combinar y una experiencia de compra clara, rápida y móvil.', 'horizon-fit-store');
}

function hf_store_trim_seo_text($text, $limit = 155) {
    $text = trim(wp_strip_all_tags((string) $text));
    if ($text === '') {
        return '';
    }

    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text) <= $limit) {
            return $text;
        }
        return rtrim(mb_substr($text, 0, $limit - 1)) . '…';
    }

    if (strlen($text) <= $limit) {
        return $text;
    }

    return rtrim(substr($text, 0, $limit - 1)) . '…';
}

function hf_store_is_noindex_route() {
    return (function_exists('is_cart') && is_cart())
        || (function_exists('is_checkout') && is_checkout())
        || (function_exists('is_account_page') && is_account_page())
        || is_search()
        || is_404();
}

function hf_store_get_site_icon_url() {
    $brand_icon = home_url('/LOGOS/ISOTIPO.svg');
    if ($brand_icon) {
        return $brand_icon;
    }

    $icon = function_exists('get_site_icon_url') ? get_site_icon_url(512) : '';
    return $icon ? $icon : '';
}

function hf_store_get_default_social_image() {
    $image = hf_store_get_site_icon_url();
    if ($image) {
        return $image;
    }

    return '';
}

function hf_store_get_primary_entity() {
    if (function_exists('is_product') && is_product()) {
        $product = wc_get_product(get_queried_object_id());
        if ($product instanceof WC_Product) {
            return $product;
        }
    }

    if (function_exists('is_product_category') && is_product_category()) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            return $term;
        }
    }

    if (function_exists('is_tax') && is_tax('hf_collection')) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            return $term;
        }
    }

    return null;
}

function hf_store_get_seo_data() {
    $site_name = hf_store_brand_name();
    $canonical = home_url('/');
    $title = sprintf('%s | %s', $site_name, __('Ropa deportiva y conjuntos', 'horizon-fit-store'));
    $description = hf_store_home_seo_description();
    $robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
    $type = 'website';
    $image = hf_store_get_default_social_image();
    $schema = array();
    $breadcrumbs = array(
        array(
            'name' => __('Inicio', 'horizon-fit-store'),
            'url'  => home_url('/'),
        ),
    );

    if (hf_store_is_noindex_route()) {
        return array(
            'title'       => sprintf('%s | %s', $site_name, __('No index', 'horizon-fit-store')),
            'description' => __('Ruta operativa del sitio, no destinada a indexación.', 'horizon-fit-store'),
            'canonical'   => home_url('/'),
            'robots'      => 'noindex,nofollow',
            'type'        => 'website',
            'image'       => $image,
            'schema'      => array(),
        );
    }

    if (is_front_page() || is_home()) {
        $footer_copy = '';
        if (function_exists('get_field')) {
            $footer_copy = (string) get_field('copy', 'option');
        }
        $description = hf_store_trim_seo_text($footer_copy ?: hf_store_home_seo_description(), 160);
        $schema[] = array(
            '@type' => 'Organization',
            '@id'   => home_url('/#organization'),
            'name'  => $site_name,
            'url'   => home_url('/'),
        );
        $schema[] = array(
            '@type'       => 'WebSite',
            '@id'         => home_url('/#website'),
            'url'         => home_url('/'),
            'name'        => $site_name,
            'description' => $description,
            'potentialAction' => array(
                '@type'       => 'SearchAction',
                'target'      => home_url('/?s={search_term_string}'),
                'query-input' => 'required name=search_term_string',
            ),
        );
        return array(
            'title'       => $title,
            'description' => $description,
            'canonical'   => home_url('/'),
            'robots'      => $robots,
            'type'        => $type,
            'image'       => $image,
            'schema'      => $schema,
        );
    }

    if (function_exists('is_shop') && is_shop()) {
        $title = sprintf('%s | %s', __('Tienda', 'horizon-fit-store'), $site_name);
        $description = __('Descubrí prendas, sets y básicos de Horizon Fit conectados al catálogo real de WooCommerce.', 'horizon-fit-store');
        $canonical = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : get_post_type_archive_link('product');
        $breadcrumbs[] = array(
            'name' => __('Tienda', 'horizon-fit-store'),
            'url'  => $canonical,
        );
    } elseif (function_exists('is_product_category') && is_product_category()) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            $title = sprintf('%s | %s', $term->name, $site_name);
            $description = hf_store_trim_seo_text($term->description ?: sprintf(__('Explorá %s de Horizon Fit: prendas, combinaciones y piezas listas para vender el look.', 'horizon-fit-store'), $term->name), 160);
            $canonical = get_term_link($term);
            if (! is_wp_error($canonical)) {
                $canonical = $canonical;
            } else {
                $canonical = home_url('/');
            }
            $breadcrumbs[] = array(
                'name' => __('Tienda', 'horizon-fit-store'),
                'url'  => function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : get_post_type_archive_link('product'),
            );
            $breadcrumbs[] = array(
                'name' => $term->name,
                'url'  => $canonical,
            );
            $image = hf_store_get_term_image_url($term, 'large') ?: $image;
        }
    } elseif (function_exists('is_tax') && is_tax('hf_collection')) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            $title = sprintf('%s | %s', $term->name, $site_name);
            $description = hf_store_trim_seo_text($term->description ?: sprintf(__('Colección Horizon Fit: una selección curada para comprar el look completo.', 'horizon-fit-store'), $term->name), 160);
            $canonical = get_term_link($term);
            if (is_wp_error($canonical)) {
                $canonical = home_url('/');
            }
            $breadcrumbs[] = array(
                'name' => __('Tienda', 'horizon-fit-store'),
                'url'  => function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : get_post_type_archive_link('product'),
            );
            $breadcrumbs[] = array(
                'name' => $term->name,
                'url'  => $canonical,
            );
            $image = hf_store_get_term_image_url($term, 'large') ?: $image;
        }
    } elseif (function_exists('is_product') && is_product()) {
        $product = wc_get_product(get_queried_object_id());
        if ($product instanceof WC_Product) {
            $title = sprintf('%s | %s', $product->get_name(), $site_name);
            $description = hf_store_trim_seo_text(hf_store_excerpt_fallback($product), 160);
            $canonical = $product->get_permalink();
            $type = 'product';
            $image_id = $product->get_image_id();
            $image = $image_id ? (wp_get_attachment_image_url($image_id, 'full') ?: $image) : $image;
            $breadcrumbs[] = array(
                'name' => __('Tienda', 'horizon-fit-store'),
                'url'  => function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : get_post_type_archive_link('product'),
            );
            $product_terms = wp_get_post_terms($product->get_id(), 'product_cat');
            if (! is_wp_error($product_terms) && ! empty($product_terms)) {
                $term = $product_terms[0];
                if ($term instanceof WP_Term) {
                    $breadcrumbs[] = array(
                        'name' => $term->name,
                        'url'  => get_term_link($term),
                    );
                }
            }
            $breadcrumbs[] = array(
                'name' => $product->get_name(),
                'url'  => $canonical,
            );

            $offers = array(
                '@type'         => 'Offer',
                'url'           => $canonical,
                'priceCurrency' => get_woocommerce_currency(),
                'availability'  => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            );
            $price = $product->get_price();
            if ($price !== '') {
                $offers['price'] = (string) wc_format_decimal($price, wc_get_price_decimals());
            }

            $schema[] = array(
                '@type'       => 'Product',
                '@id'         => $canonical . '#product',
                'name'        => $product->get_name(),
                'description' => $description,
                'image'       => $image ? array($image) : array(),
                'sku'         => $product->get_sku(),
                'brand'       => array(
                    '@type' => 'Brand',
                    'name'  => $site_name,
                ),
                'offers'      => $offers,
            );
        }
    }

    $schema[] = array(
        '@type' => 'Organization',
        '@id'   => home_url('/#organization'),
        'name'  => $site_name,
        'url'   => home_url('/'),
    );
    $schema[] = array(
        '@type'       => 'WebSite',
        '@id'         => home_url('/#website'),
        'url'         => home_url('/'),
        'name'        => $site_name,
        'description' => $description,
        'potentialAction' => array(
            '@type'       => 'SearchAction',
            'target'      => home_url('/?s={search_term_string}'),
            'query-input' => 'required name=search_term_string',
        ),
    );

    if (count($breadcrumbs) > 1) {
        $item_list = array();
        foreach ($breadcrumbs as $index => $item) {
            $item_list[] = array(
                '@type'    => 'ListItem',
                'position' => $index + 1,
                'name'     => $item['name'],
                'item'     => $item['url'],
            );
        }
        $schema[] = array(
            '@type'           => 'BreadcrumbList',
            'itemListElement' => $item_list,
        );
    }

    return array(
        'title'       => $title,
        'description' => $description,
        'canonical'   => $canonical,
        'robots'      => $robots,
        'type'        => $type,
        'image'       => $image,
        'schema'      => $schema,
    );
}

function hf_store_get_seo_title() {
    $seo = hf_store_get_seo_data();
    return $seo['title'] ?? hf_store_brand_name();
}

function hf_store_filter_document_title($title) {
    return hf_store_get_seo_title();
}
add_filter('pre_get_document_title', 'hf_store_filter_document_title');

function hf_store_filter_wp_robots($robots) {
    $seo = hf_store_get_seo_data();
    if (! empty($seo['robots']) && 'noindex,nofollow' === $seo['robots']) {
        return array(
            'noindex'  => true,
            'nofollow' => true,
        );
    }

    $robots['max-image-preview'] = 'large';
    $robots['max-snippet'] = '-1';
    $robots['max-video-preview'] = '-1';
    return $robots;
}
add_filter('wp_robots', 'hf_store_filter_wp_robots');

function hf_store_output_seo_head() {
    $seo = hf_store_get_seo_data();
    $schema = array_values(array_filter((array) ($seo['schema'] ?? array())));
    $icon = hf_store_get_site_icon_url();
    ?>
    <meta name="description" content="<?php echo esc_attr($seo['description'] ?? ''); ?>">
    <link rel="canonical" href="<?php echo esc_url($seo['canonical'] ?? home_url('/')); ?>">
    <meta name="robots" content="<?php echo esc_attr($seo['robots'] ?? 'index,follow'); ?>">
    <?php if (! empty($icon)) : ?>
        <link rel="icon" href="<?php echo esc_url($icon); ?>" type="image/svg+xml">
        <link rel="shortcut icon" href="<?php echo esc_url($icon); ?>" type="image/svg+xml">
    <?php endif; ?>
    <meta property="og:site_name" content="<?php echo esc_attr(hf_store_brand_name()); ?>">
    <meta property="og:title" content="<?php echo esc_attr($seo['title'] ?? hf_store_brand_name()); ?>">
    <meta property="og:description" content="<?php echo esc_attr($seo['description'] ?? ''); ?>">
    <meta property="og:url" content="<?php echo esc_url($seo['canonical'] ?? home_url('/')); ?>">
    <meta property="og:type" content="<?php echo esc_attr($seo['type'] ?? 'website'); ?>">
    <?php if (! empty($seo['image'])) : ?>
        <meta property="og:image" content="<?php echo esc_url($seo['image']); ?>">
        <meta name="twitter:image" content="<?php echo esc_url($seo['image']); ?>">
    <?php endif; ?>
    <meta name="twitter:card" content="<?php echo ! empty($seo['image']) ? 'summary_large_image' : 'summary'; ?>">
    <meta name="twitter:title" content="<?php echo esc_attr($seo['title'] ?? hf_store_brand_name()); ?>">
    <meta name="twitter:description" content="<?php echo esc_attr($seo['description'] ?? ''); ?>">
    <?php if (! empty($schema)) : ?>
        <script type="application/ld+json"><?php echo wp_json_encode(array('@context' => 'https://schema.org', '@graph' => $schema), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?></script>
    <?php endif; ?>
    <?php
}
add_action('wp_head', 'hf_store_output_seo_head', 1);

function hf_store_robots_txt($output, $public) {
    $lines = array(
        'User-agent: *',
        'Disallow: /cart/',
        'Disallow: /checkout/',
        'Disallow: /my-account/',
        'Disallow: /wp-admin/',
        'Allow: /wp-admin/admin-ajax.php',
        'Sitemap: ' . home_url('/wp-sitemap.xml'),
    );

    return implode("\n", $lines) . "\n";
}
add_filter('robots_txt', 'hf_store_robots_txt', 10, 2);

function hf_store_sitemap_page_exclusions($args, $post_type) {
    if ('page' !== $post_type) {
        return $args;
    }

    $excluded_ids = array();
    foreach (array('cart', 'checkout', 'my-account') as $slug) {
        $page = get_page_by_path($slug);
        if ($page instanceof WP_Post) {
            $excluded_ids[] = $page->ID;
        }
    }

    if (! empty($excluded_ids)) {
        $args['post__not_in'] = array_values(array_unique(array_merge((array) ($args['post__not_in'] ?? array()), $excluded_ids)));
    }

    return $args;
}
add_filter('wp_sitemaps_posts_query_args', 'hf_store_sitemap_page_exclusions', 10, 2);

function hf_store_blocked_route_slugs() {
    return apply_filters('hf_store_blocked_route_slugs', array('checkout', 'cart', 'diplomatura', 'curso', 'modulo/asesoramiento-de-imagen'));
}

function hf_store_is_blocked_public_url($url) {
    $path = trim((string) parse_url((string) $url, PHP_URL_PATH), '/');
    if ($path === '') {
        return false;
    }

    foreach (hf_store_blocked_route_slugs() as $slug) {
        $slug = trim((string) $slug, '/');
        if ($slug === '') {
            continue;
        }

        if ($path === $slug || 0 === strpos($path, $slug . '/')) {
            return true;
        }
    }

    return false;
}

function hf_store_normalize_public_url($url) {
    if (! hf_store_is_blocked_public_url($url)) {
        return $url;
    }

    $fallback = get_post_type_archive_link('product');
    return $fallback ? $fallback : home_url('/');
}

function hf_store_block_private_routes() {
    if (is_admin()) {
        return;
    }

    if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
        return;
    }

    if (function_exists('wp_is_json_request') && wp_is_json_request()) {
        return;
    }

    if (function_exists('is_cart') && is_cart()) {
        wp_die(
            esc_html__('Esta sección está temporalmente deshabilitada.', 'horizon-fit-store'),
            esc_html__('En mantenimiento', 'horizon-fit-store'),
            array('response' => 503)
        );
    }

    if (function_exists('is_checkout') && is_checkout()) {
        wp_die(
            esc_html__('Esta sección está temporalmente deshabilitada.', 'horizon-fit-store'),
            esc_html__('En mantenimiento', 'horizon-fit-store'),
            array('response' => 503)
        );
    }

    if (function_exists('is_page') && is_page(array('diplomatura', 'curso'))) {
        wp_die(
            esc_html__('Esta sección está temporalmente deshabilitada.', 'horizon-fit-store'),
            esc_html__('En mantenimiento', 'horizon-fit-store'),
            array('response' => 503)
        );
    }

    $request_path = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
    if ($request_path === '') {
        return;
    }

    foreach (hf_store_blocked_route_slugs() as $slug) {
        $slug = trim((string) $slug, '/');
        if ($slug === '') {
            continue;
        }

        if ($request_path === $slug || 0 === strpos($request_path, $slug . '/')) {
            wp_die(
                esc_html__('Esta sección está temporalmente deshabilitada.', 'horizon-fit-store'),
                esc_html__('En mantenimiento', 'horizon-fit-store'),
                array('response' => 503)
            );
        }
    }
}
add_action('template_redirect', 'hf_store_block_private_routes', 1);

function hf_store_register_sidebars() {
    register_sidebar(
        array(
            'name'          => __('Footer Contact', 'horizon-fit-store'),
            'id'            => 'footer-contact',
            'before_widget' => '<div class="hf-footer-widget">',
            'after_widget'  => '</div>',
            'before_title'  => '<h3 class="hf-footer-widget__title">',
            'after_title'   => '</h3>',
        )
    );
}
add_action('widgets_init', 'hf_store_register_sidebars');

function hf_store_format_money($value) {
    return function_exists('wc_price') ? wc_price($value) : '$' . number_format((float) $value, 0, ',', '.');
}

function hf_store_get_product_sizes($product) {
    if (! $product instanceof WC_Product) {
        return array();
    }

    $sizes = array();
    $attributes = $product->get_attributes();
    foreach ($attributes as $attribute) {
        $name = strtolower($attribute->get_name());
        if (false === strpos($name, 'talle')) {
            continue;
        }

        if ($attribute->is_taxonomy()) {
            $terms = wc_get_product_terms($product->get_id(), $attribute->get_name(), array('fields' => 'names'));
            $sizes = array_merge($sizes, $terms);
        } else {
            $sizes = array_merge($sizes, $attribute->get_options());
        }
    }

    return array_values(array_unique(array_filter($sizes)));
}

function hf_store_get_term_image_url($term, $size = 'full') {
    if (! $term instanceof WP_Term) {
        return '';
    }

    $attachment_id = 0;
    if ('product_cat' === $term->taxonomy) {
        $attachment_id = (int) get_term_meta($term->term_id, 'thumbnail_id', true);
    } else {
        $attachment_id = (int) get_term_meta($term->term_id, 'hf_image_id', true);
    }

    if ($attachment_id) {
        $image = wp_get_attachment_image_url($attachment_id, $size);
        if ($image) {
            return $image;
        }
    }

    return (string) get_term_meta($term->term_id, 'hf_remote_image', true);
}

function hf_store_get_home_categories($limit = 6) {
    $terms = get_terms(
        array(
            'taxonomy'   => 'product_cat',
            'hide_empty' => false,
            'meta_query' => array(
                array(
                    'key'   => 'hf_featured_home',
                    'value' => '1',
                ),
            ),
            'orderby'    => 'meta_value_num',
            'meta_key'   => 'hf_home_order',
            'order'      => 'ASC',
            'number'     => $limit,
        )
    );

    return is_wp_error($terms) ? array() : $terms;
}

function hf_store_get_featured_collections($limit = 5) {
    $terms = get_terms(
        array(
            'taxonomy'   => 'hf_collection',
            'hide_empty' => false,
            'meta_query' => array(
                array(
                    'key'   => 'hf_featured_home',
                    'value' => '1',
                ),
            ),
            'orderby'    => 'meta_value_num',
            'meta_key'   => 'hf_home_order',
            'order'      => 'ASC',
            'number'     => $limit,
        )
    );

    return is_wp_error($terms) ? array() : $terms;
}

function hf_store_get_collection_products($term_id, $limit = 8, $exclude = array()) {
    $ids = get_posts(
        array(
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'posts_per_page' => $limit,
            'post__not_in'   => array_map('intval', $exclude),
            'fields'         => 'ids',
            'tax_query' => array(
                array(
                    'taxonomy' => 'hf_collection',
                    'terms'    => array((int) $term_id),
                    'field'    => 'term_id',
                ),
            ),
        )
    );

    return array_values(array_filter(array_map('wc_get_product', $ids)));
}

function hf_store_get_related_products_for_look($product_id, $limit = 3) {
    $collection_ids = wp_get_post_terms($product_id, 'hf_collection', array('fields' => 'ids'));
    if (! empty($collection_ids) && ! is_wp_error($collection_ids)) {
        $products = get_posts(
            array(
                'post_type'      => 'product',
                'post_status'    => 'publish',
                'post__not_in'   => array($product_id),
                'posts_per_page' => $limit,
                'fields'         => 'ids',
                'tax_query' => array(
                    array(
                        'taxonomy' => 'hf_collection',
                        'terms'    => $collection_ids,
                        'field'    => 'term_id',
                    ),
                ),
            )
        );
        if (! empty($products)) {
            return array_values(array_filter(array_map('wc_get_product', $products)));
        }
    }

    $category_ids = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'ids'));
    $products = get_posts(
        array(
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'post__not_in'   => array($product_id),
            'posts_per_page' => $limit,
            'fields'         => 'ids',
            'tax_query'      => array(
                array(
                    'taxonomy' => 'product_cat',
                    'terms'    => array_map('intval', array_filter($category_ids)),
                    'field'    => 'term_id',
                ),
            ),
        )
    );

    return array_values(array_filter(array_map('wc_get_product', $products)));
}

function hf_store_get_default_variation_payload($product) {
    if (! $product instanceof WC_Product_Variable) {
        return null;
    }

    $default_attributes = $product->get_default_attributes();
    $available = $product->get_available_variations();
    foreach ($available as $variation) {
        $match = true;
        foreach ($default_attributes as $name => $value) {
            $key = 'attribute_' . sanitize_title($name);
            if (! isset($variation['attributes'][ $key ]) || (string) $variation['attributes'][ $key ] !== (string) $value) {
                $match = false;
                break;
            }
        }

        if ($match) {
            return array(
                'variation_id' => (int) $variation['variation_id'],
                'attributes'   => $variation['attributes'],
            );
        }
    }

    if (! empty($available[0])) {
        return array(
            'variation_id' => (int) $available[0]['variation_id'],
            'attributes'   => $available[0]['attributes'],
        );
    }

    return null;
}

function hf_store_get_primary_menu_links() {
    return array(
        array(
            'label' => __('Productos destacados', 'horizon-fit-store'),
            'url'   => is_front_page() ? '#productGrid1' : home_url('/'),
        ),
        array(
            'label' => __('Conjuntos destacados', 'horizon-fit-store'),
            'url'   => is_front_page() ? '#fullSlider' : get_post_type_archive_link('product'),
        ),
        array(
            'label' => __('Compra por categoría', 'horizon-fit-store'),
            'url'   => is_front_page() ? '#homeCategories' : get_post_type_archive_link('product'),
        ),
        array(
            'label' => __('Ofertas', 'horizon-fit-store'),
            'url'   => hf_store_get_offers_url(),
        ),
        array(
            'label' => __('Carrito', 'horizon-fit-store'),
            'url'   => hf_store_normalize_public_url(function_exists('wc_get_cart_url') ? wc_get_cart_url() : '#'),
        ),
    );
}

function hf_store_get_offers_url() {
    $offers_link = get_term_link('ofertas', 'product_cat');
    return is_wp_error($offers_link) ? get_post_type_archive_link('product') : $offers_link;
}

function hf_store_body_classes($classes) {
    if (function_exists('is_woocommerce') && is_woocommerce()) {
        $classes[] = 'hf-woocommerce-page';
    }

    if (function_exists('is_cart') && is_cart()) {
        $classes[] = 'hf-cart-page';
    }

    if (function_exists('is_checkout') && is_checkout()) {
        $classes[] = 'hf-checkout-page';
    }

    return $classes;
}
add_filter('body_class', 'hf_store_body_classes');

function hf_store_excerpt_fallback($product) {
    if (! $product instanceof WC_Product) {
        return '';
    }

    $excerpt = $product->get_short_description();
    if ($excerpt) {
        return $excerpt;
    }

    $description = wp_strip_all_tags($product->get_description());
    if (! $description) {
        return __('Entrenamiento, comodidad y diseño funcional para tu rutina diaria.', 'horizon-fit-store');
    }

    return wp_trim_words($description, 32);
}

function hf_store_render_product_card($product) {
    if (! $product instanceof WC_Product) {
        return;
    }

    wc_get_template(
        'template-parts/product-card.php',
        array('product' => $product),
        '',
        trailingslashit(get_template_directory())
    );
}

function hf_store_render_collection_card($term) {
    if (! $term instanceof WP_Term) {
        return;
    }

    wc_get_template(
        'template-parts/collection-card.php',
        array('term' => $term),
        '',
        trailingslashit(get_template_directory())
    );
}

function hf_store_cart_count_fragment($fragments) {
    ob_start();
    ?>
    <span class="hf-cart-button__count" data-cart-count><?php echo function_exists('WC') && WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0; ?></span>
    <?php
    $fragments['span[data-cart-count]'] = ob_get_clean();
    return $fragments;
}
add_filter('woocommerce_add_to_cart_fragments', 'hf_store_cart_count_fragment');
