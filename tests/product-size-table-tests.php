<?php

define('ABSPATH', __DIR__ . '/');

function __($value) { return $value; }
function add_filter() { return true; }
function add_action() { return true; }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }

require_once __DIR__ . '/../backend/wordpress/wp-content/plugins/horizon-fit-commerce/includes/product-size-table-fields.php';

function hf_size_table_assert($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$table = hf_product_size_table_sanitize([
    'title'   => '<b>Medidas de la prenda</b>',
    'headers' => ['Talle', '', 'Cadera'],
    'rows'    => [
        ['S', 'celda eliminada', '90-96'],
        ['', '', ''],
    ],
]);

hf_size_table_assert($table['title'] === 'Medidas de la prenda', 'El título debe sanear HTML.');
hf_size_table_assert($table['headers'] === ['Talle', 'Cadera'], 'Debe quitar encabezados vacíos.');
hf_size_table_assert($table['rows'] === [['S', '90-96']], 'Debe conservar la columna correcta y quitar filas vacías.');

$many_columns = hf_product_size_table_sanitize([
    'headers' => range(1, 12),
    'rows'    => [range(1, 12)],
]);
hf_size_table_assert(count($many_columns['headers']) === 8, 'Debe limitar la tabla a ocho columnas.');
hf_size_table_assert(count($many_columns['rows'][0]) === 8, 'Cada fila debe tener la misma cantidad de celdas que los encabezados.');

hf_size_table_assert(hf_product_size_table_sanitize(['headers' => []]) === [], 'Sin encabezados debe usar el fallback seguro.');

echo "OK product size table: sanitización, columnas y filas\n";
