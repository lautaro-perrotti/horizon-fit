<?php
/**
 * Product payment rule fields.
 *
 * Adds Horizon Fit payment rule fields directly inside WooCommerce product data.
 * The storefront calculates payment copy from the real product/variation price.
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
        'id'                => '_hf_installments_count',
        'type'              => 'number',
        'label'             => __('Cantidad de cuotas sin interés', 'horizon-fit-commerce'),
        'placeholder'       => '6',
        'custom_attributes' => [
            'min'  => '0',
            'step' => '1',
        ],
        'desc_tip'    => true,
        'description' => __('Vacío usa el default 6. Poné 0 para no mostrar cuotas en este producto. El monto se calcula con el precio de cada variación.', 'horizon-fit-commerce'),
        'value'       => get_post_meta($post->ID, '_hf_installments_count', true),
    ]);

    woocommerce_wp_text_input([
        'id'                => '_hf_transfer_discount_percent',
        'type'              => 'number',
        'label'             => __('Descuento transferencia (%)', 'horizon-fit-commerce'),
        'placeholder'       => '15',
        'custom_attributes' => [
            'min'  => '0',
            'max'  => '100',
            'step' => '0.01',
        ],
        'desc_tip'    => true,
        'description' => __('Vacío usa el default 15%. Poné 0 para no mostrar transferencia en este producto. Se calcula con el precio de cada variación.', 'horizon-fit-commerce'),
        'value'       => get_post_meta($post->ID, '_hf_transfer_discount_percent', true),
    ]);

    echo '</div>';
}
add_action('woocommerce_product_options_general_product_data', 'hf_product_payment_fields_render', 20);

function hf_product_payment_fields_save($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }

    $installments_raw = isset($_POST['_hf_installments_count'])
        ? trim((string) wp_unslash($_POST['_hf_installments_count']))
        : '';
    $installments_count = $installments_raw !== '' ? (string) absint($installments_raw) : '';

    $transfer_discount_percent = isset($_POST['_hf_transfer_discount_percent'])
        ? wc_format_decimal(wp_unslash($_POST['_hf_transfer_discount_percent']))
        : '';

    $product->update_meta_data('_hf_installments_count', $installments_count);
    $product->update_meta_data('_hf_transfer_discount_percent', $transfer_discount_percent !== '' ? (string) $transfer_discount_percent : '');
}
add_action('woocommerce_admin_process_product_object', 'hf_product_payment_fields_save', 20);
