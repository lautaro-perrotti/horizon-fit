<?php
/**
 * Page Sections
 * Registra CPTs para páginas y sus secciones
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register hf_page CPT
 * Representa cada página principal (Home, Colecciones, Producto, Carrito)
 */
function hf_register_page_cpt() {
    register_post_type('hf_page', [
        'labels' => [
            'name' => 'Páginas',
            'singular_name' => 'Página',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'show_in_rest' => true,
        'rest_base' => 'pages',
        'supports' => ['title', 'editor', 'custom-fields'],
        'hierarchical' => false,
        'menu_icon' => 'dashicons-layout',
    ]);

    // Registrar meta fields para hf_page
    register_rest_field('hf_page', 'page_slug', [
        'get_callback' => function($post) {
            return get_post_meta($post['id'], '_hf_page_slug', true);
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_page_slug', sanitize_text_field($value));
        },
        'schema' => [
            'type' => 'string',
            'description' => 'Slug único de la página (home, collections, product, checkout)'
        ]
    ]);

    register_rest_field('hf_page', 'page_title', [
        'get_callback' => function($post) {
            return get_post_meta($post['id'], '_hf_page_title', true);
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_page_title', sanitize_text_field($value));
        },
        'schema' => [
            'type' => 'string',
            'description' => 'Título de la página'
        ]
    ]);
}
add_action('init', 'hf_register_page_cpt');

/**
 * Register hf_page_section CPT
 * Representa cada sección dentro de una página
 */
function hf_register_page_section_cpt() {
    register_post_type('hf_page_section', [
        'labels' => [
            'name' => 'Secciones de Página',
            'singular_name' => 'Sección',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => 'edit.php?post_type=hf_page',
        'show_in_rest' => true,
        'rest_base' => 'page-sections',
        'supports' => ['title', 'custom-fields'],
        'hierarchical' => false,
        'menu_icon' => 'dashicons-columns',
    ]);

    // Meta fields para hf_page_section
    register_rest_field('hf_page_section', 'page_id', [
        'get_callback' => function($post) {
            return (int) get_post_meta($post['id'], '_hf_page_id', true);
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_page_id', (int) $value);
        },
        'schema' => ['type' => 'integer', 'description' => 'ID de la página a la que pertenece']
    ]);

    register_rest_field('hf_page_section', 'section_type', [
        'get_callback' => function($post) {
            return get_post_meta($post['id'], '_hf_section_type', true);
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_section_type', sanitize_text_field($value));
        },
        'schema' => [
            'type' => 'string',
            'description' => 'Tipo de sección (marquee, hero, productos, testimonios, etc)',
            'enum' => ['marquee', 'hero', 'productos', 'testimonios', 'info_banner']
        ]
    ]);

    register_rest_field('hf_page_section', 'section_order', [
        'get_callback' => function($post) {
            return (int) get_post_meta($post['id'], '_hf_section_order', true);
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_section_order', (int) $value);
        },
        'schema' => ['type' => 'integer', 'description' => 'Orden de aparición (1, 2, 3...)']
    ]);

    register_rest_field('hf_page_section', 'is_visible', [
        'get_callback' => function($post) {
            $val = get_post_meta($post['id'], '_hf_section_visible', true);
            return $val === '' ? true : (bool) $val;
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_section_visible', (bool) $value);
        },
        'schema' => ['type' => 'boolean', 'description' => 'Si la sección es visible']
    ]);

    register_rest_field('hf_page_section', 'section_settings', [
        'get_callback' => function($post) {
            $settings = get_post_meta($post['id'], '_hf_section_settings', true);
            return $settings ? json_decode($settings, true) : [];
        },
        'update_callback' => function($value, $post) {
            return update_post_meta($post->ID, '_hf_section_settings', wp_json_encode($value));
        },
        'schema' => [
            'type' => 'object',
            'description' => 'Configuración específica de la sección (JSON)'
        ]
    ]);
}
add_action('init', 'hf_register_page_section_cpt');

/**
 * Register meta boxes para facilitar edición
 */
function hf_register_page_section_metabox() {
    add_meta_box(
        'hf_section_settings',
        'Configuración de Sección',
        'hf_section_settings_callback',
        'hf_page_section',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'hf_register_page_section_metabox');

function hf_section_settings_callback($post) {
    $page_id = get_post_meta($post->ID, '_hf_page_id', true);
    $section_type = get_post_meta($post->ID, '_hf_section_type', true);
    $section_order = get_post_meta($post->ID, '_hf_section_order', true);
    $is_visible = get_post_meta($post->ID, '_hf_section_visible', true);

    wp_nonce_field('hf_section_nonce', 'hf_section_nonce');
    ?>
    <table class="form-table">
        <tr>
            <th><label for="hf_page_id">Página</label></th>
            <td>
                <select name="hf_page_id" id="hf_page_id">
                    <option value="">-- Seleccionar --</option>
                    <?php
                    $pages = get_posts([
                        'post_type' => 'hf_page',
                        'numberposts' => -1
                    ]);
                    foreach ($pages as $page) {
                        $selected = $page->ID == $page_id ? 'selected' : '';
                        echo "<option value='{$page->ID}' {$selected}>{$page->post_title}</option>";
                    }
                    ?>
                </select>
            </td>
        </tr>
        <tr>
            <th><label for="hf_section_type">Tipo de Sección</label></th>
            <td>
                <select name="hf_section_type" id="hf_section_type">
                    <option value="marquee" <?php selected($section_type, 'marquee'); ?>>Marquee</option>
                    <option value="hero" <?php selected($section_type, 'hero'); ?>>Hero Video</option>
                    <option value="productos" <?php selected($section_type, 'productos'); ?>>Productos</option>
                    <option value="testimonios" <?php selected($section_type, 'testimonios'); ?>>Testimonios</option>
                    <option value="info_banner" <?php selected($section_type, 'info_banner'); ?>>Info Banner</option>
                </select>
            </td>
        </tr>
        <tr>
            <th><label for="hf_section_order">Orden</label></th>
            <td>
                <input type="number" name="hf_section_order" id="hf_section_order" value="<?php echo esc_attr($section_order); ?>" min="1" step="1" />
            </td>
        </tr>
        <tr>
            <th><label for="hf_section_visible">Visible</label></th>
            <td>
                <input type="checkbox" name="hf_section_visible" id="hf_section_visible" value="1" <?php checked($is_visible, 1); ?> />
            </td>
        </tr>
    </table>
    <?php
}

/**
 * Save meta box data
 */
function hf_save_page_section_meta($post_id) {
    if (!isset($_POST['hf_section_nonce']) || !wp_verify_nonce($_POST['hf_section_nonce'], 'hf_section_nonce')) {
        return;
    }

    if (isset($_POST['hf_page_id'])) {
        update_post_meta($post_id, '_hf_page_id', (int) $_POST['hf_page_id']);
    }

    if (isset($_POST['hf_section_type'])) {
        update_post_meta($post_id, '_hf_section_type', sanitize_text_field($_POST['hf_section_type']));
    }

    if (isset($_POST['hf_section_order'])) {
        update_post_meta($post_id, '_hf_section_order', (int) $_POST['hf_section_order']);
    }

    if (isset($_POST['hf_section_visible'])) {
        update_post_meta($post_id, '_hf_section_visible', 1);
    } else {
        update_post_meta($post_id, '_hf_section_visible', 0);
    }
}
add_action('save_post_hf_page_section', 'hf_save_page_section_meta');
