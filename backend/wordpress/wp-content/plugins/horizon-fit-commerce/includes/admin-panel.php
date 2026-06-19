<?php
/**
 * Panel único "Horizon Fit" — una sola pantalla con pestañas que unifica toda
 * la administración del frontend. NO duplica lógica: reusa las funciones de
 * render/guardado/regeneración que ya existen en los demás includes.
 *
 * Router por ?tab= (Inicio / Menú / Categorías y conjuntos / Precios).
 * La pestaña Inicio tiene sub-navegación por ?sec= (cada sección de la home).
 */

if (!defined('ABSPATH')) {
    exit;
}

// ---- Helpers de navegación ----
function hf_panel_base_url() {
    return admin_url('admin.php?page=hf-panel');
}

function hf_panel_tab_url($tab, $sec = '') {
    $url = add_query_arg('tab', $tab, hf_panel_base_url());
    if ($sec !== '') {
        $url = add_query_arg('sec', $sec, $url);
    }
    return $url;
}

// ---- Render principal (router de pestañas) ----
function hf_panel_render() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }

    $tabs = [
        'inicio'   => __('Inicio de la tienda', 'horizon-fit-commerce'),
        'menu'     => __('Menú de navegación', 'horizon-fit-commerce'),
        'catalogo' => __('Categorías y conjuntos', 'horizon-fit-commerce'),
        'precios'  => __('Productos y precios', 'horizon-fit-commerce'),
    ];
    $current = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'inicio';
    if (!isset($tabs[$current])) {
        $current = 'inicio';
    }
    ?>
    <div class="wrap hf-panel">
        <h1 style="margin-bottom: 4px;"><?php esc_html_e('Horizon Fit', 'horizon-fit-commerce'); ?></h1>
        <p class="description" style="margin-top:0;"><?php esc_html_e('Administrá toda la tienda desde acá.', 'horizon-fit-commerce'); ?></p>

        <h2 class="nav-tab-wrapper" style="margin-bottom: 20px;">
            <?php foreach ($tabs as $slug => $label) :
                $active = ($slug === $current) ? ' nav-tab-active' : ''; ?>
                <a href="<?php echo esc_url(hf_panel_tab_url($slug)); ?>" class="nav-tab<?php echo esc_attr($active); ?>"><?php echo esc_html($label); ?></a>
            <?php endforeach; ?>
        </h2>

        <div class="hf-panel__body">
            <?php
            switch ($current) {
                case 'menu':
                    hf_panel_tab_menu();
                    break;
                case 'catalogo':
                    hf_panel_tab_catalogo();
                    break;
                case 'precios':
                    hf_panel_tab_precios();
                    break;
                case 'inicio':
                default:
                    hf_panel_tab_inicio();
                    break;
            }
            ?>
        </div>
    </div>
    <?php
}

