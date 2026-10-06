<?php
/**
 * Editor de tabla de talles por producto.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_product_size_table_default() {
    return [
        'title'   => 'Tabla de talles',
        'headers' => ['Talle', 'Busto', 'Cintura', 'Cadera'],
        'rows'    => [
            ['S', '84-90', '64-70', '90-96'],
            ['M', '90-96', '70-76', '96-102'],
            ['L', '96-104', '76-84', '102-110'],
        ],
    ];
}

function hf_product_size_table_get($product_id) {
    $raw = (string) get_post_meta($product_id, '_hf_size_table_json', true);
    $table = $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($table) || empty($table['headers']) || !is_array($table['headers'])) {
        return hf_product_size_table_default();
    }

    return [
        'title'   => !empty($table['title']) ? (string) $table['title'] : 'Tabla de talles',
        'headers' => array_values($table['headers']),
        'rows'    => !empty($table['rows']) && is_array($table['rows']) ? array_values($table['rows']) : [],
    ];
}

function hf_product_size_table_tab($tabs) {
    $tabs['hf_size_table'] = [
        'label'    => __('Tabla de talles', 'horizon-fit-commerce'),
        'target'   => 'hf_size_table_product_data',
        'class'    => ['show_if_simple', 'show_if_variable'],
        'priority' => 75,
    ];
    return $tabs;
}
add_filter('woocommerce_product_data_tabs', 'hf_product_size_table_tab', 30);

function hf_product_size_table_panel() {
    global $post;

    if (!$post || $post->post_type !== 'product') {
        return;
    }

    $table = hf_product_size_table_get($post->ID);
    ?>
    <div id="hf_size_table_product_data" class="panel woocommerce_options_panel hidden">
        <?php wp_nonce_field('hf_product_size_table_save', 'hf_product_size_table_nonce'); ?>
        <div class="options_group hf-size-table-editor" data-hf-size-table-editor>
            <p class="form-field">
                <label for="hf_size_table_title"><?php esc_html_e('Título', 'horizon-fit-commerce'); ?></label>
                <input id="hf_size_table_title" type="text" value="<?php echo esc_attr($table['title']); ?>" data-hf-size-table-title>
                <span class="description"><?php esc_html_e('Esta tabla pertenece solamente a este producto.', 'horizon-fit-commerce'); ?></span>
            </p>

            <div class="hf-size-table-editor__scroll">
                <table class="widefat striped hf-size-table-editor__table" data-hf-size-table-grid>
                    <thead>
                        <tr>
                            <?php foreach ($table['headers'] as $header) : ?>
                                <th>
                                    <input type="text" value="<?php echo esc_attr($header); ?>" aria-label="<?php esc_attr_e('Nombre de columna', 'horizon-fit-commerce'); ?>" data-hf-size-header>
                                    <button type="button" class="button-link-delete" aria-label="<?php esc_attr_e('Eliminar columna', 'horizon-fit-commerce'); ?>" data-hf-remove-column>&times;</button>
                                </th>
                            <?php endforeach; ?>
                            <th class="hf-size-table-editor__actions"><?php esc_html_e('Acciones', 'horizon-fit-commerce'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($table['rows'] as $row) : ?>
                            <tr>
                                <?php foreach ($table['headers'] as $column_index => $header) : ?>
                                    <td><input type="text" value="<?php echo esc_attr(is_array($row) ? ($row[$column_index] ?? '') : ''); ?>" data-hf-size-cell></td>
                                <?php endforeach; ?>
                                <td class="hf-size-table-editor__actions"><button type="button" class="button-link-delete" data-hf-remove-row><?php esc_html_e('Eliminar', 'horizon-fit-commerce'); ?></button></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <p class="hf-size-table-editor__buttons">
                <button type="button" class="button" data-hf-add-column><?php esc_html_e('Agregar columna', 'horizon-fit-commerce'); ?></button>
                <button type="button" class="button" data-hf-add-row><?php esc_html_e('Agregar talle/fila', 'horizon-fit-commerce'); ?></button>
                <button type="button" class="button" data-hf-reset-table><?php esc_html_e('Restaurar tabla inicial', 'horizon-fit-commerce'); ?></button>
            </p>
            <p class="description"><?php esc_html_e('Podés cambiar todos los encabezados y números. La cantidad de valores de cada fila se ajusta automáticamente a las columnas.', 'horizon-fit-commerce'); ?></p>
            <input type="hidden" name="_hf_size_table_json" value="<?php echo esc_attr(wp_json_encode($table, JSON_UNESCAPED_UNICODE)); ?>" data-hf-size-table-json>
        </div>
    </div>
    <?php
}
add_action('woocommerce_product_data_panels', 'hf_product_size_table_panel');

function hf_product_size_table_sanitize($value) {
    if (!is_array($value)) {
        return [];
    }

    $headers = [];
    $header_indexes = [];
    foreach (array_slice((array) ($value['headers'] ?? []), 0, 8, true) as $index => $header) {
        $header = sanitize_text_field((string) $header);
        if ($header !== '') {
            $headers[] = $header;
            $header_indexes[] = $index;
        }
    }
    if (!$headers) {
        return [];
    }

    $rows = [];
    foreach (array_slice((array) ($value['rows'] ?? []), 0, 30) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $clean_row = [];
        foreach ($header_indexes as $index) {
            $clean_row[] = sanitize_text_field((string) ($row[$index] ?? ''));
        }
        if (array_filter($clean_row, static function ($cell) { return $cell !== ''; })) {
            $rows[] = $clean_row;
        }
    }

    return [
        'title'   => sanitize_text_field((string) ($value['title'] ?? '')) ?: 'Tabla de talles',
        'headers' => $headers,
        'rows'    => $rows,
    ];
}

function hf_product_size_table_save($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return;
    }
    if (!isset($_POST['hf_product_size_table_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['hf_product_size_table_nonce'])), 'hf_product_size_table_save')) {
        return;
    }

    $raw = isset($_POST['_hf_size_table_json']) ? wp_unslash($_POST['_hf_size_table_json']) : '';
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    $table = hf_product_size_table_sanitize($decoded);

    if ($table) {
        $product->update_meta_data('_hf_size_table_json', wp_json_encode($table, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    } else {
        $product->delete_meta_data('_hf_size_table_json');
    }
}
add_action('woocommerce_admin_process_product_object', 'hf_product_size_table_save', 25);

function hf_product_size_table_admin_assets() {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if (!$screen || $screen->id !== 'product') {
        return;
    }

    wp_enqueue_style(
        'hf-product-size-table-admin',
        HF_COMMERCE_URL . 'assets/product-size-table-admin.css',
        [],
        '1.0.0'
    );
    wp_enqueue_script(
        'hf-product-size-table-admin',
        HF_COMMERCE_URL . 'assets/product-size-table-admin.js',
        [],
        '1.0.0',
        true
    );
}
add_action('admin_enqueue_scripts', 'hf_product_size_table_admin_assets');
