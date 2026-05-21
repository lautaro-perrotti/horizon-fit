<?php
/**
 * Plugin Name: Horizon Fit Commerce
 * Description: Collections, storefront seeding, offers sync and price automation for Horizon Fit.
 * Version: 1.0.0
 * Author: OpenAI Codex
 * Text Domain: horizon-fit-commerce
 */

if (! defined('ABSPATH')) {
    exit;
}

define('HF_COMMERCE_FILE', __FILE__);
define('HF_COMMERCE_DIR', plugin_dir_path(__FILE__));
define('HF_COMMERCE_URL', plugin_dir_url(__FILE__));

require_once HF_COMMERCE_DIR . 'includes/catalog-data.php';
require_once HF_COMMERCE_DIR . 'includes/marquee-settings.php';

// Habilitar REST API pública para WooCommerce sin autenticación
// Este filter intercepta la validación de permisos de WooCommerce
add_filter('rest_authentication_errors', '__return_true', 0);

// Crear usuario anónimo con capacidades de lectura para REST
add_action('init', function() {
    if (defined('REST_REQUEST') && REST_REQUEST && !is_user_logged_in()) {
        // Creatr un "usuario anónimo" con permisos básicos de lectura
        $anon_user = new WP_User(0);
        $anon_user->add_cap('read');
        $anon_user->add_cap('read_product');
        $anon_user->add_cap('read_order');
    }
});

function hf_commerce_boot() {
    if (! class_exists('WooCommerce')) {
        return;
    }

    add_action('init', 'hf_commerce_register_collection_taxonomy');
    add_action('init', 'hf_commerce_register_offers_category');
    add_action('admin_menu', 'hf_commerce_register_admin_pages');
    add_action('admin_enqueue_scripts', 'hf_commerce_admin_assets');

    add_action('product_cat_add_form_fields', 'hf_commerce_render_category_term_fields');
    add_action('product_cat_edit_form_fields', 'hf_commerce_render_category_term_fields');
    add_action('hf_collection_add_form_fields', 'hf_commerce_render_collection_term_fields');
    add_action('hf_collection_edit_form_fields', 'hf_commerce_render_collection_term_fields');
    add_action('created_product_cat', 'hf_commerce_save_term_meta');
    add_action('edited_product_cat', 'hf_commerce_save_term_meta');
    add_action('created_hf_collection', 'hf_commerce_save_term_meta');
    add_action('edited_hf_collection', 'hf_commerce_save_term_meta');

    add_action('save_post_product', 'hf_commerce_sync_offers_from_product', 20);
    add_action('save_post_product_variation', 'hf_commerce_sync_offers_from_variation', 20);

    add_filter('manage_edit-hf_collection_columns', 'hf_commerce_collection_columns');
    add_filter('manage_hf_collection_custom_column', 'hf_commerce_collection_column_values', 10, 3);
}
add_action('plugins_loaded', 'hf_commerce_boot');

function hf_commerce_activate() {
    hf_commerce_register_collection_taxonomy();
    hf_commerce_register_offers_category();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'hf_commerce_activate');

function hf_commerce_register_collection_taxonomy() {
    register_taxonomy(
        'hf_collection',
        array('product'),
        array(
            'labels'            => array(
                'name'          => __('Colecciones', 'horizon-fit-commerce'),
                'singular_name' => __('Colección', 'horizon-fit-commerce'),
                'menu_name'     => __('Colecciones', 'horizon-fit-commerce'),
                'all_items'     => __('Todas las colecciones', 'horizon-fit-commerce'),
                'edit_item'     => __('Editar colección', 'horizon-fit-commerce'),
                'add_new_item'  => __('Agregar colección', 'horizon-fit-commerce'),
            ),
            'public'            => true,
            'show_ui'           => true,
            'show_admin_column' => true,
            'hierarchical'      => true,
            'rewrite'           => array('slug' => 'conjuntos'),
            'show_in_rest'      => true,
        )
    );
}

function hf_commerce_admin_assets($hook) {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    $taxonomy_screens = array('edit-product_cat', 'term-product_cat', 'edit-hf_collection', 'term-hf_collection');

    if (($screen && in_array($screen->id, $taxonomy_screens, true)) || false !== strpos((string) $hook, 'hf-commerce')) {
        wp_enqueue_media();
        wp_enqueue_style('hf-commerce-admin', HF_COMMERCE_URL . 'assets/admin.css', array(), '1.0.0');
        wp_enqueue_script('hf-commerce-admin', HF_COMMERCE_URL . 'assets/admin.js', array('jquery'), '1.0.0', true);
    }
}

function hf_commerce_register_admin_pages() {
    add_submenu_page(
        'woocommerce',
        __('Horizon Fit | Seeder', 'horizon-fit-commerce'),
        __('Horizon Fit', 'horizon-fit-commerce'),
        'manage_woocommerce',
        'hf-commerce-seed',
        'hf_commerce_render_seed_page'
    );

    add_submenu_page(
        'woocommerce',
        __('Horizon Fit | Precios', 'horizon-fit-commerce'),
        __('Precios', 'horizon-fit-commerce'),
        'manage_woocommerce',
        'hf-commerce-pricing',
        'hf_commerce_render_pricing_page'
    );
}