// ---- Pestaña: Inicio de la tienda (secciones de la home) ----
function hf_panel_tab_inicio() {
    // Cada entrada: slug => [label, callback de render existente].
    // El callback es auto-contenido (maneja su propio POST + nonce + guardado).
    // Orden visual aproximado de la home (de arriba hacia abajo).
    $sections = [
        'hero'   => [__('Hero (video principal)', 'horizon-fit-commerce'), 'hf_panel_render_hero'],
        'marquee'=> [__('Marquee (cinta)', 'horizon-fit-commerce'), 'hf_panel_render_marquee'],
        'style'  => [__('Elegí tu estilo', 'horizon-fit-commerce'), 'hf_commerce_render_style_edit_settings_page'],
        'social' => [__('#HorizonFit (redes)', 'horizon-fit-commerce'), 'hf_commerce_render_social_strip_settings_page'],
        'trust'  => [__('Barra de confianza', 'horizon-fit-commerce'), 'hf_commerce_render_trust_settings_page'],
        'footer' => [__('Footer', 'horizon-fit-commerce'), 'hf_commerce_render_footer_settings_page'],
    ];

    $current_sec = isset($_GET['sec']) ? sanitize_key($_GET['sec']) : 'hero';
    if (!isset($sections[$current_sec])) {
        $current_sec = 'hero';
    }
    ?>
    <div class="hf-panel-sub" style="display:flex; gap:24px; align-items:flex-start;">
        <!-- Sub-navegación lateral de secciones -->
        <ul class="hf-panel-subnav" style="flex:0 0 200px; margin:0; padding:0; list-style:none; border:1px solid #dcdcde; border-radius:6px; overflow:hidden;">
            <?php foreach ($sections as $slug => $data) :
                $active = ($slug === $current_sec);
                $style = 'display:block; padding:10px 14px; text-decoration:none; border-bottom:1px solid #f0f0f1;'
                    . ($active ? ' background:#2271b1; color:#fff; font-weight:600;' : ' color:#2c3338;'); ?>
                <li>
                    <a href="<?php echo esc_url(hf_panel_tab_url('inicio', $slug)); ?>" style="<?php echo esc_attr($style); ?>"><?php echo esc_html($data[0]); ?></a>
                </li>
            <?php endforeach; ?>
        </ul>

        <!-- Render de la sección activa (reusa la función existente) -->
        <div class="hf-panel-seccontent" style="flex:1 1 auto; min-width:0;">
            <?php
            $callback = $sections[$current_sec][1];
            if (is_callable($callback)) {
                call_user_func($callback);
            } else {
                echo '<p>' . esc_html__('Sección no disponible.', 'horizon-fit-commerce') . '</p>';
            }
            ?>
        </div>
    </div>
    <?php
}

// ---- Pestaña: Productos y precios (sub-nav que reusa páginas existentes) ----
function hf_panel_tab_precios() {
    $secs = [
        'precios'   => [__('Precios', 'horizon-fit-commerce'), 'hf_commerce_render_pricing_page'],
        'coleccion' => [__('Columnas de colección', 'horizon-fit-commerce'), 'hf_commerce_render_collection_settings_page'],
        'importar'  => [__('Importar catálogo', 'horizon-fit-commerce'), 'hf_commerce_render_seed_page'],
    ];
    $current = isset($_GET['sec']) ? sanitize_key($_GET['sec']) : 'precios';
    if (!isset($secs[$current])) {
        $current = 'precios';
    }
    ?>
    <div class="hf-panel-sub" style="display:flex; gap:24px; align-items:flex-start;">
        <ul class="hf-panel-subnav" style="flex:0 0 200px; margin:0; padding:0; list-style:none; border:1px solid #dcdcde; border-radius:6px; overflow:hidden;">
            <?php foreach ($secs as $slug => $data) :
                $active = ($slug === $current);
                $style = 'display:block; padding:10px 14px; text-decoration:none; border-bottom:1px solid #f0f0f1;'
                    . ($active ? ' background:#2271b1; color:#fff; font-weight:600;' : ' color:#2c3338;'); ?>
                <li><a href="<?php echo esc_url(hf_panel_tab_url('precios', $slug)); ?>" style="<?php echo esc_attr($style); ?>"><?php echo esc_html($data[0]); ?></a></li>
            <?php endforeach; ?>
        </ul>
        <div class="hf-panel-seccontent" style="flex:1 1 auto; min-width:0;">
            <?php
            $callback = $secs[$current][1];
            if (is_callable($callback)) {
                call_user_func($callback);
            } else {
                echo '<p>' . esc_html__('Módulo no disponible.', 'horizon-fit-commerce') . '</p>';
            }
            ?>
        </div>
    </div>
    <?php
}

// ---- Helpers genéricos para secciones hf_page_section por tipo ----
function hf_panel_section_id_by_type($type) {
    $sections = get_posts([
        'post_type'   => 'hf_page_section',
        'meta_key'    => '_hf_section_type',
        'meta_value'  => $type,
        'numberposts' => 1,
        'fields'      => 'ids',
    ]);
    return !empty($sections) ? (int) $sections[0] : 0;
}

