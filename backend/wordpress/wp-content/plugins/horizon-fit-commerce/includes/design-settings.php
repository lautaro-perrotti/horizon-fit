<?php
/**
 * Editor seguro del sistema visual de Horizon Fit.
 *
 * Los valores se guardan como JSON en una hf_page_section de tipo
 * "design-system" y viajan dentro de home-sections.json, igual que el resto
 * de los ajustes de la home. Los campos vacíos siempre significan heredar el
 * CSS existente, por lo que activar este módulo no modifica el sitio.
 */

if (!defined('ABSPATH')) {
    exit;
}

function hf_design_settings_components() {
    return [
        'marquee'                    => __('Marquee', 'horizon-fit-commerce'),
        'navbar'                     => __('Navegación', 'horizon-fit-commerce'),
        'hero'                       => __('Hero', 'horizon-fit-commerce'),
        'featured-products'          => __('Productos destacados · Fila 1', 'horizon-fit-commerce'),
        'featured-products-2'        => __('Productos destacados · Fila 2', 'horizon-fit-commerce'),
        'featured-sets-desktop'      => __('Conjuntos destacados · Desktop', 'horizon-fit-commerce'),
        'featured-sets-mobile'       => __('Conjuntos destacados · Mobile', 'horizon-fit-commerce'),
        'categorias'                 => __('Compra por categoría', 'horizon-fit-commerce'),
        'trust-bar'                  => __('Barra de confianza', 'horizon-fit-commerce'),
        'style-edit'                 => __('Elegí tu estilo', 'horizon-fit-commerce'),
        'featured-products-style-1'  => __('Tendencias · Fila 1', 'horizon-fit-commerce'),
        'featured-products-style-2'  => __('Tendencias · Fila 2', 'horizon-fit-commerce'),
        'social-strip'               => __('Redes sociales', 'horizon-fit-commerce'),
        'footer'                     => __('Footer', 'horizon-fit-commerce'),
        'whatsapp-float'             => __('Botón flotante de WhatsApp', 'horizon-fit-commerce'),
        'product-detail'             => __('Página de producto', 'horizon-fit-commerce'),
        'collection'                 => __('Página de colección', 'horizon-fit-commerce'),
        'checkout'                   => __('Checkout', 'horizon-fit-commerce'),
        'info-page'                  => __('Páginas informativas', 'horizon-fit-commerce'),
        'account'                    => __('Mi cuenta', 'horizon-fit-commerce'),
        'lost-password'              => __('Recuperar contraseña', 'horizon-fit-commerce'),
    ];
}

