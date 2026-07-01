<?php

/**
 * Importa/reemplaza fotos de camperas rústicas.
 *
 * Uso:
 *   HF_DRY_RUN=1 wp eval-file /tmp/import-campera-rustico-photos.php
 *   HF_DRY_RUN=0 wp eval-file /tmp/import-campera-rustico-photos.php
 */

$dry_run = getenv('HF_DRY_RUN') !== '0';
$base_dir = WP_CONTENT_DIR . '/uploads/_imports/fotos-camperas';

$map = [
    'Campera rustico azul' => 375,
    'Campera rustico blanco' => 389,
    'Campera rustico negro' => 359,
    'Campera rustico rojo' => 369,
];

if (!is_dir($base_dir)) {
    fwrite(STDERR, "No existe carpeta base: {$base_dir}\n");
    exit(1);
}

if (!$dry_run) {
    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
}

function hf_campera_photo_files(string $folder): array {
    $files = glob($folder . '/*');
    $files = array_values(array_filter($files, function ($file) {
        return is_file($file) && preg_match('/\.(jpe?g|png|webp)$/i', $file);
    }));
    natsort($files);
    return array_values($files);
}

function hf_campera_delete_existing_images(int $product_id): void {
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

function hf_campera_import_image(string $file, int $product_id): int {
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

echo $dry_run ? "DRY RUN: no se escribe nada.\n" : "IMPORT REAL: se reemplazan fotos de camperas.\n";

$imported_products = 0;
$imported_images = 0;

foreach ($map as $folder_name => $product_id) {
    $folder = $base_dir . '/' . $folder_name;
    $product = wc_get_product($product_id);
    $files = is_dir($folder) ? hf_campera_photo_files($folder) : [];

    if (!$product) {
        echo "ERROR producto inexistente {$product_id} para {$folder_name}\n";
        continue;
    }

    if (!$files) {
        echo "ERROR sin fotos: {$folder_name} -> {$product_id} {$product->get_name()}\n";
        continue;
    }

    echo "{$folder_name} -> {$product_id} {$product->get_name()} | fotos: " . count($files) . "\n";

    if ($dry_run) continue;

    hf_campera_delete_existing_images($product_id);

    $attachment_ids = [];
    foreach ($files as $file) {
        $attachment_ids[] = hf_campera_import_image($file, $product_id);
    }

    set_post_thumbnail($product_id, $attachment_ids[0]);
    update_post_meta($product_id, '_product_image_gallery', implode(',', array_slice($attachment_ids, 1)));

    $imported_products++;
    $imported_images += count($attachment_ids);
}

if (!$dry_run) {
    if (function_exists('hf_regenerate_featured_products_cache')) hf_regenerate_featured_products_cache();
    if (function_exists('hf_regenerate_featured_sets_cache')) hf_regenerate_featured_sets_cache();
    if (function_exists('hf_regenerate_sections_cache')) hf_regenerate_sections_cache();
    if (function_exists('hf_regenerate_menu_cache')) hf_regenerate_menu_cache();
}

echo "Productos importados: {$imported_products}\n";
echo "Imágenes importadas: {$imported_images}\n";
echo "Listo.\n";