function hf_panel_section_settings($type) {
    $id = hf_panel_section_id_by_type($type);
    if (!$id) {
        return [];
    }
    $raw = get_post_meta($id, '_hf_section_settings', true);
    $decoded = (is_string($raw) && $raw !== '') ? json_decode($raw, true) : [];
    return is_array($decoded) ? $decoded : [];
}

// ---- Render: Marquee (banner superior) ----
function hf_panel_render_marquee() {
    $saved = false;
    if (!empty($_POST['hf_marquee_panel_submit'])) {
        check_admin_referer('hf_marquee_panel_action');
        $msgs = array_map('sanitize_text_field', (array) wp_unslash($_POST['marquee_msg'] ?? []));
        $msgs = array_values(array_filter($msgs, function ($m) { return trim($m) !== ''; }));
        $id = hf_panel_section_id_by_type('marquee');
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode(['messages' => $msgs], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }
            $saved = true;
        }
    }

    $s = hf_panel_section_settings('marquee');
    $messages = !empty($s['messages']) && is_array($s['messages']) ? $s['messages'] : [];
    $slots = max(6, count($messages)); // al menos 6 espacios
    ?>
    <h1><?php esc_html_e('Marquee (banner superior)', 'horizon-fit-commerce'); ?></h1>
    <?php if ($saved) : ?>
        <div class="notice notice-success"><p><?php esc_html_e('Marquee guardado.', 'horizon-fit-commerce'); ?></p></div>
    <?php endif; ?>
    <p class="description"><?php esc_html_e('Los mensajes que pasan en la cinta superior del sitio. Dejá en blanco los que no uses.', 'horizon-fit-commerce'); ?></p>
    <form method="post">
        <?php wp_nonce_field('hf_marquee_panel_action'); ?>
        <table class="form-table">
            <?php for ($i = 0; $i < $slots; $i++) :
                $val = $messages[$i] ?? ''; ?>
                <tr>
                    <th scope="row"><label><?php echo 'Mensaje ' . ($i + 1); ?></label></th>
                    <td><input type="text" name="marquee_msg[]" value="<?php echo esc_attr($val); ?>" placeholder="<?php esc_attr_e('Texto del mensaje', 'horizon-fit-commerce'); ?>" style="width:100%;max-width:520px;"></td>
                </tr>
            <?php endfor; ?>
        </table>
        <p class="submit"><button type="submit" name="hf_marquee_panel_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar', 'horizon-fit-commerce'); ?></button></p>
    </form>
    <?php
}