function hf_design_settings_global_fields() {
    return [
        'fontBody'       => ['label' => __('Fuente general', 'horizon-fit-commerce'), 'type' => 'font', 'placeholder' => 'Arial, sans-serif'],
        'fontHeading'    => ['label' => __('Fuente de títulos', 'horizon-fit-commerce'), 'type' => 'font', 'placeholder' => 'Arial, sans-serif'],
        'fontButton'     => ['label' => __('Fuente de botones', 'horizon-fit-commerce'), 'type' => 'font', 'placeholder' => 'Arial, sans-serif'],
        'fontPrice'      => ['label' => __('Fuente de precios', 'horizon-fit-commerce'), 'type' => 'font', 'placeholder' => 'Arial, sans-serif'],
        'fontStylesheetUrl' => ['label' => __('URL CSS de la fuente (opcional)', 'horizon-fit-commerce'), 'type' => 'url', 'placeholder' => 'https://fonts.googleapis.com/css2?family=...'],
        'baseFontSize'   => ['label' => __('Tamaño de texto base', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 10, 'max' => 28, 'unit' => 'px'],
        'colorText'      => ['label' => __('Color de texto', 'horizon-fit-commerce'), 'type' => 'color'],
        'colorHeading'   => ['label' => __('Color de títulos', 'horizon-fit-commerce'), 'type' => 'color'],
        'colorPrimary'   => ['label' => __('Color principal', 'horizon-fit-commerce'), 'type' => 'color'],
        'colorBackground'=> ['label' => __('Fondo general', 'horizon-fit-commerce'), 'type' => 'color'],
        'colorSurface'   => ['label' => __('Fondo de componentes', 'horizon-fit-commerce'), 'type' => 'color'],
        'colorMuted'     => ['label' => __('Color de texto secundario', 'horizon-fit-commerce'), 'type' => 'color'],
        'colorBorder'    => ['label' => __('Color de bordes', 'horizon-fit-commerce'), 'type' => 'color'],
        'containerWidth' => ['label' => __('Ancho máximo del contenido', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 720, 'max' => 1920, 'unit' => 'px'],
        'sectionPaddingY'=> ['label' => __('Padding vertical de secciones', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 400, 'unit' => 'px'],
        'sectionPaddingX'=> ['label' => __('Padding horizontal de secciones', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 240, 'unit' => 'px'],
        'sectionMarginY' => ['label' => __('Margen vertical de secciones', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 400, 'unit' => 'px'],
        'componentGap'   => ['label' => __('Separación interna predeterminada', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 160, 'unit' => 'px'],
        'cardRadius'     => ['label' => __('Radio de tarjetas', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 80, 'unit' => 'px'],
        'buttonRadius'   => ['label' => __('Radio de botones', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 999, 'unit' => 'px'],
    ];
}

function hf_design_settings_component_fields() {
    return [
        'fontFamily'      => ['label' => __('Fuente', 'horizon-fit-commerce'), 'type' => 'font', 'placeholder' => __('Heredar', 'horizon-fit-commerce')],
        'titleFontSize'   => ['label' => __('Tamaño de títulos', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 10, 'max' => 120, 'unit' => 'px'],
        'titleFontWeight' => ['label' => __('Peso de títulos', 'horizon-fit-commerce'), 'type' => 'weight'],
        'textFontSize'    => ['label' => __('Tamaño de texto', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 8, 'max' => 40, 'unit' => 'px'],
        'textFontWeight'  => ['label' => __('Peso de texto', 'horizon-fit-commerce'), 'type' => 'weight'],
        'titleColor'      => ['label' => __('Color de títulos', 'horizon-fit-commerce'), 'type' => 'color'],
        'textColor'       => ['label' => __('Color de texto', 'horizon-fit-commerce'), 'type' => 'color'],
        'backgroundColor' => ['label' => __('Color de fondo', 'horizon-fit-commerce'), 'type' => 'color'],
        'marginTop'       => ['label' => __('Margen superior', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 400, 'unit' => 'px'],
        'marginBottom'    => ['label' => __('Margen inferior', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 400, 'unit' => 'px'],
        'paddingTop'      => ['label' => __('Padding superior', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 400, 'unit' => 'px'],
        'paddingRight'    => ['label' => __('Padding derecho', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 240, 'unit' => 'px'],
        'paddingBottom'   => ['label' => __('Padding inferior', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 400, 'unit' => 'px'],
        'paddingLeft'     => ['label' => __('Padding izquierdo', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 240, 'unit' => 'px'],
        'gap'             => ['label' => __('Separación interna', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 160, 'unit' => 'px'],
        'borderRadius'    => ['label' => __('Radio de tarjetas', 'horizon-fit-commerce'), 'type' => 'number', 'min' => 0, 'max' => 100, 'unit' => 'px'],
        'textAlign'       => ['label' => __('Alineación', 'horizon-fit-commerce'), 'type' => 'align'],
    ];
}

function hf_design_settings_empty() {
    return ['global' => [], 'components' => []];
}

function hf_design_settings_section_id() {
    $sections = get_posts([
        'post_type'   => 'hf_page_section',
        'meta_key'    => '_hf_section_type',
        'meta_value'  => 'design-system',
        'numberposts' => 1,
        'fields'      => 'ids',
    ]);
    return !empty($sections) ? (int) $sections[0] : 0;
}

function hf_design_settings_ensure_section() {
    $id = hf_design_settings_section_id();
    if ($id) {
        return $id;
    }

    $home = get_posts(['post_type' => 'hf_page', 'name' => 'home', 'numberposts' => 1, 'fields' => 'ids']);
    $page_id = !empty($home) ? (int) $home[0] : 0;
    $id = wp_insert_post([
        'post_type'   => 'hf_page_section',
        'post_status' => 'publish',
        'post_title'  => 'Sistema de diseño',
    ]);
    if (!$id || is_wp_error($id)) {
        return 0;
    }

    update_post_meta($id, '_hf_section_type', 'design-system');
    update_post_meta($id, '_hf_page_id', $page_id);
    update_post_meta($id, '_hf_section_order', 0);
    update_post_meta($id, '_hf_section_visible', 1);
    update_post_meta($id, '_hf_section_settings', wp_json_encode(hf_design_settings_empty()));
    return (int) $id;
}
add_action('init', 'hf_design_settings_ensure_section', 20);

function hf_design_settings_get() {
    $id = hf_design_settings_section_id();
    if (!$id) {
        return hf_design_settings_empty();
    }
    $decoded = json_decode((string) get_post_meta($id, '_hf_section_settings', true), true);
    if (!is_array($decoded)) {
        return hf_design_settings_empty();
    }
    return [
        'global'     => isset($decoded['global']) && is_array($decoded['global']) ? $decoded['global'] : [],
        'components' => isset($decoded['components']) && is_array($decoded['components']) ? $decoded['components'] : [],
    ];
}

function hf_design_sanitize_font($value) {
    $value = sanitize_text_field((string) $value);
    return preg_replace('/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s,._\-"\'()]/u', '', $value);
}

function hf_design_sanitize_field($value, $definition) {
    $value = is_scalar($value) ? trim((string) $value) : '';
    if ($value === '') {
        return '';
    }
    $type = $definition['type'] ?? 'text';
    if ($type === 'color') {
        return sanitize_hex_color($value) ?: '';
    }
    if ($type === 'font') {
        return hf_design_sanitize_font($value);
    }
    if ($type === 'url') {
        $url = esc_url_raw($value, ['http', 'https']);
        return $url ?: '';
    }
    if ($type === 'weight') {
        $allowed = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
        return in_array($value, $allowed, true) ? $value : '';
    }
    if ($type === 'align') {
        return in_array($value, ['left', 'center', 'right'], true) ? $value : '';
    }
    if ($type === 'number') {
        if (!is_numeric($value)) {
            return '';
        }
        $number = (float) $value;
        $number = max((float) ($definition['min'] ?? 0), min((float) ($definition['max'] ?? 9999), $number));
        return (string) ($number == (int) $number ? (int) $number : $number);
    }
    return sanitize_text_field($value);
}

function hf_design_settings_sanitize($input) {
    $input = is_array($input) ? $input : [];
    $output = hf_design_settings_empty();

    foreach (hf_design_settings_global_fields() as $key => $definition) {
        $value = hf_design_sanitize_field($input['global'][$key] ?? '', $definition);
        if ($value !== '') {
            $output['global'][$key] = $value;
        }
    }

    $component_fields = hf_design_settings_component_fields();
    foreach (hf_design_settings_components() as $component_id => $label) {
        foreach (['desktop', 'tablet', 'mobile'] as $breakpoint) {
            $clean = [];
            foreach ($component_fields as $key => $definition) {
                $value = hf_design_sanitize_field($input['components'][$component_id][$breakpoint][$key] ?? '', $definition);
                if ($value !== '') {
                    $clean[$key] = $value;
                }
            }
            if ($clean) {
                $output['components'][$component_id][$breakpoint] = $clean;
            }
        }
    }
    return $output;
}

function hf_design_render_field($name, $value, $definition) {
    $type = $definition['type'] ?? 'text';
    $label = $definition['label'] ?? '';
    $unit = $definition['unit'] ?? '';
    ?>
    <label class="hf-design-field">
        <span><?php echo esc_html($label); ?></span>
        <?php if ($type === 'color') : ?>
            <span class="hf-design-color-control">
                <input type="color" data-hf-design-color value="<?php echo esc_attr($value ?: '#000000'); ?>">
                <input type="text" name="<?php echo esc_attr($name); ?>" value="<?php echo esc_attr($value); ?>" placeholder="<?php esc_attr_e('Heredar', 'horizon-fit-commerce'); ?>" maxlength="7" data-hf-design-color-text>
            </span>
        <?php elseif ($type === 'weight') : ?>
            <select name="<?php echo esc_attr($name); ?>">
                <option value=""><?php esc_html_e('Heredar', 'horizon-fit-commerce'); ?></option>
                <?php foreach (['100','200','300','400','500','600','700','800','900'] as $weight) : ?>
                    <option value="<?php echo esc_attr($weight); ?>" <?php selected((string) $value, $weight); ?>><?php echo esc_html($weight); ?></option>
                <?php endforeach; ?>
            </select>
        <?php elseif ($type === 'align') : ?>
            <select name="<?php echo esc_attr($name); ?>">
                <option value=""><?php esc_html_e('Heredar', 'horizon-fit-commerce'); ?></option>
                <option value="left" <?php selected($value, 'left'); ?>><?php esc_html_e('Izquierda', 'horizon-fit-commerce'); ?></option>
                <option value="center" <?php selected($value, 'center'); ?>><?php esc_html_e('Centro', 'horizon-fit-commerce'); ?></option>
                <option value="right" <?php selected($value, 'right'); ?>><?php esc_html_e('Derecha', 'horizon-fit-commerce'); ?></option>
            </select>
        <?php else : ?>
            <span class="hf-design-input-with-unit">
                <input
                    type="<?php echo $type === 'number' ? 'number' : ($type === 'url' ? 'url' : 'text'); ?>"
                    name="<?php echo esc_attr($name); ?>"
                    value="<?php echo esc_attr($value); ?>"
                    placeholder="<?php echo esc_attr($definition['placeholder'] ?? __('Heredar', 'horizon-fit-commerce')); ?>"
                    <?php if ($type === 'number') : ?>min="<?php echo esc_attr($definition['min'] ?? 0); ?>" max="<?php echo esc_attr($definition['max'] ?? 9999); ?>" step="1"<?php endif; ?>
                >
                <?php if ($unit) : ?><small><?php echo esc_html($unit); ?></small><?php endif; ?>
            </span>
        <?php endif; ?>
    </label>
    <?php
}

function hf_commerce_render_design_settings_page() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }

    $saved_notice = false;
    if (!empty($_POST['hf_design_settings_submit'])) {
        check_admin_referer('hf_design_settings_action');
        $settings = hf_design_settings_sanitize(wp_unslash($_POST['hf_design'] ?? []));
        $id = hf_design_settings_ensure_section();
        if ($id) {
            update_post_meta($id, '_hf_section_settings', wp_json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (function_exists('hf_regenerate_sections_cache')) {
                hf_regenerate_sections_cache();
            }
            $saved_notice = true;
        }
    }

    $settings = hf_design_settings_get();
    $global_fields = hf_design_settings_global_fields();
    $component_fields = hf_design_settings_component_fields();
    $breakpoints = [
        'desktop' => __('Desktop · 1025 px o más', 'horizon-fit-commerce'),
        'tablet'  => __('Tablet · 768–1024 px', 'horizon-fit-commerce'),
        'mobile'  => __('Mobile · hasta 767 px', 'horizon-fit-commerce'),
    ];
    ?>
    <div class="hf-design-editor">
        <h1><?php esc_html_e('Apariencia', 'horizon-fit-commerce'); ?></h1>
        <p class="description"><?php esc_html_e('Los campos vacíos heredan el diseño actual. Los cambios específicos de un componente prevalecen sobre los valores globales.', 'horizon-fit-commerce'); ?></p>
        <?php if ($saved_notice) : ?>
            <div class="notice notice-success inline"><p><?php esc_html_e('Apariencia guardada y caché regenerada.', 'horizon-fit-commerce'); ?></p></div>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('hf_design_settings_action'); ?>

            <section class="hf-design-global">
                <div>
                    <h2><?php esc_html_e('Estilos globales', 'horizon-fit-commerce'); ?></h2>
                    <p><?php esc_html_e('Se aplican a toda la tienda salvo que un componente tenga una personalización.', 'horizon-fit-commerce'); ?></p>
                </div>
                <button type="button" class="button" data-hf-design-clear><?php esc_html_e('Restablecer sección', 'horizon-fit-commerce'); ?></button>
                <div class="hf-design-fields hf-design-fields--global">
                    <?php foreach ($global_fields as $key => $definition) {
                        hf_design_render_field('hf_design[global][' . $key . ']', $settings['global'][$key] ?? '', $definition);
                    } ?>
                </div>
            </section>

            <div class="hf-design-components-head">
                <h2><?php esc_html_e('Componentes', 'horizon-fit-commerce'); ?></h2>
                <p><?php esc_html_e('Abrí solamente el componente que quieras modificar. Cada dispositivo hereda del CSS actual cuando sus campos están vacíos.', 'horizon-fit-commerce'); ?></p>
            </div>

            <div class="hf-design-components">
                <?php foreach (hf_design_settings_components() as $component_id => $component_label) : ?>
                    <details class="hf-design-component">
                        <summary>
                            <span><?php echo esc_html($component_label); ?></span>
                            <code><?php echo esc_html($component_id); ?></code>
                        </summary>
                        <div class="hf-design-component__body">
                            <div class="hf-design-component__actions">
                                <p><?php esc_html_e('Personalización por dispositivo', 'horizon-fit-commerce'); ?></p>
                                <button type="button" class="button button-small" data-hf-design-clear><?php esc_html_e('Vaciar componente', 'horizon-fit-commerce'); ?></button>
                            </div>
                            <div class="hf-design-breakpoints">
                                <?php foreach ($breakpoints as $breakpoint => $breakpoint_label) : ?>
                                    <fieldset class="hf-design-breakpoint">
                                        <legend><?php echo esc_html($breakpoint_label); ?></legend>
                                        <div class="hf-design-fields">
                                            <?php foreach ($component_fields as $key => $definition) {
                                                $name = 'hf_design[components][' . $component_id . '][' . $breakpoint . '][' . $key . ']';
                                                $value = $settings['components'][$component_id][$breakpoint][$key] ?? '';
                                                hf_design_render_field($name, $value, $definition);
                                            } ?>
                                        </div>
                                    </fieldset>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </details>
                <?php endforeach; ?>
            </div>

            <div class="hf-design-savebar">
                <span><?php esc_html_e('Guardá para publicar los cambios en la tienda.', 'horizon-fit-commerce'); ?></span>
                <button type="submit" name="hf_design_settings_submit" value="1" class="button button-primary button-hero"><?php esc_html_e('Guardar apariencia', 'horizon-fit-commerce'); ?></button>
            </div>
        </form>
    </div>
    <?php
}
