<?php
/**
 * Importación controlada de stock y tablas de talles recibidas el 23/10/2026.
 *
 * El comando es simulación por defecto. Solo escribe con --apply.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_catalog_operational_data_path() {
    return HF_COMMERCE_DIR . 'data/catalog-operational-data-2026-10-23.json';
}

function hf_catalog_operational_load_data() {
    $path = hf_catalog_operational_data_path();
    if (!is_readable($path)) {
        return new WP_Error('hf_catalog_data_missing', 'No se encontró el archivo de datos operativos.');
    }

    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded) || !isset($decoded['stock'], $decoded['size_tables']) || !is_array($decoded['stock']) || !is_array($decoded['size_tables'])) {
        return new WP_Error('hf_catalog_data_invalid', 'El archivo de datos operativos no tiene el formato esperado.');
    }

    return $decoded;
}

function hf_catalog_operational_size_key_from_sku($sku) {
    $parts = array_values(array_filter(explode('-', strtoupper(trim((string) $sku))), 'strlen'));
    if (count($parts) < 4 || !preg_match('/^\d{3}$/', $parts[0])) {
        return '';
    }

    return $parts[0] . '-' . $parts[1];
}

function hf_catalog_operational_prepare_table($table) {
    if (!is_array($table)) {
        return array();
    }

    return hf_product_size_table_sanitize(array(
        'title'   => 'Tabla de talles',
        'headers' => isset($table['headers']) ? $table['headers'] : array(),
        'rows'    => isset($table['rows']) ? $table['rows'] : array(),
    ));
}

function hf_catalog_operational_import($apply = false) {
    if (!function_exists('wc_get_product_id_by_sku') || !function_exists('wc_get_product')) {
        return new WP_Error('hf_catalog_woocommerce_missing', 'WooCommerce no está disponible.');
    }

    $data = hf_catalog_operational_load_data();
    if (is_wp_error($data)) {
        return $data;
    }

    $summary = array(
        'apply'                => (bool) $apply,
        'source_rows'          => count($data['stock']),
        'matched_skus'         => 0,
        'changed_stock'        => 0,
        'unchanged_stock'      => 0,
        'missing_skus'         => array(),
        'invalid_products'     => array(),
        'size_tables_planned'  => 0,
        'size_tables_changed'  => 0,
        'missing_size_tables'  => array(),
        'parent_ids'           => array(),
    );

    $parents_by_table = array();

    foreach ($data['stock'] as $row) {
        $sku = isset($row['sku']) ? strtoupper(trim((string) $row['sku'])) : '';
        $quantity = isset($row['quantity']) ? filter_var($row['quantity'], FILTER_VALIDATE_INT) : false;
        if ($sku === '' || $quantity === false || $quantity < 0) {
            $summary['invalid_products'][] = $sku ?: '(sin SKU)';
            continue;
        }

        $product_id = (int) wc_get_product_id_by_sku($sku);
        if (!$product_id) {
            $summary['missing_skus'][] = $sku;
            continue;
        }

        $product = wc_get_product($product_id);
        if (!$product || !$product->is_type('variation')) {
            $summary['invalid_products'][] = $sku;
            continue;
        }

        $summary['matched_skus']++;
        $parent_id = (int) $product->get_parent_id();
        $table_key = hf_catalog_operational_size_key_from_sku($sku);
        if ($parent_id && $table_key) {
            $parents_by_table[$table_key][$parent_id] = true;
        }

        $current_quantity = $product->get_stock_quantity();
        $stock_changed = !$product->get_manage_stock() || (int) $current_quantity !== $quantity || $product->get_stock_status() !== ($quantity > 0 ? 'instock' : 'outofstock');
        if (!$stock_changed) {
            $summary['unchanged_stock']++;
            continue;
        }

        $summary['changed_stock']++;
        if ($apply) {
            $product->set_manage_stock(true);
            $product->set_stock_quantity($quantity);
            $product->set_stock_status($quantity > 0 ? 'instock' : 'outofstock');
            $product->save();
        }
    }

    foreach ($parents_by_table as $table_key => $parent_ids) {
        if (!isset($data['size_tables'][$table_key])) {
            $summary['missing_size_tables'][] = $table_key;
            continue;
        }

        $table = hf_catalog_operational_prepare_table($data['size_tables'][$table_key]);
        if (!$table) {
            $summary['missing_size_tables'][] = $table_key;
            continue;
        }

        $encoded = wp_json_encode($table, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        foreach (array_keys($parent_ids) as $parent_id) {
            $parent_id = (int) $parent_id;
            $summary['size_tables_planned']++;
            $summary['parent_ids'][$parent_id] = true;
            if ((string) get_post_meta($parent_id, '_hf_size_table_json', true) === $encoded) {
                continue;
            }

            $summary['size_tables_changed']++;
            if ($apply) {
                update_post_meta($parent_id, '_hf_size_table_json', $encoded);
            }
        }
    }

    $summary['parent_ids'] = array_map('intval', array_keys($summary['parent_ids']));
    sort($summary['parent_ids']);
    sort($summary['missing_skus']);
    sort($summary['invalid_products']);
    $summary['missing_size_tables'] = array_values(array_unique($summary['missing_size_tables']));
    sort($summary['missing_size_tables']);

    if ($apply) {
        foreach ($summary['parent_ids'] as $parent_id) {
            if (class_exists('WC_Product_Variable')) {
                WC_Product_Variable::sync($parent_id);
            }
            wc_delete_product_transients($parent_id);
        }

        if (function_exists('hf_regenerate_featured_products_cache')) {
            hf_regenerate_featured_products_cache();
        }
        if (function_exists('hf_regenerate_storefront_seo_cache')) {
            hf_regenerate_storefront_seo_cache();
        }
        if (function_exists('hf_search_regenerate_commerce_artifacts')) {
            hf_search_regenerate_commerce_artifacts();
        }
    }

    return $summary;
}

if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
    WP_CLI::add_command('horizon-fit catalog import-operational-data', static function ($args, $assoc_args) {
        $apply = isset($assoc_args['apply']) && (string) $assoc_args['apply'] !== 'false';
        $summary = hf_catalog_operational_import($apply);
        if (is_wp_error($summary)) {
            WP_CLI::error($summary->get_error_message());
        }

        WP_CLI::line('Modo: ' . ($apply ? 'APLICACIÓN' : 'SIMULACIÓN'));
        WP_CLI::line(sprintf(
            'Stock: %d filas, %d SKU encontrados, %d cambios, %d sin cambios, %d SKU inexistentes.',
            $summary['source_rows'],
            $summary['matched_skus'],
            $summary['changed_stock'],
            $summary['unchanged_stock'],
            count($summary['missing_skus'])
        ));
        WP_CLI::line(sprintf(
            'Tablas: %d productos detectados, %d cambios, %d tipos sin definición.',
            $summary['size_tables_planned'],
            $summary['size_tables_changed'],
            count($summary['missing_size_tables'])
        ));

        if ($summary['missing_skus']) {
            WP_CLI::warning('SKU que no existen en WooCommerce: ' . implode(', ', $summary['missing_skus']));
        }
        if ($summary['invalid_products']) {
            WP_CLI::warning('Filas inválidas o productos que no son variaciones: ' . implode(', ', $summary['invalid_products']));
        }
        if ($summary['missing_size_tables']) {
            WP_CLI::warning('Tipos sin tabla: ' . implode(', ', $summary['missing_size_tables']));
        }

        if (!$apply) {
            WP_CLI::success('Simulación terminada. Volvé a ejecutar con --apply para guardar.');
            return;
        }

        WP_CLI::success('Stock, tablas de talles y cachés actualizados.');
    });
}