// ---- Render: Hero (video principal de la home) ----
function hf_panel_render_hero() {
    $saved = false;
    if (!empty($_POST['hf_hero_panel_submit'])) {
        check_admin_referer('hf_hero_panel_action');
        $p = wp_unslash($_POST);
        $fields = [
            'videoDesktop' => esc_url_raw($p['hero_video_desktop'] ?? ''),
            'videoMobile'  => esc_url_raw($p['hero_video_mobile'] ?? ''),
            'poster'       => esc_url_raw($p['hero_poster'] ?? ''),
            'posterMobile' => esc_url_raw($p['hero_poster_mobile'] ?? ''),
        ];
        // Guardar solo los que tienen valor: así un campo vacío NO pisa el
        // fallback de home.json con cadena vacía.
        $settings = array_filter($fields, function ($v) { return $v !== ''; });
        $id = hf_panel_section_id_by_type('hero');
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }
            $saved = true;
        }
    }

    $s = hf_panel_section_settings('hero');
    $rows = [
        ['hero_video_desktop', __('Video desktop', 'horizon-fit-commerce'), 'videoDesktop', 'video'],
        ['hero_video_mobile',  __('Video mobile', 'horizon-fit-commerce'),  'videoMobile',  'video'],
        ['hero_poster',        __('Poster desktop (imagen)', 'horizon-fit-commerce'), 'poster', 'image'],
        ['hero_poster_mobile', __('Poster mobile (imagen)', 'horizon-fit-commerce'),  'posterMobile', 'image'],
    ];
    ?>
    <h1><?php esc_html_e('Hero (video principal)', 'horizon-fit-commerce'); ?></h1>
    <?php if ($saved) : ?>
        <div class="notice notice-success"><p><?php esc_html_e('Hero guardado.', 'horizon-fit-commerce'); ?></p></div>
    <?php endif; ?>
    <p class="description"><?php esc_html_e('El video grande que abre la home. Podés definir versión desktop y mobile, con su imagen de respaldo (poster).', 'horizon-fit-commerce'); ?></p>
    <form method="post">
        <?php wp_nonce_field('hf_hero_panel_action'); ?>
        <table class="form-table">
            <?php foreach ($rows as $row) :
                list($name, $label, $key, $type) = $row;
                $val = $s[$key] ?? ''; ?>
                <tr>
                    <th scope="row"><label for="<?php echo esc_attr($name); ?>"><?php echo esc_html($label); ?></label></th>
                    <td>
                        <input type="text" name="<?php echo esc_attr($name); ?>" id="<?php echo esc_attr($name); ?>" value="<?php echo esc_attr($val); ?>" placeholder="<?php echo $type === 'video' ? 'URL del video (.mp4)' : 'URL de la imagen'; ?>" style="width:100%;max-width:420px;">
                        <button class="button" type="button" data-hf-media-url data-hf-media-url-type="<?php echo esc_attr($type); ?>" data-hf-target="#<?php echo esc_attr($name); ?>" data-hf-preview=".hf-hero-preview-<?php echo esc_attr($name); ?>"><?php echo $type === 'video' ? esc_html__('Elegir video', 'horizon-fit-commerce') : esc_html__('Elegir imagen', 'horizon-fit-commerce'); ?></button>
                        <span class="hf-hero-preview-<?php echo esc_attr($name); ?>" style="display:inline-block;vertical-align:middle;margin-left:8px;"><?php if ($val) : ?><?php if ($type === 'video') : ?><video src="<?php echo esc_url($val); ?>" muted loop style="max-width:140px;border-radius:6px;"></video><?php else : ?><img src="<?php echo esc_url($val); ?>" alt="" style="max-width:140px;border-radius:6px;"><?php endif; ?><?php endif; ?></span>
                    </td>
                </tr>
            <?php endforeach; ?>
        </table>
        <p class="submit"><button type="submit" name="hf_hero_panel_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar', 'horizon-fit-commerce'); ?></button></p>
    </form>
    <?php
}