function hf_commerce_render_category_term_fields($term = null) {
    $term_id      = $term instanceof WP_Term ? $term->term_id : 0;
    $featured     = $term_id ? (string) get_term_meta($term_id, 'hf_featured_home', true) : '0';
    $home_order   = $term_id ? (string) get_term_meta($term_id, 'hf_home_order', true) : '';
    $card_copy    = $term_id ? (string) get_term_meta($term_id, 'hf_card_copy', true) : '';
    $is_edit_form = $term instanceof WP_Term;

    if ($is_edit_form) :
        ?>
        <tr class="form-field">
            <th scope="row"><label for="hf_featured_home"><?php esc_html_e('Mostrar en home', 'horizon-fit-commerce'); ?></label></th>
            <td><label><input type="checkbox" name="hf_featured_home" id="hf_featured_home" value="1" <?php checked($featured, '1'); ?>> <?php esc_html_e('Usar esta categoría en Compra por categoría', 'horizon-fit-commerce'); ?></label></td>
        </tr>
        <tr class="form-field">
            <th scope="row"><label for="hf_home_order"><?php esc_html_e('Orden home', 'horizon-fit-commerce'); ?></label></th>
            <td><input type="number" name="hf_home_order" id="hf_home_order" value="<?php echo esc_attr($home_order); ?>"></td>
        </tr>
        <tr class="form-field">
            <th scope="row"><label for="hf_card_copy"><?php esc_html_e('Copy corto', 'horizon-fit-commerce'); ?></label></th>
            <td><textarea name="hf_card_copy" id="hf_card_copy" rows="3"><?php echo esc_textarea($card_copy); ?></textarea></td>
        </tr>
        <?php
    else :
        ?>
        <div class="form-field">
            <label for="hf_featured_home"><?php esc_html_e('Mostrar en home', 'horizon-fit-commerce'); ?></label>
            <label><input type="checkbox" name="hf_featured_home" id="hf_featured_home" value="1"> <?php esc_html_e('Usar esta categoría en Compra por categoría', 'horizon-fit-commerce'); ?></label>
        </div>
        <div class="form-field">
            <label for="hf_home_order"><?php esc_html_e('Orden home', 'horizon-fit-commerce'); ?></label>
            <input type="number" name="hf_home_order" id="hf_home_order" value="">
        </div>
        <div class="form-field">
            <label for="hf_card_copy"><?php esc_html_e('Copy corto', 'horizon-fit-commerce'); ?></label>
            <textarea name="hf_card_copy" id="hf_card_copy" rows="3"></textarea>
        </div>
        <?php
    endif;
}

function hf_commerce_render_collection_term_fields($term = null) {
    $term_id      = $term instanceof WP_Term ? $term->term_id : 0;
    $featured     = $term_id ? (string) get_term_meta($term_id, 'hf_featured_home', true) : '0';
    $home_order   = $term_id ? (string) get_term_meta($term_id, 'hf_home_order', true) : '';
    $card_copy    = $term_id ? (string) get_term_meta($term_id, 'hf_card_copy', true) : '';
    $image_id     = $term_id ? (int) get_term_meta($term_id, 'hf_image_id', true) : 0;
    $image_url    = $image_id ? wp_get_attachment_image_url($image_id, 'medium') : '';
    $is_edit_form = $term instanceof WP_Term;

    if ($is_edit_form) :
        ?>
        <tr class="form-field">
            <th scope="row"><label for="hf_featured_home"><?php esc_html_e('Mostrar en home', 'horizon-fit-commerce'); ?></label></th>
            <td><label><input type="checkbox" name="hf_featured_home" id="hf_featured_home" value="1" <?php checked($featured, '1'); ?>> <?php esc_html_e('Usar esta colección en Conjuntos destacados', 'horizon-fit-commerce'); ?></label></td>
        </tr>
        <tr class="form-field">
            <th scope="row"><label for="hf_home_order"><?php esc_html_e('Orden home', 'horizon-fit-commerce'); ?></label></th>
            <td><input type="number" name="hf_home_order" id="hf_home_order" value="<?php echo esc_attr($home_order); ?>"></td>
        </tr>
        <tr class="form-field">
            <th scope="row"><label for="hf_card_copy"><?php esc_html_e('Copy corto', 'horizon-fit-commerce'); ?></label></th>
            <td><textarea name="hf_card_copy" id="hf_card_copy" rows="3"><?php echo esc_textarea($card_copy); ?></textarea></td>
        </tr>
        <tr class="form-field">
            <th scope="row"><label for="hf_image_id"><?php esc_html_e('Imagen de colección', 'horizon-fit-commerce'); ?></label></th>
            <td>
                <input type="hidden" name="hf_image_id" id="hf_image_id" value="<?php echo esc_attr($image_id); ?>">
                <div class="hf-term-image-preview"><?php if ($image_url) : ?><img src="<?php echo esc_url($image_url); ?>" alt=""><?php endif; ?></div>
                <button class="button" type="button" data-hf-media-open data-hf-target="#hf_image_id" data-hf-preview=".hf-term-image-preview"><?php esc_html_e('Elegir imagen', 'horizon-fit-commerce'); ?></button>
            </td>
        </tr>
        <?php
    else :
        ?>
        <div class="form-field">
            <label for="hf_featured_home"><?php esc_html_e('Mostrar en home', 'horizon-fit-commerce'); ?></label>
            <label><input type="checkbox" name="hf_featured_home" id="hf_featured_home" value="1"> <?php esc_html_e('Usar esta colección en Conjuntos destacados', 'horizon-fit-commerce'); ?></label>
        </div>
        <div class="form-field">
            <label for="hf_home_order"><?php esc_html_e('Orden home', 'horizon-fit-commerce'); ?></label>
            <input type="number" name="hf_home_order" id="hf_home_order" value="">
        </div>
        <div class="form-field">
            <label for="hf_card_copy"><?php esc_html_e('Copy corto', 'horizon-fit-commerce'); ?></label>
            <textarea name="hf_card_copy" id="hf_card_copy" rows="3"></textarea>
        </div>
        <div class="form-field">
            <label for="hf_image_id"><?php esc_html_e('Imagen de colección', 'horizon-fit-commerce'); ?></label>
            <input type="hidden" name="hf_image_id" id="hf_image_id" value="">
            <div class="hf-term-image-preview"></div>
            <button class="button" type="button" data-hf-media-open data-hf-target="#hf_image_id" data-hf-preview=".hf-term-image-preview"><?php esc_html_e('Elegir imagen', 'horizon-fit-commerce'); ?></button>
        </div>
        <?php
    endif;
}

