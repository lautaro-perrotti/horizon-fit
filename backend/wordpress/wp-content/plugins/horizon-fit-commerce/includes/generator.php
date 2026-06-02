<?php
/**
 * Page Generator - Renderiza secciones y escribe HTML final
 */

require_once __DIR__ . '/renderers/header.php';
require_once __DIR__ . '/renderers/marquee.php';
require_once __DIR__ . '/renderers/hero.php';
require_once __DIR__ . '/renderers/featured-products.php';
require_once __DIR__ . '/renderers/conjuntos.php';
require_once __DIR__ . '/renderers/categorias.php';
require_once __DIR__ . '/renderers/trust.php';
require_once __DIR__ . '/renderers/footer.php';

function hf_render_section($section) {
    $type = $section['type'];
    $config = $section['config'] ?? [];

    switch ($type) {
        case 'header':
            return hf_render_header($config);
        case 'marquee':
            return hf_render_marquee($config);
        case 'hero':
            return hf_render_hero($config);
        case 'featured-products':
            return hf_render_featured_products($config);
        case 'conjuntos':
            return hf_render_conjuntos($config);
        case 'categorias':
            return hf_render_categorias($config);
        case 'trust':
            return hf_render_trust($config);
        case 'footer':
            return hf_render_footer($config);
        default:
            return '';
    }
}

function hf_generate_page($slug = 'home') {
    $page_config = hf_get_page_config($slug);

    if (!$page_config) {
        return new WP_Error('page_not_found', "Página '{$slug}' no encontrada en configuración");
    }

    // Ordenar secciones por order
    $sections = $page_config['sections'];
    usort($sections, function($a, $b) {
        return ($a['order'] ?? 0) - ($b['order'] ?? 0);
    });

    // Renderizar cada sección visible
    $html_parts = [];
    foreach ($sections as $section) {
        if (!($section['visible'] ?? true)) {
            continue;
        }

        $html = hf_render_section($section);
        if ($html) {
            $html_parts[] = $html;
        }
    }

    // Armar HTML completo con head y scripts
    $body_html = implode("\n", $html_parts);
    $full_html = hf_get_html_wrapper($body_html);

    // Escribir archivo a directorio uploads (con permiso de escritura)
    $output_path = $page_config['output'] ?? 'index.html';
    $upload_dir = wp_upload_dir();
    $temp_file = $upload_dir['basedir'] . '/temp-' . $output_path;

    $write_result = file_put_contents($temp_file, $full_html);

    if (!$write_result) {
        return new WP_Error('write_failed', "No se pudo escribir archivo temporal");
    }

    // Copiar a la ubicación final (intenta con permisos de escritura)
    $final_path = ABSPATH . $output_path;

    if (!@copy($temp_file, $final_path)) {
        // Si falla, intenta cambiar permisos
        @chmod($final_path, 0666);
        if (!@copy($temp_file, $final_path)) {
            // Si sigue fallando, devuelve el temp file path para copiar manualmente
            error_log("[HF Generator] No se pudo escribir a {$final_path}, usando archivo temporal en {$temp_file}");
            return new WP_Error('write_failed', "Generado en temp, pero no se pudo copiar a {$output_path}. Archivo temporal: {$temp_file}");
        }
    }

    @unlink($temp_file);

    do_action('hf_page_generated', $slug, $file_path);

    return [
        'success' => true,
        'slug' => $slug,
        'file' => $file_path,
        'sections' => count($html_parts)
    ];
}

function hf_get_html_wrapper($body_html) {
    // Usar plantilla guardada en uploads si existe
    $upload_dir = wp_upload_dir();
    $template_cache = $upload_dir['basedir'] . '/hf-template.html';

    $template = '';

    if (file_exists($template_cache)) {
        $template = file_get_contents($template_cache);
    } else {
        // Si no existe, intentar leer del rescue folder
        $rescue_path = ABSPATH . 'rescue/home-source.html';
        if (file_exists($rescue_path)) {
            $template = file_get_contents($rescue_path);
            // Guardar para próximas generaciones
            @file_put_contents($template_cache, $template);
        }
    }

    if (empty($template)) {
        // Última opción: HTML mínimo con estilos
        error_log('[HF Generator] Sin plantilla, usando HTML mínimo');
        return <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Horizon Fit</title>
  <link rel="stylesheet" href="design-system/components/marquee/marquee.css" />
  <link rel="stylesheet" href="design-system/components/product-item/product-item.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .nav { background: white; padding: 20px; border-bottom: 1px solid #eee; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
  </style>
</head>
<body data-theme="light">
HTML . $body_html . <<<'HTML'
</body>
</html>
HTML;
    }

    // Buscar <body y reemplazar el contenido
    $body_start = stripos($template, '<body');
    if ($body_start === false) {
        // Si no tiene body, simplemente agregar
        error_log('[HF Generator] Plantilla sin <body>');
        return <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
HTML . $body_html . '</body></html>';
    }

    $body_tag_end = strpos($template, '>', $body_start) + 1;
    $closing_body = stripos($template, '</body>');
    if ($closing_body === false) {
        $closing_body = strlen($template);
    }

    $head_and_open = substr($template, 0, $body_tag_end);
    $closing_tags = substr($template, $closing_body);

    return $head_and_open . "\n" . $body_html . "\n" . $closing_tags;
}

// WP-CLI command
if (defined('WP_CLI') && WP_CLI) {
    class HF_Generate_Page_Command {
        public function generate($args, $assoc_args) {
            $slug = $args[0] ?? 'home';

            WP_CLI::line("Generando página: {$slug}...");

            $result = hf_generate_page($slug);

            if (is_wp_error($result)) {
                WP_CLI::error($result->get_error_message());
            }

            WP_CLI::success("Página '{$slug}' generada: {$result['sections']} secciones");
        }

        public function regenerate_all($args, $assoc_args) {
            $config = get_option('hf_pages_config');

            if (!$config) {
                WP_CLI::error('No hay páginas configuradas');
            }

            foreach ($config as $slug => $page) {
                WP_CLI::line("Generando: {$slug}");
                hf_generate_page($slug);
            }

            WP_CLI::success('Todas las páginas regeneradas');
        }
    }

    WP_CLI::add_command('hf generate', 'HF_Generate_Page_Command');
}