// ---- Pestaña: Menú de navegación ----
// Administra los links del navbar = items genéricos (CPT hf_menu_item) +
// categorías marcadas "Mostrar en menú". Reusa la MISMA estructura de datos y
// hf_regenerate_menu_cache(). No rompe nada existente.
function hf_panel_tab_menu() {
    $saved = false;
    if (!empty($_POST['hf_menu_panel_submit'])) {
        check_admin_referer('hf_menu_panel_action');
        $p = wp_unslash($_POST);

        // 1) Items existentes: actualizar o borrar.
        $item_ids = array_map('intval', (array) ($p['item_id'] ?? []));
        foreach ($item_ids as $id) {
            if (!$id) {
                continue;
            }
            if (!empty($p['item_delete'][$id])) {
                wp_delete_post($id, true);
                continue;
            }
            $title = sanitize_text_field($p['item_title'][$id] ?? '');
            if ($title !== '') {
                wp_update_post(['ID' => $id, 'post_title' => $title]);
            }
            update_post_meta($id, '_hf_menu_link', sanitize_text_field($p['item_link'][$id] ?? ''));
            update_post_meta($id, '_hf_menu_order', (int) ($p['item_order'][$id] ?? 0));
            update_post_meta($id, '_hf_menu_visible', !empty($p['item_visible'][$id]) ? '1' : '0');
        }

        // 2) Nuevo item (si se completó el título).
        $new_title = sanitize_text_field($p['new_item_title'] ?? '');
        if ($new_title !== '') {
            $new_id = wp_insert_post([
                'post_type'   => 'hf_menu_item',
                'post_status' => 'publish',
                'post_title'  => $new_title,
            ]);
            if ($new_id && !is_wp_error($new_id)) {
                update_post_meta($new_id, '_hf_menu_link', sanitize_text_field($p['new_item_link'] ?? ''));
                update_post_meta($new_id, '_hf_menu_order', (int) ($p['new_item_order'] ?? 0));
                update_post_meta($new_id, '_hf_menu_visible', '1');
            }
        }

        // 3) Categorías en el menú: flag + orden.
        $cat_ids = array_map('intval', (array) ($p['cat_id'] ?? []));
        foreach ($cat_ids as $term_id) {
            if (!$term_id) {
                continue;
            }
            update_term_meta($term_id, 'hf_show_in_nav', !empty($p['cat_in_nav'][$term_id]) ? '1' : '0');
            update_term_meta($term_id, 'hf_nav_order', (int) ($p['cat_nav_order'][$term_id] ?? 0));
        }

        if (function_exists('hf_regenerate_menu_cache')) {
            hf_regenerate_menu_cache();
        }
        $saved = true;
    }

    // Datos para pintar.
    $items = get_posts([
        'post_type'   => 'hf_menu_item',
        'numberposts' => -1,
        'orderby'     => 'meta_value_num',
        'meta_key'    => '_hf_menu_order',
        'order'       => 'ASC',
    ]);
    $cats = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
    ?>
    <?php if ($saved) : ?>
        <div class="notice notice-success"><p><?php esc_html_e('Menú guardado.', 'horizon-fit-commerce'); ?></p></div>
    <?php endif; ?>
    <p class="description"><?php esc_html_e('Los links que aparecen en el menú de navegación del sitio. Combina links propios (arriba) y tus categorías de productos (abajo). Ordenan todos juntos por el número de orden.', 'horizon-fit-commerce'); ?></p>

    <form method="post">
        <?php wp_nonce_field('hf_menu_panel_action'); ?>

        <h2><?php esc_html_e('Links propios', 'horizon-fit-commerce'); ?></h2>
        <table class="widefat striped" style="max-width:900px;">
            <thead>
                <tr>
                    <th><?php esc_html_e('Texto', 'horizon-fit-commerce'); ?></th>
                    <th><?php esc_html_e('Link', 'horizon-fit-commerce'); ?></th>
                    <th style="width:80px;"><?php esc_html_e('Orden', 'horizon-fit-commerce'); ?></th>
                    <th style="width:70px;"><?php esc_html_e('Visible', 'horizon-fit-commerce'); ?></th>
                    <th style="width:70px;"><?php esc_html_e('Borrar', 'horizon-fit-commerce'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($items as $item) :
                    $link    = (string) get_post_meta($item->ID, '_hf_menu_link', true);
                    $order   = (int) get_post_meta($item->ID, '_hf_menu_order', true);
                    $visible = get_post_meta($item->ID, '_hf_menu_visible', true) !== '0'; ?>
                    <tr>
                        <td>
                            <input type="hidden" name="item_id[]" value="<?php echo esc_attr($item->ID); ?>">
                            <input type="text" name="item_title[<?php echo esc_attr($item->ID); ?>]" value="<?php echo esc_attr($item->post_title); ?>" style="width:100%;">
                        </td>
                        <td><input type="text" name="item_link[<?php echo esc_attr($item->ID); ?>]" value="<?php echo esc_attr($link); ?>" placeholder="https://... o #footerContact" style="width:100%;"></td>
                        <td><input type="number" name="item_order[<?php echo esc_attr($item->ID); ?>]" value="<?php echo esc_attr($order); ?>" style="width:70px;"></td>
                        <td style="text-align:center;"><input type="checkbox" name="item_visible[<?php echo esc_attr($item->ID); ?>]" value="1" <?php checked($visible); ?>></td>
                        <td style="text-align:center;"><input type="checkbox" name="item_delete[<?php echo esc_attr($item->ID); ?>]" value="1"></td>
                    </tr>
                <?php endforeach; ?>
                <!-- Fila para nuevo item -->
                <tr style="background:#f6f7f7;">
                    <td><input type="text" name="new_item_title" value="" placeholder="<?php esc_attr_e('+ Nuevo link (texto)', 'horizon-fit-commerce'); ?>" style="width:100%;"></td>
                    <td><input type="text" name="new_item_link" value="" placeholder="https://... o #footerContact" style="width:100%;"></td>
                    <td><input type="number" name="new_item_order" value="0" style="width:70px;"></td>
                    <td colspan="2" style="color:#646970;"><?php esc_html_e('(se crea al guardar)', 'horizon-fit-commerce'); ?></td>
                </tr>
            </tbody>
        </table>

        <h2 style="margin-top:28px;"><?php esc_html_e('Categorías en el menú', 'horizon-fit-commerce'); ?></h2>
        <table class="widefat striped" style="max-width:600px;">
            <thead>
                <tr>
                    <th><?php esc_html_e('Categoría', 'horizon-fit-commerce'); ?></th>
                    <th style="width:120px;"><?php esc_html_e('Mostrar en menú', 'horizon-fit-commerce'); ?></th>
                    <th style="width:80px;"><?php esc_html_e('Orden', 'horizon-fit-commerce'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php if (!is_wp_error($cats)) : foreach ($cats as $cat) :
                    $in_nav = get_term_meta($cat->term_id, 'hf_show_in_nav', true) === '1';
                    $nav_order = (int) get_term_meta($cat->term_id, 'hf_nav_order', true); ?>
                    <tr>
                        <td>
                            <input type="hidden" name="cat_id[]" value="<?php echo esc_attr($cat->term_id); ?>">
                            <?php echo esc_html($cat->name); ?>
                        </td>
                        <td style="text-align:center;"><input type="checkbox" name="cat_in_nav[<?php echo esc_attr($cat->term_id); ?>]" value="1" <?php checked($in_nav); ?>></td>
                        <td><input type="number" name="cat_nav_order[<?php echo esc_attr($cat->term_id); ?>]" value="<?php echo esc_attr($nav_order); ?>" style="width:70px;"></td>
                    </tr>
                <?php endforeach; endif; ?>
            </tbody>
        </table>

        <p class="submit"><button type="submit" name="hf_menu_panel_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar menú', 'horizon-fit-commerce'); ?></button></p>
    </form>
    <?php
}

// ---- Pestaña: Categorías y conjuntos ----
// Administra los flags de "mostrar en home" (orden, copy, imagen) de las
// categorías (product_cat → thumbnail_id) y conjuntos (hf_collection →
// hf_image_id). Reusa la term meta existente y las regeneraciones de cache.
function hf_panel_tab_catalogo() {
    $saved = false;
    if (!empty($_POST['hf_catalogo_panel_submit'])) {
        check_admin_referer('hf_catalogo_panel_action');
        $p = wp_unslash($_POST);

        // Categorías (product_cat).
        foreach (array_map('intval', (array) ($p['cat_id'] ?? [])) as $tid) {
            if (!$tid) { continue; }
            update_term_meta($tid, 'hf_featured_home', !empty($p['cat_featured'][$tid]) ? '1' : '0');
            update_term_meta($tid, 'hf_home_order', (int) ($p['cat_order'][$tid] ?? 0));
            update_term_meta($tid, 'hf_card_copy', sanitize_text_field($p['cat_copy'][$tid] ?? ''));
            if (isset($p['cat_image'][$tid]) && $p['cat_image'][$tid] !== '') {
                update_term_meta($tid, 'thumbnail_id', (int) $p['cat_image'][$tid]);
            }
        }

        // Conjuntos (hf_collection).
        foreach (array_map('intval', (array) ($p['coll_id'] ?? [])) as $tid) {
            if (!$tid) { continue; }
            update_term_meta($tid, 'hf_featured_home', !empty($p['coll_featured'][$tid]) ? '1' : '0');
            update_term_meta($tid, 'hf_home_order', (int) ($p['coll_order'][$tid] ?? 0));
            update_term_meta($tid, 'hf_card_copy', sanitize_text_field($p['coll_copy'][$tid] ?? ''));
            if (isset($p['coll_image'][$tid]) && $p['coll_image'][$tid] !== '') {
                update_term_meta($tid, 'hf_image_id', (int) $p['coll_image'][$tid]);
            }
            if (isset($p['coll_image_mobile'][$tid]) && $p['coll_image_mobile'][$tid] !== '') {
                update_term_meta($tid, 'hf_image_mobile_id', (int) $p['coll_image_mobile'][$tid]);
            }
        }

        // Regenerar las caches que dependen de estos datos.
        foreach (['hf_regenerate_featured_categories_cache', 'hf_regenerate_featured_sets_cache'] as $fn) {
            if (function_exists($fn)) { $fn(); }
        }
        $saved = true;
    }

    $cats  = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
    $colls = get_terms(['taxonomy' => 'hf_collection', 'hide_empty' => false]);
    ?>
    <?php if ($saved) : ?>
        <div class="notice notice-success"><p><?php esc_html_e('Guardado.', 'horizon-fit-commerce'); ?></p></div>
    <?php endif; ?>
    <p class="description"><?php esc_html_e('Configurá qué categorías y conjuntos aparecen en la home, con su imagen, orden y descripción.', 'horizon-fit-commerce'); ?></p>

    <form method="post">
        <?php wp_nonce_field('hf_catalogo_panel_action'); ?>

        <?php
        // Celda de imagen reutilizable (con preview + botón de la biblioteca).
        $image_cell = function ($prefix, $field, $tid, $meta_key) {
            $img_id  = (int) get_term_meta($tid, $meta_key, true);
            $img_url = $img_id ? wp_get_attachment_image_url($img_id, 'thumbnail') : '';
            $input_id = $prefix . '_' . $field . '_' . $tid;
            $preview_cls = $prefix . '-' . $field . '-preview-' . $tid;
            ?>
            <input type="hidden" name="<?php echo esc_attr($prefix . '_' . $field); ?>[<?php echo esc_attr($tid); ?>]" id="<?php echo esc_attr($input_id); ?>" value="<?php echo esc_attr($img_id); ?>">
            <span class="<?php echo esc_attr($preview_cls); ?>" style="display:inline-block;vertical-align:middle;margin-right:6px;"><?php if ($img_url) : ?><img src="<?php echo esc_url($img_url); ?>" alt="" style="max-width:48px;border-radius:4px;vertical-align:middle;"><?php endif; ?></span>
            <button class="button button-small" type="button" data-hf-media-open data-hf-target="#<?php echo esc_attr($input_id); ?>" data-hf-preview=".<?php echo esc_attr($preview_cls); ?>"><?php esc_html_e('Imagen', 'horizon-fit-commerce'); ?></button>
            <?php
        };

        // Helper de fila reutilizable. $image_mobile_meta opcional: si se pasa,
        // agrega una segunda columna de imagen (para conjuntos: desktop + mobile).
        $render_rows = function ($terms, $prefix, $image_meta, $image_mobile_meta = null) use ($image_cell) {
            $cols = $image_mobile_meta ? 6 : 5;
            if (is_wp_error($terms) || empty($terms)) {
                echo '<tr><td colspan="' . (int) $cols . '">' . esc_html__('No hay elementos.', 'horizon-fit-commerce') . '</td></tr>';
                return;
            }
            foreach ($terms as $t) {
                $featured = get_term_meta($t->term_id, 'hf_featured_home', true) === '1';
                $order    = (int) get_term_meta($t->term_id, 'hf_home_order', true);
                $copy     = (string) get_term_meta($t->term_id, 'hf_card_copy', true);
                $tid = $t->term_id;
                ?>
                <tr>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($prefix); ?>_id[]" value="<?php echo esc_attr($tid); ?>">
                        <strong><?php echo esc_html($t->name); ?></strong>
                    </td>
                    <td style="text-align:center;"><input type="checkbox" name="<?php echo esc_attr($prefix); ?>_featured[<?php echo esc_attr($tid); ?>]" value="1" <?php checked($featured); ?>></td>
                    <td><input type="number" name="<?php echo esc_attr($prefix); ?>_order[<?php echo esc_attr($tid); ?>]" value="<?php echo esc_attr($order); ?>" style="width:70px;"></td>
                    <td><input type="text" name="<?php echo esc_attr($prefix); ?>_copy[<?php echo esc_attr($tid); ?>]" value="<?php echo esc_attr($copy); ?>" placeholder="<?php esc_attr_e('Descripción corta', 'horizon-fit-commerce'); ?>" style="width:100%;min-width:180px;"></td>
                    <td><?php $image_cell($prefix, 'image', $tid, $image_meta); ?></td>
                    <?php if ($image_mobile_meta) : ?>
                    <td><?php $image_cell($prefix, 'image_mobile', $tid, $image_mobile_meta); ?></td>
                    <?php endif; ?>
                </tr>
                <?php
            }
        };
        ?>

        <h2><?php esc_html_e('Categorías', 'horizon-fit-commerce'); ?></h2>
        <table class="widefat striped" style="max-width:1000px;">
            <thead><tr>
                <th><?php esc_html_e('Categoría', 'horizon-fit-commerce'); ?></th>
                <th style="width:110px;"><?php esc_html_e('En home', 'horizon-fit-commerce'); ?></th>
                <th style="width:80px;"><?php esc_html_e('Orden', 'horizon-fit-commerce'); ?></th>
                <th><?php esc_html_e('Descripción', 'horizon-fit-commerce'); ?></th>
                <th style="width:160px;"><?php esc_html_e('Imagen', 'horizon-fit-commerce'); ?></th>
            </tr></thead>
            <tbody><?php $render_rows($cats, 'cat', 'thumbnail_id'); ?></tbody>
        </table>

        <h2 style="margin-top:28px;"><?php esc_html_e('Conjuntos', 'horizon-fit-commerce'); ?></h2>
        <p class="description"><?php esc_html_e('Los conjuntos usan una imagen apaisada en desktop y una vertical en mobile. Cargá cada una.', 'horizon-fit-commerce'); ?></p>
        <table class="widefat striped" style="max-width:1100px;">
            <thead><tr>
                <th><?php esc_html_e('Conjunto', 'horizon-fit-commerce'); ?></th>
                <th style="width:110px;"><?php esc_html_e('En home', 'horizon-fit-commerce'); ?></th>
                <th style="width:80px;"><?php esc_html_e('Orden', 'horizon-fit-commerce'); ?></th>
                <th><?php esc_html_e('Descripción', 'horizon-fit-commerce'); ?></th>
                <th style="width:160px;"><?php esc_html_e('Imagen desktop', 'horizon-fit-commerce'); ?></th>
                <th style="width:160px;"><?php esc_html_e('Imagen mobile', 'horizon-fit-commerce'); ?></th>
            </tr></thead>
            <tbody><?php $render_rows($colls, 'coll', 'hf_image_id', 'hf_image_mobile_id'); ?></tbody>
        </table>

        <p class="submit"><button type="submit" name="hf_catalogo_panel_submit" value="1" class="button button-primary"><?php esc_html_e('Guardar', 'horizon-fit-commerce'); ?></button></p>
    </form>
    <?php
}