function hf_commerce_save_term_meta($term_id) {
    update_term_meta($term_id, 'hf_featured_home', isset($_POST['hf_featured_home']) ? '1' : '0');
    update_term_meta($term_id, 'hf_home_order', isset($_POST['hf_home_order']) ? absint($_POST['hf_home_order']) : 0);
    update_term_meta($term_id, 'hf_card_copy', isset($_POST['hf_card_copy']) ? sanitize_textarea_field(wp_unslash($_POST['hf_card_copy'])) : '');

    if (isset($_POST['hf_image_id'])) {
        update_term_meta($term_id, 'hf_image_id', absint($_POST['hf_image_id']));
    }
}

function hf_commerce_collection_columns($columns) {
    $columns['hf_featured_home'] = __('Home', 'horizon-fit-commerce');
    $columns['hf_home_order']    = __('Orden', 'horizon-fit-commerce');
    return $columns;
}

function hf_commerce_collection_column_values($value, $column, $term_id) {
    if ('hf_featured_home' === $column) {
        return '1' === get_term_meta($term_id, 'hf_featured_home', true) ? __('Sí', 'horizon-fit-commerce') : '—';
    }

    if ('hf_home_order' === $column) {
        return (string) get_term_meta($term_id, 'hf_home_order', true);
    }

    return $value;
}

function hf_commerce_register_offers_category() {
    if (! taxonomy_exists('product_cat')) {
        return;
    }

    if (! term_exists('ofertas', 'product_cat')) {
        wp_insert_term(
            __('Ofertas', 'horizon-fit-commerce'),
            'product_cat',
            array(
                'slug'        => 'ofertas',
                'description' => __('Productos con precio rebajado activo en WooCommerce.', 'horizon-fit-commerce'),
            )
        );
    }
}

function hf_commerce_sync_offers_from_variation($variation_id) {
    $parent_id = wp_get_post_parent_id($variation_id);
    if ($parent_id) {
        hf_commerce_sync_offers_from_product($parent_id);
    }
}

function hf_commerce_sync_offers_from_product($product_id) {
    if ('product' !== get_post_type($product_id)) {
        return;
    }

    $product = wc_get_product($product_id);
    if (! $product) {
        return;
    }

    $offers = get_term_by('slug', 'ofertas', 'product_cat');
    if (! $offers instanceof WP_Term) {
        return;
    }

    $term_ids = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'ids'));
    $term_ids = is_wp_error($term_ids) ? array() : $term_ids;

    if ($product->is_on_sale()) {
        if (! in_array($offers->term_id, $term_ids, true)) {
            $term_ids[] = $offers->term_id;
            wp_set_post_terms($product_id, array_map('intval', $term_ids), 'product_cat', false);
        }
        return;
    }

    if (in_array($offers->term_id, $term_ids, true)) {
        $term_ids = array_values(array_diff($term_ids, array($offers->term_id)));
        wp_set_post_terms($product_id, array_map('intval', $term_ids), 'product_cat', false);
    }
}

function hf_commerce_render_seed_page() {
    if (! current_user_can('manage_woocommerce')) {
        return;
    }

    $message   = '';
    $blueprint = hf_commerce_parse_storefront_blueprint();

    if (! empty($_POST['hf_seed_catalog'])) {
        check_admin_referer('hf_seed_catalog_action');
        $result  = hf_commerce_seed_catalog_from_blueprint($blueprint);
        $message = sprintf(
            __('Catálogo importado: %1$s productos, %2$s categorías y %3$s colecciones procesadas.', 'horizon-fit-commerce'),
            (int) $result['products'],
            (int) $result['categories'],
            (int) $result['collections']
        );
    }
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Horizon Fit | Seeder de catálogo', 'horizon-fit-commerce'); ?></h1>
        <?php if ($message) : ?>
            <div class="notice notice-success"><p><?php echo esc_html($message); ?></p></div>
        <?php endif; ?>
        <div class="hf-admin-card">
            <h2><?php esc_html_e('Importar el storefront fake a WooCommerce real', 'horizon-fit-commerce'); ?></h2>
            <p><?php esc_html_e('Este proceso toma los productos, categorías y conjuntos del index.html actual y los transforma en productos WooCommerce, categorías reales y colecciones hf_collection.', 'horizon-fit-commerce'); ?></p>
            <ul>
                <li><?php echo esc_html(sprintf(__('Productos detectados: %d', 'horizon-fit-commerce'), count($blueprint['products']))); ?></li>
                <li><?php echo esc_html(sprintf(__('Colecciones detectadas: %d', 'horizon-fit-commerce'), count($blueprint['collections']))); ?></li>
                <li><?php echo esc_html(sprintf(__('Categorías detectadas: %d', 'horizon-fit-commerce'), count($blueprint['categories']))); ?></li>
            </ul>
            <form method="post">
                <?php wp_nonce_field('hf_seed_catalog_action'); ?>
                <button class="button button-primary button-large" type="submit" name="hf_seed_catalog" value="1"><?php esc_html_e('Importar catálogo base', 'horizon-fit-commerce'); ?></button>
            </form>
        </div>
    </div>
    <?php
}

