<?php

if (! defined('ABSPATH')) {
    exit;
}

const HF_NEWSLETTER_POST_TYPE = 'hf_newsletter_sub';

add_action('init', function () {
    register_post_type(HF_NEWSLETTER_POST_TYPE, array(
        'labels' => array(
            'name'          => __('Suscriptores', 'horizon-fit-commerce'),
            'singular_name' => __('Suscriptor', 'horizon-fit-commerce'),
            'menu_name'     => __('Suscriptores', 'horizon-fit-commerce'),
            'all_items'     => __('Todos los suscriptores', 'horizon-fit-commerce'),
            'search_items'  => __('Buscar suscriptores', 'horizon-fit-commerce'),
            'not_found'     => __('No hay suscriptores todavía.', 'horizon-fit-commerce'),
        ),
        'public'              => false,
        'publicly_queryable'  => false,
        'exclude_from_search' => true,
        'show_ui'             => true,
        'show_in_menu'        => 'hf-panel',
        'show_in_rest'        => false,
        'supports'            => array('title'),
        'map_meta_cap'        => false,
        'capabilities'        => array(
            'edit_post'              => 'manage_woocommerce',
            'read_post'              => 'manage_woocommerce',
            'delete_post'            => 'manage_woocommerce',
            'edit_posts'             => 'manage_woocommerce',
            'edit_others_posts'      => 'manage_woocommerce',
            'publish_posts'          => 'manage_woocommerce',
            'read_private_posts'     => 'manage_woocommerce',
            'delete_posts'           => 'manage_woocommerce',
            'delete_private_posts'   => 'manage_woocommerce',
            'delete_published_posts' => 'manage_woocommerce',
            'delete_others_posts'    => 'manage_woocommerce',
            'edit_private_posts'     => 'manage_woocommerce',
            'edit_published_posts'   => 'manage_woocommerce',
            'create_posts'           => 'do_not_allow',
        ),
    ));
});

/**
 * Guarda un alta de newsletter sin duplicar direcciones.
 *
 * @return array|WP_Error
 */
function hf_commerce_subscribe_newsletter($email, $source = 'footer', $order_id = 0) {
    $email = sanitize_email((string) $email);
    if (! is_email($email)) {
        return new WP_Error('hf_invalid_newsletter_email', __('Ingresá un email válido.', 'horizon-fit-commerce'));
    }

    $source = sanitize_key((string) $source);
    if (! in_array($source, array('footer', 'checkout'), true)) {
        $source = 'footer';
    }

    $email_key = hash('sha256', strtolower($email));
    $existing = get_posts(array(
        'post_type'      => HF_NEWSLETTER_POST_TYPE,
        'post_status'    => array('publish', 'draft'),
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_key'       => '_hf_newsletter_email_hash',
        'meta_value'     => $email_key,
        'no_found_rows'  => true,
    ));

    if ($existing) {
        $subscriber_id = (int) $existing[0];
        update_post_meta($subscriber_id, '_hf_newsletter_status', 'subscribed');
        update_post_meta($subscriber_id, '_hf_newsletter_last_source', $source);
        update_post_meta($subscriber_id, '_hf_newsletter_updated_at', current_time('mysql', true));
        if ($order_id) {
            update_post_meta($subscriber_id, '_hf_newsletter_order_id', absint($order_id));
        }
        return array('subscriber_id' => $subscriber_id, 'created' => false);
    }

    $subscriber_id = wp_insert_post(array(
        'post_type'   => HF_NEWSLETTER_POST_TYPE,
        'post_status' => 'publish',
        'post_title'  => $email,
    ), true);
    if (is_wp_error($subscriber_id)) {
        return $subscriber_id;
    }

    update_post_meta($subscriber_id, '_hf_newsletter_email', $email);
    update_post_meta($subscriber_id, '_hf_newsletter_email_hash', $email_key);
    update_post_meta($subscriber_id, '_hf_newsletter_status', 'subscribed');
    update_post_meta($subscriber_id, '_hf_newsletter_source', $source);
    update_post_meta($subscriber_id, '_hf_newsletter_last_source', $source);
    update_post_meta($subscriber_id, '_hf_newsletter_consent_at', current_time('mysql', true));
    if ($order_id) {
        update_post_meta($subscriber_id, '_hf_newsletter_order_id', absint($order_id));
    }

    return array('subscriber_id' => (int) $subscriber_id, 'created' => true);
}

