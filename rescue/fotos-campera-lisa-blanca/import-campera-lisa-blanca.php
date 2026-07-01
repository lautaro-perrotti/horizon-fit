<?php

/**
 * Importa/reemplaza fotos de Campera lisa blanca (producto 257).
 */

$dry_run = getenv('HF_DRY_RUN') !== '0';
$product_id = 257;
$base_dir = WP_CONTENT_DIR . '/uploads/_imports/campera-lisa-blanca';

if (!is_dir($base_dir)) {
    fwrite(STDERR, "No existe carpeta base: {$base_dir}\n");
    exit(1);
}

if (!$dry_run) {
    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
}

function hf_single_import_files(string $folder): array {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS)
    );
    $files = [];
    foreach ($iterator as $file) {
        $path = $file->getPathname();
        if ($file->isFile() && preg_match('/\.(jpe?g|png|webp)$/i', $path)) {
            $files[] = $path;
        }
    }
    natsort($files);
    return array_values($files);
}

function hf_single_delete_existing_images(int $product_id): void {
    $ids = [];
    $thumb = (int) get_post_thumbnail_id($product_id);
    if ($thumb) $ids[$thumb] = true;

    $gallery = (string) get_post_meta($product_id, '_product_image_gallery', true);
    foreach (array_filter(array_map('intval', explode(',', $gallery))) as $id) {
        if ($id) $ids[$id] = true;
    }

    $children = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'post_parent' => $product_id,
        'posts_per_page' => -1,
        'fields' => 'ids',
    ]);
    foreach ($children as $id) $ids[(int) $id] = true;

    delete_post_meta($product_id, '_thumbnail_id');
    delete_post_meta($product_id, '_product_image_gallery');

    foreach (array_keys($ids) as $id) {
        wp_delete_attachment((int) $id, true);
    }
}

function hf_single_import_image(string $file, int $product_id): int {
    $tmp = wp_tempnam($file);
    if (!$tmp || !copy($file, $tmp)) {
        throw new RuntimeException("No pude copiar temporal: {$file}");
    }

    $attachment_id = media_handle_sideload([
        'name' => basename($file),
        'tmp_name' => $tmp,
    ], $product_id);

    if (is_wp_error($attachment_id)) {
        @unlink($tmp);
        throw new RuntimeException($attachment_id->get_error_message());
    }

    return (int) $attachment_id;
}

$product = wc_get_product($product_id);
if (!$product) {
    fwrite(STDERR, "No existe producto {$product_id}\n");
    exit(1);
}

$files = hf_single_import_files($base_dir);

echo $dry_run ? "DRY RUN: no se escribe nada.\n" : "IMPORT REAL: se reemplazan fotos.\n";
echo "{$product_id} | {$product->get_name()} | fotos: " . count($files) . "\n";

if (!$files) {
    exit(1);
}

if (!$dry_run) {
    hf_single_delete_existing_images($product_id);

    $attachment_ids = [];
    foreach ($files as $file) {
        $attachment_ids[] = hf_single_import_image($file, $product_id);
    }

    set_post_thumbnail($product_id, $attachment_ids[0]);
    update_post_meta($product_id, '_product_image_gallery', implode(',', array_slice($attachment_ids, 1)));

    if (function_exists('hf_regenerate_featured_products_cache')) hf_regenerate_featured_products_cache();
    if (function_exists('hf_regenerate_featured_sets_cache')) hf_regenerate_featured_sets_cache();
    if (function_exists('hf_regenerate_sections_cache')) hf_regenerate_sections_cache();
    if (function_exists('hf_regenerate_menu_cache')) hf_regenerate_menu_cache();
}

echo "Listo.\n";
