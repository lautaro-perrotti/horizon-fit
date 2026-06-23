<?php
/**
 * Footer - página de ajustes en wp-admin
 * Edita TODOS los textos/links del footer. Guarda en el _hf_section_settings
 * (JSON) de la sección tipo "footer" de la home, que el frontend lee desde
 * home-sections.json (mismo patrón que hero/marquee).
 */

if (!defined('ABSPATH')) {
    exit;
}

// Valores por defecto (los del HOME-ORIGINAL), para que no arranque en blanco.
function hf_footer_defaults() {
    return [
        'badge'           => 'Horizon Fit',
        'title'           => 'Más allá de tus horizontes',
        'copy'            => 'Activewear funcional para todos los dias. Nuevos drops, mejores telas y fits pensados para entrenar y vivir en movimiento.',
        'newsPlaceholder' => 'Tu email para promos y drops',
        'newsBtn'         => 'Suscribirme',
        'chips'           => ['Envio 24/48h', '6 cuotas sin interes', 'Cambios faciles'],
        'helpTitle'       => 'Ayuda',
        'helpLinks'       => [
            ['text' => 'Envios y entregas', 'url' => '/envios-y-entregas/'],
            ['text' => 'Cambios y devoluciones', 'url' => '/cambios-y-devoluciones/'],
            ['text' => 'Guia de talles', 'url' => '/guia-de-talles/'],
            ['text' => 'Medios de pago', 'url' => '/medios-de-pago/'],
        ],
        'contactTitle'    => 'Contacto',
        'contactLines'    => ['WhatsApp: +54 9 11 0000 0000', 'hola@horizonfit.com', 'Lunes a viernes 9 a 18h'],
        'social'          => ['instagram' => '#', 'facebook' => '#', 'tiktok' => '#', 'spotify' => '#'],
        'copyright'       => '© Horizon Fit 2026. Todos los derechos reservados.',
        'legalLinks'      => [
            ['text' => 'Terminos', 'url' => '#'],
            ['text' => 'Privacidad', 'url' => '#'],
            ['text' => 'Defensa al consumidor', 'url' => '#'],
        ],
    ];
}

// Localiza el post de la sección "footer" de la home.
function hf_footer_section_id() {
    $sections = get_posts([
        'post_type'  => 'hf_page_section',
        'meta_key'   => '_hf_section_type',
        'meta_value' => 'footer',
        'numberposts' => 1,
        'fields'     => 'ids',
    ]);
    return !empty($sections) ? (int) $sections[0] : 0;
}

// Lee los settings guardados, mezclados con los defaults.
function hf_footer_get_settings() {
    $id = hf_footer_section_id();
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
    return array_merge(hf_footer_defaults(), $saved);
}