function hf_commerce_render_pricing_page() {
    if (! current_user_can('manage_woocommerce')) {
        return;
    }

    $notice      = '';
    $preview     = array();
    $posted_data = array(
        'category'     => isset($_POST['hf_category']) ? sanitize_text_field(wp_unslash($_POST['hf_category'])) : '',
        'collection'   => isset($_POST['hf_collection']) ? sanitize_text_field(wp_unslash($_POST['hf_collection'])) : '',
        'product_ids'  => isset($_POST['hf_product_ids']) ? sanitize_text_field(wp_unslash($_POST['hf_product_ids'])) : '',
        'mode'         => isset($_POST['hf_mode']) ? sanitize_text_field(wp_unslash($_POST['hf_mode'])) : 'percentage',
        'value'        => isset($_POST['hf_value']) ? (float) wp_unslash($_POST['hf_value']) : 0,
    );

    if (! empty($_POST['hf_preview_prices']) || ! empty($_POST['hf_apply_prices'])) {
        check_admin_referer('hf_pricing_action');
        $product_ids = hf_commerce_collect_target_product_ids($posted_data);

        if (empty($product_ids)) {
            $notice = __('No encontramos productos con esos filtros.', 'horizon-fit-commerce');
        } else {
            $preview = hf_commerce_build_price_preview($product_ids, $posted_data['mode'], $posted_data['value']);

            if (! empty($_POST['hf_apply_prices'])) {
                hf_commerce_apply_price_preview($preview);
                hf_commerce_log_pricing_operation($posted_data, $preview);
                $notice = sprintf(__('Se actualizaron %d filas de precios.', 'horizon-fit-commerce'), count($preview));
            }
        }
    }

    $categories  = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));
    $collections = get_terms(array('taxonomy' => 'hf_collection', 'hide_empty' => false));
    $last_log    = get_option('hf_last_price_change_log', array());
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Horizon Fit | Cambios masivos de precios', 'horizon-fit-commerce'); ?></h1>
        <?php if ($notice) : ?>
            <div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>
        <div class="hf-admin-card">
            <form method="post" class="hf-pricing-grid">
                <?php wp_nonce_field('hf_pricing_action'); ?>
                <label>
                    <span><?php esc_html_e('Categoría', 'horizon-fit-commerce'); ?></span>
                    <select name="hf_category">
                        <option value=""><?php esc_html_e('Todas / sin filtro', 'horizon-fit-commerce'); ?></option>
                        <?php foreach ($categories as $term) : ?>
                            <option value="<?php echo esc_attr($term->slug); ?>" <?php selected($posted_data['category'], $term->slug); ?>><?php echo esc_html($term->name); ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>
                    <span><?php esc_html_e('Colección', 'horizon-fit-commerce'); ?></span>
                    <select name="hf_collection">
                        <option value=""><?php esc_html_e('Todas / sin filtro', 'horizon-fit-commerce'); ?></option>
                        <?php foreach ($collections as $term) : ?>
                            <option value="<?php echo esc_attr($term->slug); ?>" <?php selected($posted_data['collection'], $term->slug); ?>><?php echo esc_html($term->name); ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>
                    <span><?php esc_html_e('IDs de productos', 'horizon-fit-commerce'); ?></span>
                    <input type="text" name="hf_product_ids" value="<?php echo esc_attr($posted_data['product_ids']); ?>" placeholder="12, 45, 93">
                </label>
                <label>
                    <span><?php esc_html_e('Acción', 'horizon-fit-commerce'); ?></span>
                    <select name="hf_mode">
                        <option value="percentage" <?php selected($posted_data['mode'], 'percentage'); ?>><?php esc_html_e('Ajuste %', 'horizon-fit-commerce'); ?></option>
                        <option value="fixed" <?php selected($posted_data['mode'], 'fixed'); ?>><?php esc_html_e('Ajuste monto', 'horizon-fit-commerce'); ?></option>
                        <option value="set_regular" <?php selected($posted_data['mode'], 'set_regular'); ?>><?php esc_html_e('Setear regular', 'horizon-fit-commerce'); ?></option>
                        <option value="set_sale" <?php selected($posted_data['mode'], 'set_sale'); ?>><?php esc_html_e('Setear oferta', 'horizon-fit-commerce'); ?></option>
                        <option value="clear_sale" <?php selected($posted_data['mode'], 'clear_sale'); ?>><?php esc_html_e('Limpiar oferta', 'horizon-fit-commerce'); ?></option>
                    </select>
                </label>
                <label>
                    <span><?php esc_html_e('Valor', 'horizon-fit-commerce'); ?></span>
                    <input type="number" step="0.01" name="hf_value" value="<?php echo esc_attr((string) $posted_data['value']); ?>">
                </label>
                <div class="hf-pricing-actions">
                    <button class="button button-secondary button-large" type="submit" name="hf_preview_prices" value="1"><?php esc_html_e('Ver preview', 'horizon-fit-commerce'); ?></button>
                    <button class="button button-primary button-large" type="submit" name="hf_apply_prices" value="1"><?php esc_html_e('Aplicar cambios', 'horizon-fit-commerce'); ?></button>
                </div>
            </form>
        </div>

        <?php if (! empty($preview)) : ?>
            <div class="hf-admin-card">
                <h2><?php esc_html_e('Preview', 'horizon-fit-commerce'); ?></h2>
                <table class="widefat striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Producto', 'horizon-fit-commerce'); ?></th>
                            <th><?php esc_html_e('Tipo', 'horizon-fit-commerce'); ?></th>
                            <th><?php esc_html_e('Regular actual', 'horizon-fit-commerce'); ?></th>
                            <th><?php esc_html_e('Oferta actual', 'horizon-fit-commerce'); ?></th>
                            <th><?php esc_html_e('Regular nuevo', 'horizon-fit-commerce'); ?></th>
                            <th><?php esc_html_e('Oferta nueva', 'horizon-fit-commerce'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($preview as $row) : ?>
                            <tr>
                                <td><?php echo esc_html($row['label']); ?></td>
                                <td><?php echo esc_html($row['type']); ?></td>
                                <td><?php echo esc_html(wc_format_localized_price($row['old_regular'])); ?></td>
                                <td><?php echo '' === $row['old_sale'] ? '—' : esc_html(wc_format_localized_price($row['old_sale'])); ?></td>
                                <td><?php echo esc_html(wc_format_localized_price($row['new_regular'])); ?></td>
                                <td><?php echo '' === $row['new_sale'] ? '—' : esc_html(wc_format_localized_price($row['new_sale'])); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>

        <?php if (! empty($last_log)) : ?>
            <div class="hf-admin-card">
                <h2><?php esc_html_e('Última operación', 'horizon-fit-commerce'); ?></h2>
                <p><?php echo esc_html(sprintf(__('Fecha: %1$s | Filas afectadas: %2$d | Acción: %3$s', 'horizon-fit-commerce'), $last_log['timestamp'], (int) $last_log['count'], $last_log['mode'])); ?></p>
            </div>
        <?php endif; ?>
    </div>
    <?php
}

