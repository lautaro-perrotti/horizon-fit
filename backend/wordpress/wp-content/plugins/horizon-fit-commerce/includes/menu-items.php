<?php
/**
 * Items de Menú - CPT + cache del menú de la navbar
 * El menú de la navbar se arma dinámicamente desde wp-admin: items genéricos
 * (este CPT) + categorías marcadas "Mostrar en menú". Todo en una lista
 * unificada ordenada, servida como /uploads/horizon-fit-cache/menu.json.
 */

if (!defined('ABSPATH')) {
    exit;
}

// ---- CPT hf_menu_item ----
function hf_register_menu_item_cpt() {
    register_post_type('hf_menu_item', [
        'label'        => 'Items de menú',
        'public'       => false,
        'show_ui'      => true,
        // Oculto del menú lateral: se administra desde el panel "Horizon Fit".
        'show_in_menu' => false,
        'supports'     => ['title'],
        'menu_icon'    => 'dashicons-menu',
        'labels'       => [
            'name'          => 'Items de menú',
            'singular_name' => 'Item de menú',
            'add_new_item'  => 'Agregar item de menú',
            'edit_item'     => 'Editar item de menú',
            'all_items'     => 'Items de menú',
        ],
    ]);
}
add_action('init', 'hf_register_menu_item_cpt');

// ---- Meta-box ----
function hf_add_menu_item_meta_box() {
    add_meta_box(
        'hf_menu_item_settings',
        'Configuración del item de menú',
        'hf_menu_item_meta_box_callback',
        'hf_menu_item',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'hf_add_menu_item_meta_box');

function hf_menu_item_meta_box_callback($post) {
    $link    = (string) get_post_meta($post->ID, '_hf_menu_link', true);
    $order   = (string) get_post_meta($post->ID, '_hf_menu_order', true);
    $visible = get_post_meta($post->ID, '_hf_menu_visible', true);
    // Por defecto visible en items nuevos.
    $visible = ($visible === '' ) ? '1' : $visible;

    wp_nonce_field('hf_menu_item_nonce', 'hf_menu_item_nonce');
    echo '<div style="padding: 10px;">';
    echo '<p><strong>El título del item (arriba) es el texto que se ve en el menú.</strong></p>';

    echo '<p><label for="hf_menu_link"><strong>Link:</strong></label><br>';
    echo '<input type="text" name="hf_menu_link" id="hf_menu_link" value="' . esc_attr($link) . '" style="width: 100%;" placeholder="https://... o #footerContact"></p>';
    echo '<p class="description">Pegá una URL completa (https://...) o un ancla de sección de la home (ej. #footerContact, #productGrid1).</p>';

    echo '<p><label for="hf_menu_order"><strong>Orden:</strong></label><br>';
    echo '<input type="number" name="hf_menu_order" id="hf_menu_order" value="' . esc_attr($order) . '" style="width: 100%;"></p>';

    echo '<p><label><input type="checkbox" name="hf_menu_visible" value="1" ' . checked($visible, '1', false) . '> <strong>Visible</strong></label></p>';
    echo '</div>';
}

function hf_save_menu_item_meta($post_id) {
    if (!isset($_POST['hf_menu_item_nonce']) || !wp_verify_nonce($_POST['hf_menu_item_nonce'], 'hf_menu_item_nonce')) {
        return;
    }
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    if (isset($_POST['hf_menu_link'])) {
        update_post_meta($post_id, '_hf_menu_link', sanitize_text_field(wp_unslash($_POST['hf_menu_link'])));
    }
    if (isset($_POST['hf_menu_order'])) {
        update_post_meta($post_id, '_hf_menu_order', absint($_POST['hf_menu_order']));
    }
    update_post_meta($post_id, '_hf_menu_visible', isset($_POST['hf_menu_visible']) ? '1' : '0');
}
add_action('save_post_hf_menu_item', 'hf_save_menu_item_meta');

// ---- Cache del menú (menu.json) ----
function hf_regenerate_menu_cache() {
    if (!function_exists('hf_featured_products_cache_path')) {
        return;
    }

    $entries = [];

    // 1) Items genéricos (CPT hf_menu_item) visibles.
    $items = get_posts([
        'post_type'   => 'hf_menu_item',
        'numberposts' => -1,
        'orderby'     => 'meta_value_num',
        'meta_key'    => '_hf_menu_order',
        'order'       => 'ASC',
    ]);
    foreach ($items as $item) {
        if (get_post_meta($item->ID, '_hf_menu_visible', true) === '0') {
            continue;
        }
        $entries[] = [
            'label' => $item->post_title,
            'url'   => (string) get_post_meta($item->ID, '_hf_menu_link', true),
            'order' => (int) get_post_meta($item->ID, '_hf_menu_order', true),
            'type'  => 'item',
        ];
    }

    // 2) Categorías marcadas "Mostrar en menú".
    $terms = get_terms([
        'taxonomy'   => 'product_cat',
        'hide_empty' => false,
        'meta_query' => [[
            'key'   => 'hf_show_in_nav',
            'value' => '1',
        ]],
        'meta_key' => 'hf_nav_order',
        'orderby'  => 'meta_value_num',
        'order'    => 'ASC',
    ]);
    if (!is_wp_error($terms)) {
        foreach ($terms as $term) {
            if (function_exists('hf_featured_products_is_default_product_category') ? hf_featured_products_is_default_product_category($term) : strtolower((string) $term->slug) === 'uncategorized') {
                continue;
            }
            $entries[] = [
                'label' => $term->name,
                'url'   => '/coleccion/' . $term->slug . '/',
                'order' => (int) get_term_meta($term->term_id, 'hf_nav_order', true),
                'type'  => 'category',
            ];
        }
    }

    // 3) Orden unificado (estable) por el número de orden global.
    usort($entries, function ($a, $b) {
        return $a['order'] <=> $b['order'];
    });

    $cache_file = dirname(hf_featured_products_cache_path()) . '/menu.json';
    hf_featured_products_write_cache($cache_file, $entries);
}

// Regenerar cuando cambia un item de menú o una categoría.
add_action('save_post_hf_menu_item', 'hf_regenerate_menu_cache', 30);
add_action('deleted_post', function ($post_id) {
    if (get_post_type($post_id) === 'hf_menu_item') {
        hf_regenerate_menu_cache();
    }
}, 20);
add_action('edited_product_cat', 'hf_regenerate_menu_cache', 30);
add_action('created_product_cat', 'hf_regenerate_menu_cache', 30);
