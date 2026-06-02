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

function hf_store_blocked_route_slugs() {
    return apply_filters('hf_store_blocked_route_slugs', array('checkout', 'cart', 'diplomatura', 'curso'));
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
