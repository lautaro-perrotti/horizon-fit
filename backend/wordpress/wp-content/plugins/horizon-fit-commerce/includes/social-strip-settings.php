<?php
/**
 * "#HorizonFit" (social-strip) - página de ajustes en wp-admin.
 * Edita los 6 posts (imagen + usuario + link). Guarda en _hf_section_settings
 * (JSON) de la sección tipo "social-strip" de la home → home-sections.json.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_social_strip_defaults() {
    $img = function ($id) {
        return 'https://images.pexels.com/photos/' . $id . '?auto=compress&cs=tinysrgb&w=900&h=1300&dpr=1';
    };
    return [
        'posts' => [
            ['image' => $img('4056536/pexels-photo-4056536.jpeg'), 'user' => '@horizonfit', 'link' => '#'],
            ['image' => $img('3757376/pexels-photo-3757376.jpeg'), 'user' => '@horizonfit', 'link' => '#'],
            ['image' => $img('3838389/pexels-photo-3838389.jpeg'), 'user' => '@horizonfit', 'link' => '#'],
            ['image' => $img('4056535/pexels-photo-4056535.jpeg'), 'user' => '@horizonfit', 'link' => '#'],
            ['image' => $img('4056589/pexels-photo-4056589.jpeg'), 'user' => '@horizonfit', 'link' => '#'],
            ['image' => $img('4056723/pexels-photo-4056723.jpeg'), 'user' => '@horizonfit', 'link' => '#'],
        ],
    ];
}

function hf_social_strip_section_id() {
    $sections = get_posts([
        'post_type'   => 'hf_page_section',
        'meta_key'    => '_hf_section_type',
        'meta_value'  => 'social-strip',
        'numberposts' => 1,
        'fields'      => 'ids',
    ]);
    return !empty($sections) ? (int) $sections[0] : 0;
}

function hf_social_strip_ensure_section() {
    $id = hf_social_strip_section_id();
    if ($id) {
        return $id;
    }
    $home = get_posts(['post_type' => 'hf_page', 'name' => 'home', 'numberposts' => 1, 'fields' => 'ids']);
    $page_id = !empty($home) ? (int) $home[0] : 0;
    $id = wp_insert_post([
        'post_type'   => 'hf_page_section',
        'post_status' => 'publish',
        'post_title'  => 'Sección: social-strip',
    ]);
    if ($id && !is_wp_error($id)) {
        update_post_meta($id, '_hf_section_type', 'social-strip');
        update_post_meta($id, '_hf_page_id', $page_id);
        update_post_meta($id, '_hf_section_order', 11);
        update_post_meta($id, '_hf_section_visible', 1);
        update_post_meta($id, '_hf_section_settings', wp_json_encode(hf_social_strip_defaults(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        return $id;
    }
    return 0;
}
add_action('init', 'hf_social_strip_ensure_section', 20);

function hf_social_strip_get_settings() {
    $id = hf_social_strip_section_id();
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
    return !empty($saved['posts']) ? $saved : hf_social_strip_defaults();
}

function hf_commerce_render_social_strip_settings_page() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }

    $saved_notice = false;
    if (!empty($_POST['hf_social_strip_submit'])) {
        check_admin_referer('hf_social_strip_action');
        $p = wp_unslash($_POST);
        $images = array_map('esc_url_raw', (array) ($p['social_image'] ?? []));
        $users  = array_map('sanitize_text_field', (array) ($p['social_user'] ?? []));
        $links  = array_map('sanitize_text_field', (array) ($p['social_link'] ?? []));
        $posts = [];
        for ($i = 0; $i < 6; $i++) {
            $posts[] = [
                'image' => $images[$i] ?? '',
                'user'  => $users[$i] ?? '',
                'link'  => $links[$i] ?? '',
            ];
        }
        $id = hf_social_strip_ensure_section();
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode(['posts' => $posts], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }
            $saved_notice = true;
        }
    }

    $s = hf_social_strip_get_settings();
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('#HorizonFit (redes sociales)', 'horizon-fit-commerce'); ?></h1>
        <?php if ($saved_notice) : ?>
            <div class="notice notice-success"><p><?php esc_html_e('Sección guardada.', 'horizon-fit-commerce'); ?></p></div>
        <?php endif; ?>
        <p class="description"><?php esc_html_e('Las 6 fotos del carrusel de la home. Editá la imagen, el usuario y el link de cada una.', 'horizon-fit-commerce'); ?></p>
        <form method="post">
            <?php wp_nonce_field('hf_social_strip_action'); ?>
            <table class="form-table">
                <?php for ($i = 0; $i < 6; $i++) :
                    $post = $s['posts'][$i] ?? ['image' => '', 'user' => '', 'link' => ''];
                    $img = $post['image'] ?? ''; ?>
                    <tr>
                        <th scope="row"><label><?php echo 'Foto ' . ($i + 1); ?></label></th>
                        <td>
                            <p>
                                <input type="text" name="social_image[]" id="hf_social_image_<?php echo $i; ?>" value="<?php echo esc_attr($img); ?>" placeholder="URL de la imagen" style="width:100%;max-width:420px;">
                                <button class="button" type="button" data-hf-media-url data-hf-media-url-type="image" data-hf-target="#hf_social_image_<?php echo $i; ?>" data-hf-preview=".hf-social-image-preview-<?php echo $i; ?>"><?php esc_html_e('Elegir imagen', 'horizon-fit-commerce'); ?></button>
                                <span class="hf-social-image-preview-<?php echo $i; ?>" style="display:inline-block;vertical-align:middle;margin-left:8px;"><?php if ($img) : ?><img src="<?php echo esc_url($img); ?>" alt="" style="max-width:140px;border-radius:6px;"><?php endif; ?></span>
                            </p>
                            <p>
                                <input type="text" name="social_user[]" value="<?php echo esc_attr($post['user']); ?>" placeholder="Usuario (ej. @horizonfit)" style="width:100%;max-width:520px;">
                            </p>
                            <p>
                                <input type="text" name="social_link[]" value="<?php echo esc_attr($post['link']); ?>" placeholder="Link (ej. https://instagram.com/p/...)" style="width:100%;max-width:520px;">
                            </p>
                        </td>
                    </tr>
                <?php endfor; ?>
            </table>
            <p class="submit"><button type="submit" name="hf_social_strip_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar', 'horizon-fit-commerce'); ?></button></p>
        </form>
    </div>
    <?php
}
