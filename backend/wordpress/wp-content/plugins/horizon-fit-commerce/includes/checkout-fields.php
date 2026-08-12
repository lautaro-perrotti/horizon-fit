<?php

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Registra el documento argentino como dato de dirección para que WooCommerce
 * lo valide, lo conserve en el pedido y lo exponga en Store API.
 */
add_action('woocommerce_init', function () {
    if (! function_exists('woocommerce_register_additional_checkout_field')) {
        return;
    }

    woocommerce_register_additional_checkout_field(array(
        'id'       => 'horizon-fit-commerce/document-type',
        'label'    => __('Tipo de documento', 'horizon-fit-commerce'),
        'location' => 'address',
        'type'     => 'select',
        'required' => true,
        'options'  => array(
            array('value' => 'dni', 'label' => __('DNI', 'horizon-fit-commerce')),
            array('value' => 'cuit', 'label' => __('CUIT', 'horizon-fit-commerce')),
            array('value' => 'cuil', 'label' => __('CUIL', 'horizon-fit-commerce')),
        ),
        'sanitize_callback' => function ($value) {
            $value = strtolower(sanitize_text_field((string) $value));
            return in_array($value, array('dni', 'cuit', 'cuil'), true) ? $value : 'dni';
        },
        'validate_callback' => function ($value) {
            if (! in_array((string) $value, array('dni', 'cuit', 'cuil'), true)) {
                return new WP_Error(
                    'hf_invalid_document_type',
                    __('Seleccioná un tipo de documento válido.', 'horizon-fit-commerce')
                );
            }
            return true;
        },
    ));

    woocommerce_register_additional_checkout_field(array(
        'id'       => 'horizon-fit-commerce/dni',
        'label'    => __('N° de documento', 'horizon-fit-commerce'),
        'location' => 'address',
        'type'     => 'text',
        'required' => true,
        'attributes' => array(
            'pattern'   => '[0-9]{7,11}',
            'maxLength' => 11,
        ),
        'sanitize_callback' => function ($value) {
            return preg_replace('/\D+/', '', (string) $value);
        },
        'validate_callback' => function ($value) {
            if (! preg_match('/^[0-9]{7,11}$/', (string) $value)) {
                return new WP_Error(
                    'hf_invalid_dni',
                    __('Ingresá entre 7 y 11 números, sin puntos ni guiones.', 'horizon-fit-commerce')
                );
            }
            return true;
        },
    ));

    woocommerce_register_additional_checkout_field(array(
        'id'       => 'horizon-fit-commerce/email-marketing',
        'label'    => __('Enviarme novedades y ofertas por correo electrónico', 'horizon-fit-commerce'),
        'location' => 'contact',
        'type'     => 'checkbox',
        'required' => false,
    ));
});