function hf_commerce_collect_target_product_ids($filters) {
    $tax_query = array('relation' => 'AND');

    if (! empty($filters['category'])) {
        $tax_query[] = array(
            'taxonomy' => 'product_cat',
            'field'    => 'slug',
            'terms'    => array($filters['category']),
        );
    }

    if (! empty($filters['collection'])) {
        $tax_query[] = array(
            'taxonomy' => 'hf_collection',
            'field'    => 'slug',
            'terms'    => array($filters['collection']),
        );
    }

    $query_args = array(
        'post_type'      => 'product',
        'post_status'    => array('publish', 'private'),
        'posts_per_page' => -1,
        'fields'         => 'ids',
    );

    if (count($tax_query) > 1) {
        $query_args['tax_query'] = $tax_query;
    }

    $query_ids = get_posts($query_args);
    $manual_ids = array();

    if (! empty($filters['product_ids'])) {
        $manual_ids = array_map('absint', preg_split('/[\s,]+/', $filters['product_ids']));
        $manual_ids = array_values(array_filter($manual_ids));
    }

    return array_values(array_unique(array_merge($query_ids, $manual_ids)));
}

function hf_commerce_build_price_preview($product_ids, $mode, $value) {
    $preview = array();

    foreach ($product_ids as $product_id) {
        $product = wc_get_product($product_id);
        if (! $product) {
            continue;
        }

        if ($product->is_type('variable')) {
            foreach ($product->get_children() as $variation_id) {
                $variation = wc_get_product($variation_id);
                if ($variation) {
                    $preview[] = hf_commerce_build_price_row($variation, $mode, $value, $product->get_name());
                }
            }
            continue;
        }

        $preview[] = hf_commerce_build_price_row($product, $mode, $value);
    }

    return $preview;
}

function hf_commerce_build_price_row($product, $mode, $value, $parent_label = '') {
    $old_regular = (float) $product->get_regular_price();
    $old_sale    = '' === $product->get_sale_price() ? '' : (float) $product->get_sale_price();
    $new_regular = $old_regular;
    $new_sale    = $old_sale;

    switch ($mode) {
        case 'percentage':
            $new_regular = $old_regular + ($old_regular * ($value / 100));
            $new_sale    = '' === $old_sale ? '' : $old_sale + ($old_sale * ($value / 100));
            break;
        case 'fixed':
            $new_regular = $old_regular + $value;
            $new_sale    = '' === $old_sale ? '' : $old_sale + $value;
            break;
        case 'set_regular':
            $new_regular = $value;
            break;
        case 'set_sale':
            $new_sale = $value;
            break;
        case 'clear_sale':
            $new_sale = '';
            break;
    }

    return array(
        'id'          => $product->get_id(),
        'parent_id'   => $product->is_type('variation') ? $product->get_parent_id() : $product->get_id(),
        'label'       => $parent_label ? $parent_label . ' / ' . wc_get_formatted_variation($product, true, false, false) : $product->get_name(),
        'type'        => $product->is_type('variation') ? 'variation' : $product->get_type(),
        'old_regular' => round($old_regular, 2),
        'old_sale'    => '' === $old_sale ? '' : round($old_sale, 2),
        'new_regular' => round(max($new_regular, 0), 2),
        'new_sale'    => '' === $new_sale ? '' : round(max($new_sale, 0), 2),
    );
}

function hf_commerce_apply_price_preview($preview) {
    foreach ($preview as $row) {
        $product = wc_get_product($row['id']);
        if (! $product) {
            continue;
        }

        $product->set_regular_price($row['new_regular']);
        $product->set_sale_price('' === $row['new_sale'] ? '' : $row['new_sale']);
        $product->save();

        hf_commerce_sync_offers_from_product($row['parent_id']);
    }
}

