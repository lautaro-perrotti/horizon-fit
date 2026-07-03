<?php
/**
 * Barra de confianza (trust-bar) - página de ajustes en wp-admin.
 * Edita los 4 items de la home y los 3 bloques informativos de la PDP.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_trust_defaults() {
    return [
        'items' => [
            ['title' => 'Envíos gratis a todo el país', 'description' => 'En compras superiores a $150.000'],
            ['title' => '3 y 6 cuotas sin interés', 'description' => 'Pagando con débito y crédito'],
            ['title' => 'Cambios fáciles', 'description' => 'Tenés hasta 30 días para cambiar tu compra'],
            ['title' => 'Atención personalizada', 'description' => 'Te acompañamos antes y después de tu compra'],
        ],
        'pdpItems' => [
            [
                'title' => 'RETIRO Y ENVÍO GRATIS',
                'descriptionHtml' => 'Retira gratis en nuestras tiendas o envío gratis en compras mayores a $40.000',
            ],
            [
                'title' => 'CAMBIOS Y DEVOLUCIONES',
                'descriptionHtml' => '¿Dudas sobre tu elección? Tenes hasta 6 meses para cambiar tu compra y hasta 15 días de devolución.',
            ],
            [
                'title' => 'Información cuotas',
                'descriptionHtml' => 'Pagá con Visa, Amex y Master en 3 cuotas sin interés en compras superiores a $60.000. <a href="#">Ver condiciones de financiación</a>',
            ],
        ],
    ];
}

function hf_trust_section_id() {
    $sections = get_posts([
        'post_type'   => 'hf_page_section',
        'meta_key'    => '_hf_section_type',
        'meta_value'  => 'trust-bar',
        'numberposts' => 1,
        'fields'      => 'ids',
    ]);
    return !empty($sections) ? (int) $sections[0] : 0;
}

// Crea la sección trust-bar si no existe (vinculada a la home).
function hf_trust_ensure_section() {
    $id = hf_trust_section_id();
    if ($id) {
        return $id;
    }

    $home = get_posts([
        'post_type'   => 'hf_page',
        'name'        => 'home',
        'numberposts' => 1,
        'fields'      => 'ids',
    ]);
    $page_id = !empty($home) ? (int) $home[0] : 0;

    $id = wp_insert_post([
        'post_type'   => 'hf_page_section',
        'post_status' => 'publish',
        'post_title'  => 'Sección: trust-bar',
    ]);

    if ($id && !is_wp_error($id)) {
        update_post_meta($id, '_hf_section_type', 'trust-bar');
        update_post_meta($id, '_hf_page_id', $page_id);
        update_post_meta($id, '_hf_section_order', 9);
        update_post_meta($id, '_hf_section_visible', 1);
        update_post_meta($id, '_hf_section_settings', wp_json_encode(hf_trust_defaults(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        return $id;
    }

    return 0;
}
add_action('init', 'hf_trust_ensure_section', 20);

function hf_trust_ensure_pdp_defaults() {
    $id = hf_trust_ensure_section();
    if (!$id) {
        return;
    }

    $raw = get_post_meta($id, '_hf_section_settings', true);
    $settings = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $settings = $decoded;
        }
    }

    if (!empty($settings['pdpItems']) && is_array($settings['pdpItems'])) {
        return;
    }

    $defaults = hf_trust_defaults();
    $settings['items'] = !empty($settings['items']) && is_array($settings['items'])
        ? $settings['items']
        : $defaults['items'];
    $settings['pdpItems'] = $defaults['pdpItems'];

    update_post_meta($id, '_hf_section_settings', wp_json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    if (function_exists('hf_regenerate_sections_cache')) {
        hf_regenerate_sections_cache();
    }
}
add_action('init', 'hf_trust_ensure_pdp_defaults', 30);

function hf_trust_get_settings() {
    $id = hf_trust_section_id();
    $saved = [];

    if ($id) {
        $raw = get_post_meta($id, '_hf_section_settings', true);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $saved = $decoded;
            }
        }
    }

    $defaults = hf_trust_defaults();

    return [
        'items' => !empty($saved['items']) && is_array($saved['items']) ? $saved['items'] : $defaults['items'],
        'pdpItems' => !empty($saved['pdpItems']) && is_array($saved['pdpItems']) ? $saved['pdpItems'] : $defaults['pdpItems'],
    ];
}

function hf_commerce_render_trust_settings_page() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }

    $saved_notice = false;

    if (!empty($_POST['hf_trust_submit'])) {
        check_admin_referer('hf_trust_action');
        $p = wp_unslash($_POST);

        $titles = array_map('sanitize_text_field', (array) ($p['trust_title'] ?? []));
        $descs = array_map('sanitize_text_field', (array) ($p['trust_desc'] ?? []));
        $items = [];
        for ($i = 0; $i < 4; $i++) {
            $items[] = [
                'title' => $titles[$i] ?? '',
                'description' => $descs[$i] ?? '',
            ];
        }

        $pdp_titles = array_map('sanitize_text_field', (array) ($p['pdp_trust_title'] ?? []));
        $pdp_descs = (array) ($p['pdp_trust_desc'] ?? []);
        $pdp_items = [];
        for ($i = 0; $i < 3; $i++) {
            $pdp_items[] = [
                'title' => $pdp_titles[$i] ?? '',
                'descriptionHtml' => wp_kses_post($pdp_descs[$i] ?? ''),
            ];
        }

        $id = hf_trust_ensure_section();
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode([
                'items' => $items,
                'pdpItems' => $pdp_items,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }

            $saved_notice = true;
        }
    }

    $s = hf_trust_get_settings();
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Barra de confianza', 'horizon-fit-commerce'); ?></h1>
        <?php if ($saved_notice) : ?>
            <div class="notice notice-success"><p><?php esc_html_e('Barra de confianza guardada.', 'horizon-fit-commerce'); ?></p></div>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('hf_trust_action'); ?>

            <h2><?php esc_html_e('Home - Barra de confianza', 'horizon-fit-commerce'); ?></h2>
            <p class="description"><?php esc_html_e('Los 4 bloques que aparecen en la home. Editá el título y la descripción de cada uno.', 'horizon-fit-commerce'); ?></p>
            <table class="form-table">
                <?php for ($i = 0; $i < 4; $i++) :
                    $item = $s['items'][$i] ?? ['title' => '', 'description' => '']; ?>
                    <tr>
                        <th scope="row"><label><?php echo esc_html('Bloque ' . ($i + 1)); ?></label></th>
                        <td>
                            <input type="text" name="trust_title[]" value="<?php echo esc_attr($item['title']); ?>" placeholder="Título" style="width:100%;max-width:620px;margin-bottom:6px;"><br>
                            <input type="text" name="trust_desc[]" value="<?php echo esc_attr($item['description']); ?>" placeholder="Descripción" style="width:100%;max-width:620px;">
                        </td>
                    </tr>
                <?php endfor; ?>
            </table>

            <h2><?php esc_html_e('Producto - Bloques debajo de comprar', 'horizon-fit-commerce'); ?></h2>
            <p class="description"><?php esc_html_e('Estos 3 bloques aparecen en la página de producto. El texto acepta links HTML simples.', 'horizon-fit-commerce'); ?></p>
            <table class="form-table">
                <?php for ($i = 0; $i < 3; $i++) :
                    $item = $s['pdpItems'][$i] ?? ['title' => '', 'descriptionHtml' => '']; ?>
                    <tr>
                        <th scope="row"><label><?php echo esc_html('Bloque producto ' . ($i + 1)); ?></label></th>
                        <td>
                            <input type="text" name="pdp_trust_title[]" value="<?php echo esc_attr($item['title']); ?>" placeholder="Título" style="width:100%;max-width:620px;margin-bottom:6px;"><br>
                            <textarea name="pdp_trust_desc[]" rows="3" placeholder="Texto" style="width:100%;max-width:620px;"><?php echo esc_textarea($item['descriptionHtml']); ?></textarea>
                        </td>
                    </tr>
                <?php endfor; ?>
            </table>

            <p class="submit">
                <button type="submit" name="hf_trust_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar', 'horizon-fit-commerce'); ?></button>
            </p>
        </form>
    </div>
    <?php
}