function hf_commerce_render_footer_settings_page() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }

    $saved_notice = false;
    if (!empty($_POST['hf_footer_submit'])) {
        check_admin_referer('hf_footer_action');
        $p = wp_unslash($_POST);

        $clean = function ($v) { return sanitize_text_field($v); };
        $chips = array_map($clean, (array) ($p['chips'] ?? []));
        $contactLines = array_map($clean, (array) ($p['contact'] ?? []));

        $helpLinks = [];
        foreach ((array) ($p['help_text'] ?? []) as $i => $txt) {
            $helpLinks[] = ['text' => $clean($txt), 'url' => esc_url_raw($p['help_url'][$i] ?? '#')];
        }
        $legalLinks = [];
        foreach ((array) ($p['legal_text'] ?? []) as $i => $txt) {
            $legalLinks[] = ['text' => $clean($txt), 'url' => esc_url_raw($p['legal_url'][$i] ?? '#')];
        }

        $settings = [
            'badge'           => $clean($p['badge'] ?? ''),
            'title'           => $clean($p['title'] ?? ''),
            'copy'            => sanitize_textarea_field($p['copy'] ?? ''),
            'newsPlaceholder' => $clean($p['newsPlaceholder'] ?? ''),
            'newsBtn'         => $clean($p['newsBtn'] ?? ''),
            'chips'           => $chips,
            'helpTitle'       => $clean($p['helpTitle'] ?? ''),
            'helpLinks'       => $helpLinks,
            'contactTitle'    => $clean($p['contactTitle'] ?? ''),
            'contactLines'    => $contactLines,
            'social'          => [
                'instagram' => esc_url_raw($p['social_instagram'] ?? '#'),
                'facebook'  => esc_url_raw($p['social_facebook'] ?? '#'),
                'tiktok'    => esc_url_raw($p['social_tiktok'] ?? '#'),
                'spotify'   => esc_url_raw($p['social_spotify'] ?? '#'),
            ],
            'copyright'       => $clean($p['copyright'] ?? ''),
            'legalLinks'      => $legalLinks,
        ];

        $id = hf_footer_section_id();
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }
            $saved_notice = true;
        }
    }

    $s = hf_footer_get_settings();
    $field = function ($name, $value, $label) {
        echo '<tr><th scope="row"><label>' . esc_html($label) . '</label></th><td><input type="text" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" style="width:100%;max-width:520px;"></td></tr>';
    };
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Footer', 'horizon-fit-commerce'); ?></h1>
        <?php if ($saved_notice) : ?>
            <div class="notice notice-success"><p><?php esc_html_e('Footer guardado.', 'horizon-fit-commerce'); ?></p></div>
        <?php endif; ?>
        <?php if (!hf_footer_section_id()) : ?>
            <div class="notice notice-error"><p><?php esc_html_e('No se encontró la sección footer. Avisá al desarrollador.', 'horizon-fit-commerce'); ?></p></div>
        <?php endif; ?>
        <form method="post">
            <?php wp_nonce_field('hf_footer_action'); ?>

            <h2><?php esc_html_e('Marca', 'horizon-fit-commerce'); ?></h2>
            <table class="form-table">
                <?php
                $field('badge', $s['badge'], 'Etiqueta (badge)');
                $field('title', $s['title'], 'Título');
                ?>
                <tr><th scope="row"><label>Texto</label></th><td><textarea name="copy" rows="3" style="width:100%;max-width:520px;"><?php echo esc_textarea($s['copy']); ?></textarea></td></tr>
                <?php
                $field('newsPlaceholder', $s['newsPlaceholder'], 'Placeholder del email');
                $field('newsBtn', $s['newsBtn'], 'Botón newsletter');
                ?>
            </table>

            <h2><?php esc_html_e('Chips de confianza', 'horizon-fit-commerce'); ?></h2>
            <table class="form-table">
                <?php for ($i = 0; $i < 3; $i++) : ?>
                    <tr><th scope="row"><label><?php echo 'Chip ' . ($i + 1); ?></label></th><td><input type="text" name="chips[]" value="<?php echo esc_attr($s['chips'][$i] ?? ''); ?>" style="width:100%;max-width:520px;"></td></tr>
                <?php endfor; ?>
            </table>

            <h2><?php esc_html_e('Columna "Ayuda"', 'horizon-fit-commerce'); ?></h2>
            <table class="form-table">
                <?php $field('helpTitle', $s['helpTitle'], 'Título columna'); ?>
                <?php for ($i = 0; $i < 4; $i++) :
                    $hl = $s['helpLinks'][$i] ?? ['text' => '', 'url' => '#']; ?>
                    <tr><th scope="row"><label><?php echo 'Link ' . ($i + 1); ?></label></th>
                    <td><input type="text" name="help_text[]" value="<?php echo esc_attr($hl['text']); ?>" placeholder="Texto" style="width:48%;">
                        <input type="text" name="help_url[]" value="<?php echo esc_attr($hl['url']); ?>" placeholder="URL" style="width:48%;"></td></tr>
                <?php endfor; ?>
            </table>

            <h2><?php esc_html_e('Contacto', 'horizon-fit-commerce'); ?></h2>
            <table class="form-table">
                <?php $field('contactTitle', $s['contactTitle'], 'Título columna'); ?>
                <?php for ($i = 0; $i < 3; $i++) : ?>
                    <tr><th scope="row"><label><?php echo 'Línea ' . ($i + 1); ?></label></th><td><input type="text" name="contact[]" value="<?php echo esc_attr($s['contactLines'][$i] ?? ''); ?>" style="width:100%;max-width:520px;"></td></tr>
                <?php endfor; ?>
            </table>

            <h2><?php esc_html_e('Redes sociales (URLs)', 'horizon-fit-commerce'); ?></h2>
            <table class="form-table">
                <?php
                $field('social_instagram', $s['social']['instagram'] ?? '#', 'Instagram');
                $field('social_facebook', $s['social']['facebook'] ?? '#', 'Facebook');
                $field('social_tiktok', $s['social']['tiktok'] ?? '#', 'TikTok');
                $field('social_spotify', $s['social']['spotify'] ?? '#', 'Spotify');
                ?>
            </table>

            <h2><?php esc_html_e('Pie (copyright + legales)', 'horizon-fit-commerce'); ?></h2>
            <table class="form-table">
                <?php $field('copyright', $s['copyright'], 'Copyright'); ?>
                <?php for ($i = 0; $i < 3; $i++) :
                    $ll = $s['legalLinks'][$i] ?? ['text' => '', 'url' => '#']; ?>
                    <tr><th scope="row"><label><?php echo 'Legal ' . ($i + 1); ?></label></th>
                    <td><input type="text" name="legal_text[]" value="<?php echo esc_attr($ll['text']); ?>" placeholder="Texto" style="width:48%;">
                        <input type="text" name="legal_url[]" value="<?php echo esc_attr($ll['url']); ?>" placeholder="URL" style="width:48%;"></td></tr>
                <?php endfor; ?>
            </table>

            <p class="submit"><button type="submit" name="hf_footer_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar footer', 'horizon-fit-commerce'); ?></button></p>
        </form>
    </div>
    <?php
}
