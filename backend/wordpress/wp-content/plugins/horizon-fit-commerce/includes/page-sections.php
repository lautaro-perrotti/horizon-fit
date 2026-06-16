<?php
/**
 * Page Sections - Custom Post Types
 * Registra hf_page y hf_page_section
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_register_page_cpt() {
    register_post_type('hf_page', [
        'label' => 'Páginas',
        'public' => false,
        'show_ui' => true,
        // Oculto del menú lateral: es estructura interna (la home). Todo se
        // administra desde el panel "Horizon Fit".
        'show_in_menu' => false,
        'show_in_rest' => true,
        'rest_base' => 'pages',
        'supports' => ['title', 'editor'],
        'menu_icon' => 'dashicons-layout',
        'menu_position' => 5
    ]);
}

function hf_register_section_cpt() {
    register_post_type('hf_page_section', [
        'label' => 'Secciones de Página',
        'public' => false,
        'show_ui' => true,
        // Oculto del menú lateral: las secciones se editan desde el panel.
        'show_in_menu' => false,
        'show_in_rest' => true,
        'rest_base' => 'page-sections',
        'supports' => ['title'],
        'menu_icon' => 'dashicons-list-view'
    ]);
}

add_action('init', 'hf_register_page_cpt');
add_action('init', 'hf_register_section_cpt');

// Registrar meta fields
function hf_register_section_meta() {
    register_post_meta('hf_page_section', '_hf_page_id', [
        'type' => 'integer',
        'show_in_rest' => true,
        'single' => true
    ]);

    register_post_meta('hf_page_section', '_hf_section_type', [
        'type' => 'string',
        'show_in_rest' => true,
        'single' => true
    ]);

    register_post_meta('hf_page_section', '_hf_section_order', [
        'type' => 'integer',
        'show_in_rest' => true,
        'single' => true
    ]);

    register_post_meta('hf_page_section', '_hf_section_visible', [
        'type' => 'integer',
        'show_in_rest' => true,
        'single' => true
    ]);

    register_post_meta('hf_page_section', '_hf_section_settings', [
        'type' => 'string',
        'show_in_rest' => true,
        'single' => true
    ]);
}

add_action('init', 'hf_register_section_meta');

// Meta box para editar secciones
function hf_add_section_meta_box() {
    add_meta_box(
        'hf_section_settings',
        'Configuración de Sección',
        'hf_section_meta_box_callback',
        'hf_page_section',
        'normal',
        'high'
    );
}

function hf_section_meta_box_callback($post) {
    $page_id = get_post_meta($post->ID, '_hf_page_id', true);
    $section_type = get_post_meta($post->ID, '_hf_section_type', true);
    $section_order = get_post_meta($post->ID, '_hf_section_order', true);
    $section_visible = get_post_meta($post->ID, '_hf_section_visible', true);
    $section_settings = get_post_meta($post->ID, '_hf_section_settings', true);

    $pages = get_posts([
        'post_type' => 'hf_page',
        'numberposts' => -1
    ]);

    $types = ['header', 'marquee', 'hero', 'conjuntos', 'categorias', 'trust', 'estilo', 'instagram', 'footer'];

    wp_nonce_field('hf_section_nonce', 'hf_section_nonce');
    echo '<div style="padding: 10px;">';
    echo '<p><label><strong>Página:</strong></label><br>';
    echo '<select name="hf_page_id" style="width: 100%;"><option value="">-- Seleccionar --</option>';
    foreach ($pages as $page) {
        $sel = ($page->ID == $page_id) ? 'selected' : '';
        echo '<option value="' . esc_attr($page->ID) . '" ' . $sel . '>' . esc_html($page->post_title) . '</option>';
    }
    echo '</select></p>';

    echo '<p><label><strong>Tipo de Sección:</strong></label><br>';
    echo '<select name="hf_section_type" style="width: 100%;"><option value="">-- Seleccionar --</option>';
    foreach ($types as $type) {
        $sel = ($type == $section_type) ? 'selected' : '';
        echo '<option value="' . esc_attr($type) . '" ' . $sel . '>' . esc_html(ucfirst($type)) . '</option>';
    }
    echo '</select></p>';

    echo '<p><label><strong>Orden:</strong></label><br>';
    echo '<input type="number" name="hf_section_order" value="' . esc_attr($section_order) . '" style="width: 100%;"></p>';

    echo '<p><label><input type="checkbox" name="hf_section_visible" value="1" ' . ($section_visible ? 'checked' : '') . '> <strong>Visible</strong></label></p>';

    echo '<p><label><strong>Configuración (JSON):</strong></label><br>';
    echo '<textarea name="hf_section_settings" style="width: 100%; height: 150px;">' . esc_textarea($section_settings) . '</textarea></p>';
    echo '</div>';
}

add_action('add_meta_boxes', 'hf_add_section_meta_box');

// Guardar meta data
function hf_save_section_meta($post_id) {
    if (!isset($_POST['hf_section_nonce']) || !wp_verify_nonce($_POST['hf_section_nonce'], 'hf_section_nonce')) {
        return;
    }

    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    if (isset($_POST['hf_page_id'])) {
        update_post_meta($post_id, '_hf_page_id', intval($_POST['hf_page_id']));
    }

    if (isset($_POST['hf_section_type'])) {
        update_post_meta($post_id, '_hf_section_type', sanitize_text_field(wp_unslash($_POST['hf_section_type'])));
    }

    if (isset($_POST['hf_section_order'])) {
        update_post_meta($post_id, '_hf_section_order', intval($_POST['hf_section_order']));
    }

    if (isset($_POST['hf_section_visible'])) {
        update_post_meta($post_id, '_hf_section_visible', intval($_POST['hf_section_visible']));
    } else {
        update_post_meta($post_id, '_hf_section_visible', 0);
    }

    if (isset($_POST['hf_section_settings'])) {
        // El valor es JSON: NO usar sanitize_textarea_field (rompe comillas/llaves).
        // 1) wp_unslash quita el escapado que WP agrega a $_POST.
        // 2) Validar que sea JSON parseable; si lo es, re-encodear canónico.
        //    Si está vacío, guardar {}. Si es inválido, NO pisar el valor previo.
        $raw = wp_unslash($_POST['hf_section_settings']);
        $raw = is_string($raw) ? trim($raw) : '';

        if ($raw === '') {
            update_post_meta($post_id, '_hf_section_settings', '{}');
        } else {
            $decoded = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $clean = wp_json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                update_post_meta($post_id, '_hf_section_settings', $clean);
            }
            // JSON inválido: se deja el valor anterior intacto (no se corrompe).
        }
    }
}

add_action('save_post_hf_page_section', 'hf_save_section_meta');