function hf_commerce_log_pricing_operation($filters, $preview) {
    update_option(
        'hf_last_price_change_log',
        array(
            'timestamp' => current_time('mysql'),
            'mode'      => $filters['mode'],
            'count'     => count($preview),
            'filters'   => $filters,
        )
    );
}

function hf_commerce_seed_catalog_from_blueprint($blueprint) {
    $category_map   = hf_commerce_category_map();
    $collection_map = hf_commerce_collection_map();
    $categories     = hf_commerce_seed_categories($blueprint['categories'], $category_map);
    $collections    = hf_commerce_seed_collections($blueprint['collections'], $collection_map);
    $products       = hf_commerce_seed_products($blueprint['products'], $category_map, $collection_map);

    return array(
        'products'    => count($products),
        'categories'  => count($categories),
        'collections' => count($collections),
    );
}

function hf_commerce_category_map() {
    return array(
        'Tops' => array(
            'slug'          => 'tops',
            'featured_home' => 1,
            'order'         => 10,
            'description'   => __('Tops, bras y remeras técnicas para entrenamiento y uso diario.', 'horizon-fit-commerce'),
            'image'         => 'https://images.pexels.com/photos/4056535/pexels-photo-4056535.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1',
        ),
        'Calzas' => array(
            'slug'          => 'calzas',
            'featured_home' => 1,
            'order'         => 20,
            'description'   => __('Calzas, leggings y bottoms de compresión con foco en confort.', 'horizon-fit-commerce'),
            'image'         => 'https://images.pexels.com/photos/4056536/pexels-photo-4056536.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1',
        ),
        'Shorts' => array(
            'slug'          => 'shorts',
            'featured_home' => 1,
            'order'         => 30,
            'description'   => __('Shorts, bikers y prendas livianas para entrenamiento funcional.', 'horizon-fit-commerce'),
            'image'         => 'https://images.pexels.com/photos/4056589/pexels-photo-4056589.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1',
        ),
        'Buzos' => array(
            'slug'          => 'buzos',
            'featured_home' => 1,
            'order'         => 40,
            'description'   => __('Buzos, hoodies y capas externas para athleisure o recuperación.', 'horizon-fit-commerce'),
            'image'         => 'https://images.pexels.com/photos/4056589/pexels-photo-4056589.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1',
        ),
        'Accesorios' => array(
            'slug'          => 'accesorios',
            'featured_home' => 1,
            'order'         => 50,
            'description'   => __('Accesorios y piezas editoriales para completar el look.', 'horizon-fit-commerce'),
            'image'         => 'https://images.pexels.com/photos/3838389/pexels-photo-3838389.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1',
        ),
        'Ofertas' => array(
            'slug'          => 'ofertas',
            'featured_home' => 1,
            'order'         => 60,
            'description'   => __('Productos con sale price vigente en WooCommerce.', 'horizon-fit-commerce'),
            'image'         => 'https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1',
        ),
        'Conjuntos' => array(
            'slug'          => 'conjuntos',
            'featured_home' => 0,
            'order'         => 0,
            'description'   => __('Productos seteados como conjuntos o combos del catálogo demo.', 'horizon-fit-commerce'),
        ),
    );
}

function hf_commerce_collection_map() {
    return array(
        'Set Motion' => array(
            'slug'          => 'set-motion',
            'featured_home' => 1,
            'order'         => 10,
            'copy'          => 'Top + calza | Compresión media',
            'products'      => array('BLACK HIGH TOP', 'BLACK HIGH LEGGING'),
        ),
        'Set Power' => array(
            'slug'          => 'set-power',
            'featured_home' => 1,
            'order'         => 20,
            'copy'          => 'Top + short | Liviano y elástico',
            'products'      => array('BLUE HIGH TOP', 'SHORT RUNNING'),
        ),
        'Set Urban' => array(
            'slug'          => 'set-urban',
            'featured_home' => 1,
            'order'         => 30,
            'copy'          => 'Buzo + calza | Athleisure diario',
            'products'      => array('HOODIE OVERSIZE', 'CALZA PUSH UP'),
        ),
        'Set Focus' => array(
            'slug'          => 'set-focus',
            'featured_home' => 1,
            'order'         => 40,
            'copy'          => 'Top + biker | Bajo impacto',
            'products'      => array('TOP HALTER', 'BIKER SHORT'),
        ),
        'Set Energy' => array(
            'slug'          => 'set-energy',
            'featured_home' => 1,
            'order'         => 50,
            'copy'          => 'Top + short | Entrenamiento funcional',
            'products'      => array('SPORTS BRA ENERGY', 'SHORTS TRAINING'),
        ),
    );
}