function hf_commerce_newsletter_subscribe_rest(WP_REST_Request $request) {
    // Honeypot silencioso para bots. Los usuarios reales nunca completan este campo.
    if (trim((string) $request->get_param('company')) !== '') {
        return rest_ensure_response(array('subscribed' => true, 'created' => false));
    }

    $remote_address = isset($_SERVER['HTTP_CF_CONNECTING_IP'])
        ? sanitize_text_field(wp_unslash($_SERVER['HTTP_CF_CONNECTING_IP']))
        : (isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown');
    $rate_key = 'hf_newsletter_rate_' . substr(hash_hmac('sha256', $remote_address, wp_salt('nonce')), 0, 32);
    $attempts = (int) get_transient($rate_key);
    if ($attempts >= 30) {
        return new WP_Error(
            'hf_newsletter_rate_limited',
            __('Hubo demasiados intentos. Probá nuevamente en una hora.', 'horizon-fit-commerce'),
            array('status' => 429)
        );
    }
    set_transient($rate_key, $attempts + 1, HOUR_IN_SECONDS);

    $result = hf_commerce_subscribe_newsletter($request->get_param('email'), 'footer');
    if (is_wp_error($result)) {
        return $result;
    }

    $response = rest_ensure_response(array(
        'subscribed'       => true,
        'created'          => (bool) $result['created'],
        'alreadySubscribed' => ! $result['created'],
        'message'          => $result['created']
            ? __('¡Listo! Ya estás suscripta/o a las novedades de Horizon Fit.', 'horizon-fit-commerce')
            : __('Ese email ya estaba suscripto a nuestras novedades.', 'horizon-fit-commerce'),
    ));
    $response->set_status($result['created'] ? 201 : 200);
    return $response;
}

add_action('rest_api_init', function () {
    register_rest_route('hf/v1', '/newsletter/subscribe', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'hf_commerce_newsletter_subscribe_rest',
        'permission_callback' => '__return_true',
        'args'                => array(
            'email' => array('required' => true, 'type' => 'string'),
            'company' => array('required' => false, 'type' => 'string'),
        ),
    ));
});

// La casilla voluntaria del checkout alimenta exactamente la misma lista.
add_action('woocommerce_store_api_checkout_order_processed', function ($order) {
    if (! $order instanceof WC_Order) {
        return;
    }
    $opt_in = $order->get_meta('_wc_other/horizon-fit-commerce/email-marketing', true);
    if (! in_array((string) $opt_in, array('1', 'yes', 'true'), true)) {
        return;
    }
    hf_commerce_subscribe_newsletter($order->get_billing_email(), 'checkout', $order->get_id());
}, 30);

add_filter('manage_' . HF_NEWSLETTER_POST_TYPE . '_posts_columns', function ($columns) {
    return array(
        'cb' => $columns['cb'] ?? '<input type="checkbox" />',
        'title' => __('Email', 'horizon-fit-commerce'),
        'hf_newsletter_source' => __('Origen', 'horizon-fit-commerce'),
        'date' => __('Fecha', 'horizon-fit-commerce'),
    );
});

add_action('manage_' . HF_NEWSLETTER_POST_TYPE . '_posts_custom_column', function ($column, $post_id) {
    if ('hf_newsletter_source' === $column) {
        echo esc_html((string) get_post_meta($post_id, '_hf_newsletter_last_source', true));
    }
}, 10, 2);
