<?php
/**
 * Search snippet auditor rules (PDP titles and meta descriptions).
 *
 * severity: error | warning | info
 * blocks_merchant: always false. Search issues never gate the Merchant feed.
 */

return array(
    'duplicate_meta_description' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Meta description duplicada entre PDPs',
    ),
    'weak_meta_description' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Meta description débil o sin copy útil de Woo',
    ),
    'meta_description_too_short' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Meta description demasiado corta',
    ),
    'meta_description_too_long' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Meta description supera 158 caracteres',
    ),
    'duplicate_seo_title' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Title SEO duplicado entre PDPs',
    ),
    'seo_title_too_long' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Title SEO supera 65 caracteres',
    ),
    'seo_title_placeholder' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Title SEO parece placeholder o dato de prueba',
    ),
);