function hf_commerce_product_category_assignments() {
    return array(
        'BLACK HIGH TOP'    => array('Tops'),
        'BLACK HIGH LEGGING' => array('Calzas'),
        'BLUE HIGH TOP'     => array('Tops'),
        'BLUE HIGH LEGGING' => array('Calzas'),
        'CROP TOP ARENA'    => array('Tops'),
        'JOGGER CLASSIC'    => array('Buzos'),
        'SET COMPLETO'      => array('Conjuntos'),
        'BRA DEPORTIVO'     => array('Tops'),
        'REMERA OVERSIZE'   => array('Tops'),
        'TANK FITTED'       => array('Tops'),
        'SHORT RUNNING'     => array('Shorts'),
        'CALZA THERMAL'     => array('Calzas'),
        'BUZO CROP'         => array('Buzos'),
        'TOP HALTER'        => array('Tops'),
        'JOGGER SLIM'       => array('Buzos'),
        'SET YOGA'          => array('Conjuntos'),
        'JOGGER PREMIUM'    => array('Buzos'),
        'TANK TOP FLOW'     => array('Tops'),
        'LEGGING SEAMLESS'  => array('Calzas'),
        'SHORTS TRAINING'   => array('Shorts'),
        'SPORTS BRA ENERGY' => array('Tops'),
        'HOODIE OVERSIZE'   => array('Buzos'),
        'CALZA PUSH UP'     => array('Calzas'),
        'REMERA CROP'       => array('Tops'),
        'BIKER SHORT'       => array('Shorts'),
        'SET ENTRENAMIENTO' => array('Conjuntos'),
        'CALZA COMPRESIÓN'  => array('Calzas'),
        'BUZO ZIP'          => array('Buzos'),
    );
}

function hf_commerce_featured_product_titles() {
    return array(
        'BLACK HIGH TOP',
        'BLACK HIGH LEGGING',
        'BLUE HIGH TOP',
        'BLUE HIGH LEGGING',
        'CROP TOP ARENA',
        'JOGGER CLASSIC',
        'BRA DEPORTIVO',
        'REMERA OVERSIZE',
        'SHORT RUNNING',
        'BUZO CROP',
    );
}

function hf_commerce_seed_categories($detected_categories, $category_map) {
    $detected_by_name = array();
    foreach ($detected_categories as $category) {
        $detected_by_name[ $category['name'] ] = $category;
    }

    $seeded = array();
    foreach ($category_map as $name => $config) {
        $term = term_exists($config['slug'], 'product_cat');
        if (! $term) {
            $term = wp_insert_term(
                $name,
                'product_cat',
                array(
                    'slug'        => $config['slug'],
                    'description' => $config['description'],
                )
            );
        }

        if (is_wp_error($term)) {
            continue;
        }

        $term_id = is_array($term) ? (int) $term['term_id'] : (int) $term;
        update_term_meta($term_id, 'hf_featured_home', (string) $config['featured_home']);
        update_term_meta($term_id, 'hf_home_order', (string) $config['order']);
        update_term_meta($term_id, 'hf_card_copy', $config['description']);

        $category_image = isset($detected_by_name[ $name ]['image']) ? $detected_by_name[ $name ]['image'] : (isset($config['image']) ? $config['image'] : '');
        if ($category_image) {
            $image_id = hf_commerce_sideload_image($category_image, 0);
            if ($image_id) {
                update_term_meta($term_id, 'thumbnail_id', $image_id);
            } else {
                update_term_meta($term_id, 'hf_remote_image', esc_url_raw($category_image));
            }
        }

        $seeded[] = $term_id;
    }

    return $seeded;
}

function hf_commerce_seed_collections($detected_collections, $collection_map) {
    $detected_by_name = array();
    foreach ($detected_collections as $collection) {
        $detected_by_name[ $collection['title'] ] = $collection;
    }

    $seeded = array();
    foreach ($collection_map as $name => $config) {
        $term = term_exists($config['slug'], 'hf_collection');
        if (! $term) {
            $term = wp_insert_term(
                $name,
                'hf_collection',
                array(
                    'slug'        => $config['slug'],
                    'description' => isset($detected_by_name[ $name ]['meta']) ? $detected_by_name[ $name ]['meta'] : $config['copy'],
                )
            );
        }

        if (is_wp_error($term)) {
            continue;
        }

        $term_id = is_array($term) ? (int) $term['term_id'] : (int) $term;
        update_term_meta($term_id, 'hf_featured_home', (string) $config['featured_home']);
        update_term_meta($term_id, 'hf_home_order', (string) $config['order']);
        update_term_meta($term_id, 'hf_card_copy', $config['copy']);

        if (isset($detected_by_name[ $name ]['image'])) {
            $image_id = hf_commerce_sideload_image($detected_by_name[ $name ]['image'], 0);
            if ($image_id) {
                update_term_meta($term_id, 'hf_image_id', $image_id);
            } else {
                update_term_meta($term_id, 'hf_remote_image', esc_url_raw($detected_by_name[ $name ]['image']));
            }
        }

        $seeded[] = $term_id;
    }

    return $seeded;
}

