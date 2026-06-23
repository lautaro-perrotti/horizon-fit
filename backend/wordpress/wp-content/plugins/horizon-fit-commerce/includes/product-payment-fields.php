<?php
/**
 * Product payment copy fields.
 *
 * Adds Horizon Fit payment text fields directly inside WooCommerce product data
 * so admins do not need to use WordPress "Custom Fields" manually.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_product_payment_fields_render() {
    global $post;

    if (!$post || $post->post_type !== 'product') {
        return;
    }

    echo '<div class="options_group show_if_simple show_if_variable">';

    woocommerce_wp_text_input([
        'id'          => '_hf_installments_text',
        'label'       => __('Texto de cuotas', 'horizon-fit-commerce'),
        'placeholder' => '$7.498 en 6 cuotas sin interés',
        'desc_tip'    => true,
        'description' => __('Se muestra en la card y en la página de producto. Cargar en el producto padre.', 'horizon-fit-commerce'),
        'value'       => get_post_meta($post->ID, '_hf_installments_text', true),
    ]);

    woocommerce_wp_text_input([
        'id'          => '_hf_transfer_text',
        'label'       => __('Texto transferencia', 'horizon-fit-commerce'),
        'placeholder' => '$38.242 con Transferencia',
        'desc_tip'    => true,
        'description' => __('Se muestra debajo del precio. Las variaciones lo heredan del producto padre.', 'horizon-fit-commerce'),
        'value'       => get_post_meta($post->ID, '_hf_transfer_text', true),
    ]);

    echo '</div>';
}
add_action('woocommerce_product_options_general_product_data', 'hf_product_payment_fields_render', 20);

function hf_product_payment_fields_save($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    $fields = [
        '_hf_installments_text',
        '_hf_transfer_text',
    ];

    foreach ($fields as $field) {
        $value = isset($_POST[$field]) ? sanitize_text_field(wp_unslash($_POST[$field])) : '';
        $product->update_meta_data($field, $value);
    }
}
add_action('woocommerce_admin_process_product_object', 'hf_product_payment_fields_save', 20);
