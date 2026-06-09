<?php
/**
 * "Elegí tu estilo" (style-edit) - página de ajustes en wp-admin.
 * Edita los 4 tiles (video + título + link). Guarda en _hf_section_settings
 * (JSON) de la sección tipo "style-edit" de la home → home-sections.json.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_style_edit_defaults() {
    return [
        'tiles' => [
            ['title' => 'Básicos', 'video' => 'assets/style-tile-basicos.mp4', 'link' => '#fullSlider'],
            ['title' => 'Studio',  'video' => 'assets/style-tile-studio.mp4',  'link' => '#fullSlider'],
            ['title' => 'Urbano',  'video' => 'assets/style-tile-urbano.mp4',  'link' => '#fullSlider'],
            ['title' => 'Prints',  'video' => 'assets/style-tile-prints.mp4',  'link' => '#fullSlider'],
        ],
    ];
}

function hf_style_edit_section_id() {
    $sections = get_posts([
        'post_type'   => 'hf_page_section',
        'meta_key'    => '_hf_section_type',
        'meta_value'  => 'style-edit',
        'numberposts' => 1,
        'fields'      => 'ids',
    ]);
    return !empty($sections) ? (int) $sections[0] : 0;
}

function hf_style_edit_ensure_section() {
    $id = hf_style_edit_section_id();
    if ($id) {
        return $id;
    }
    $home = get_posts(['post_type' => 'hf_page', 'name' => 'home', 'numberposts' => 1, 'fields' => 'ids']);
    $page_id = !empty($home) ? (int) $home[0] : 0;
    $id = wp_insert_post([
        'post_type'   => 'hf_page_section',
        'post_status' => 'publish',
        'post_title'  => 'Sección: style-edit',
    ]);
    if ($id && !is_wp_error($id)) {
        update_post_meta($id, '_hf_section_type', 'style-edit');
        update_post_meta($id, '_hf_page_id', $page_id);
        update_post_meta($id, '_hf_section_order', 10);
        update_post_meta($id, '_hf_section_visible', 1);
        update_post_meta($id, '_hf_section_settings', wp_json_encode(hf_style_edit_defaults(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        return $id;
    }
    return 0;
}
add_action('init', 'hf_style_edit_ensure_section', 20);

function hf_style_edit_get_settings() {
    $id = hf_style_edit_section_id();
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
    return !empty($saved['tiles']) ? $saved : hf_style_edit_defaults();
}

function hf_commerce_render_style_edit_settings_page() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }

    $saved_notice = false;
    if (!empty($_POST['hf_style_edit_submit'])) {
        check_admin_referer('hf_style_edit_action');
        $p = wp_unslash($_POST);
        $titles = array_map('sanitize_text_field', (array) ($p['style_title'] ?? []));
        $videos = array_map('esc_url_raw', (array) ($p['style_video'] ?? []));
        $links  = array_map('sanitize_text_field', (array) ($p['style_link'] ?? []));
        $tiles = [];
        for ($i = 0; $i < 4; $i++) {
            $tiles[] = [
                'title' => $titles[$i] ?? '',
                'video' => $videos[$i] ?? '',
                'link'  => $links[$i] ?? '',
            ];
        }
        $id = hf_style_edit_ensure_section();
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode(['tiles' => $tiles], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }
            $saved_notice = true;
        }
    }

    $s = hf_style_edit_get_settings();
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Elegí tu estilo', 'horizon-fit-commerce'); ?></h1>
        <?php if ($saved_notice) : ?>
            <div class="notice notice-success"><p><?php esc_html_e('Sección guardada.', 'horizon-fit-commerce'); ?></p></div>
        <?php endif; ?>
        <p class="description"><?php esc_html_e('Los 4 tiles de la home. Editá el video, el título y el link de cada uno.', 'horizon-fit-commerce'); ?></p>
        <form method="post">
            <?php wp_nonce_field('hf_style_edit_action'); ?>
            <table class="form-table">
                <?php for ($i = 0; $i < 4; $i++) :
                    $tile = $s['tiles'][$i] ?? ['title' => '', 'video' => '', 'link' => ''];
                    $vid = $tile['video'] ?? ''; ?>
                    <tr>
                        <th scope="row"><label><?php echo 'Tile ' . ($i + 1); ?></label></th>
                        <td>
                            <p>
                                <input type="text" name="style_title[]" value="<?php echo esc_attr($tile['title']); ?>" placeholder="Título (ej. Básicos)" style="width:100%;max-width:520px;">
                            </p>
                            <p>
                                <input type="text" name="style_video[]" id="hf_style_video_<?php echo $i; ?>" value="<?php echo esc_attr($vid); ?>" placeholder="URL del video (.mp4)" style="width:100%;max-width:420px;">
                                <button class="button" type="button" data-hf-media-url data-hf-media-url-type="video" data-hf-target="#hf_style_video_<?php echo $i; ?>" data-hf-preview=".hf-style-video-preview-<?php echo $i; ?>"><?php esc_html_e('Elegir video', 'horizon-fit-commerce'); ?></button>
                                <span class="hf-style-video-preview-<?php echo $i; ?>" style="display:inline-block;vertical-align:middle;margin-left:8px;"><?php if ($vid) : ?><video src="<?php echo esc_url($vid); ?>" muted loop style="max-width:140px;border-radius:6px;"></video><?php endif; ?></span>
                            </p>
                            <p>
                                <input type="text" name="style_link[]" value="<?php echo esc_attr($tile['link']); ?>" placeholder="Link (ej. /coleccion/?cat=basicos o #fullSlider)" style="width:100%;max-width:520px;">
                            </p>
                        </td>
                    </tr>
                <?php endfor; ?>
            </table>
            <p class="submit"><button type="submit" name="hf_style_edit_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar', 'horizon-fit-commerce'); ?></button></p>
        </form>
    </div>
    <?php
}