function hf_commerce_seed_products($detected_products, $category_map, $collection_map) {
    $assignments = hf_commerce_product_category_assignments();
    $featured    = hf_commerce_featured_product_titles();
    $seeded      = array();

    foreach ($detected_products as $data) {
        $slug     = sanitize_title($data['title']);
        $existing_post = get_page_by_path($slug, OBJECT, 'product');
        $product       = $existing_post ? wc_get_product($existing_post->ID) : new WC_Product_Variable();
        if (! $product) {
            $product = new WC_Product_Variable();
        }

        if (! $product->is_type('variable') && $product->get_id()) {
            wp_set_object_terms($product->get_id(), 'variable', 'product_type');
            $product = new WC_Product_Variable($product->get_id());
        }

        $product->set_name($data['title']);
        $product->set_slug($slug);
        $product->set_status('publish');
        $product->set_catalog_visibility('visible');
        $product->set_featured(in_array($data['title'], $featured, true));
        $product->set_short_description(hf_commerce_build_product_short_description($data['title']));
        $product->set_description(hf_commerce_build_product_description($data['title']));

        $attributes = array();
        $size_attr  = new WC_Product_Attribute();
        $size_attr->set_name('Talle');
        $size_attr->set_options($data['sizes']);
        $size_attr->set_visible(true);
        $size_attr->set_variation(true);
        $attributes[] = $size_attr;

        $color = hf_commerce_infer_color_label($data['title']);
        $color_attr = new WC_Product_Attribute();
        $color_attr->set_name('Color');
        $color_attr->set_options(array($color));
        $color_attr->set_visible(true);
        $color_attr->set_variation(true);
        $attributes[] = $color_attr;

        $product->set_attributes($attributes);
        $product->set_default_attributes(
            array(
                'talle' => ! empty($data['sizes']) ? $data['sizes'][0] : 'S',
                'color' => $color,
            )
        );
        $product->save();
        update_post_meta($product->get_id(), '_hf_seed_key', $slug);

        $product_id  = $product->get_id();
        $seeded[]    = $product_id;
        $term_ids    = array();
        $categories  = isset($assignments[ $data['title'] ]) ? $assignments[ $data['title'] ] : array('Accesorios');

        foreach ($categories as $category_name) {
            if (! isset($category_map[ $category_name ])) {
                continue;
            }

            $term = get_term_by('slug', $category_map[ $category_name ]['slug'], 'product_cat');
            if ($term instanceof WP_Term) {
                $term_ids[] = (int) $term->term_id;
            }
        }

        if (! empty($term_ids)) {
            wp_set_post_terms($product_id, $term_ids, 'product_cat', false);
        }

        foreach ($collection_map as $name => $config) {
            if (in_array($data['title'], $config['products'], true)) {
                $term = get_term_by('slug', $config['slug'], 'hf_collection');
                if ($term instanceof WP_Term) {
                    wp_set_post_terms($product_id, array((int) $term->term_id), 'hf_collection', true);
                }
            }
        }

        $attachment_ids = array();
        foreach ($data['images'] as $index => $image_url) {
            $attachment_id = hf_commerce_sideload_image($image_url, $product_id);
            if ($attachment_id) {
                $attachment_ids[] = $attachment_id;
            }
            if ($index >= 2) {
                break;
            }
        }

        if (! empty($attachment_ids)) {
            $product->set_image_id($attachment_ids[0]);
            if (count($attachment_ids) > 1) {
                $product->set_gallery_image_ids(array_slice($attachment_ids, 1));
            }
            $product->save();
        }

        hf_commerce_seed_variations($product, $data, $color);
        hf_commerce_sync_offers_from_product($product_id);
    }

    return $seeded;
}

function hf_commerce_seed_variations($product, $data, $color) {
    if (! $product instanceof WC_Product_Variable) {
        return;
    }

    $children = $product->get_children();
    foreach ($children as $child_id) {
        wp_delete_post($child_id, true);
    }

    $regular = hf_commerce_parse_price($data['compare'] ?: $data['price']);
    $sale    = $data['compare'] && hf_commerce_parse_price($data['price']) < $regular ? hf_commerce_parse_price($data['price']) : '';

    foreach ($data['sizes'] as $size) {
        $variation = new WC_Product_Variation();
        $variation->set_parent_id($product->get_id());
        $variation->set_regular_price($regular);
        if ('' !== $sale) {
            $variation->set_sale_price($sale);
        }
        $variation->set_attributes(
            array(
                'talle' => $size,
                'color' => $color,
            )
        );
        $variation->set_manage_stock(false);
        $variation->set_stock_status('instock');
        $variation->save();
    }

    WC_Product_Variable::sync($product->get_id());
    wc_delete_product_transients($product->get_id());
}

function hf_commerce_parse_price($raw_value) {
    $value = preg_replace('/[^\d,\.]/', '', (string) $raw_value);
    $value = str_replace('.', '', $value);
    $value = str_replace(',', '.', $value);
    return (float) $value;
}

function hf_commerce_infer_color_label($title) {
    $title = strtoupper($title);
    if (false !== strpos($title, 'BLACK')) {
        return 'Negro';
    }
    if (false !== strpos($title, 'BLUE')) {
        return 'Azul';
    }
    if (false !== strpos($title, 'ARENA')) {
        return 'Arena';
    }
    return 'Neutro';
}

function hf_commerce_build_product_short_description($title) {
    return sprintf(
        __('%s forma parte del catálogo base de Horizon Fit y ya queda listo para manejar fotos, precios, talles, color y checkout real desde WooCommerce.', 'horizon-fit-commerce'),
        $title
    );
}

function hf_commerce_build_product_description($title) {
    return sprintf(
        __('%s fue importado desde el storefront original para funcionar como producto real en WooCommerce. Desde ahora podés editar galerías, atributos, stock, precios y visibilidad sin tocar el frontend.', 'horizon-fit-commerce'),
        $title
    );
}

function hf_commerce_sideload_image($url, $post_id = 0) {
    if (! $url) {
        return 0;
    }

    $existing = get_posts(
        array(
            'post_type'      => 'attachment',
            'meta_key'       => '_hf_source_url',
            'meta_value'     => $url,
            'posts_per_page' => 1,
            'fields'         => 'ids',
        )
    );
    if (! empty($existing[0])) {
        return (int) $existing[0];
    }

    if (! function_exists('media_sideload_image')) {
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
    }

    $attachment_id = media_sideload_image($url, $post_id, null, 'id');
    if (is_wp_error($attachment_id)) {
        return 0;
    }

    update_post_meta($attachment_id, '_hf_source_url', esc_url_raw($url));
    return (int) $attachment_id;
}
