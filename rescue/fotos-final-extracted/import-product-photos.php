<?php

/**
 * Importa fotos finales a productos WooCommerce.
 *
 * Uso seguro:
 *   HF_DRY_RUN=1 wp eval-file /tmp/import-product-photos.php
 *   HF_DRY_RUN=0 wp eval-file /tmp/import-product-photos.php
 */

$dry_run = getenv('HF_DRY_RUN') !== '0';
$base_dir = WP_CONTENT_DIR . '/uploads/_imports/fotos-final/Fotos Final';

$map = [
    'Calsa lisa azul' => 172,
    'Calsa lisa blanca' => 162,
    'calsa lisa celeste' => 154,
    'Calsa lisa negra' => 133,
    'Calsa lisa verde' => 142,
    'Calsa rayas blancas celeste' => 463,
    'calsa rayas blancas negra' => 454,
    'Calsa rayas blancas rosa' => 477,
    'Calza rejilla negra' => 510,
    'Campera lisa azul' => 268,
    'Campera lisa verde' => 248,
    'Campera negra lisa' => 237,
    'Campera rustica blanca' => 389,
    'Falda azul' => 560,
    'Falda Bordó' => 552,
    'Falda negra' => 568,
    'Short liso azul' => 227,
    'Short liso blanco' => 216,
    'short liso celeste' => 195,
    'Short liso negro' => 186,
    'Short liso verde' => 205,
    'Short rayas blancas celeste' => 438,
    'Short rayas blancas negro' => 429,
    'Short rayas blancas rosa' => 448,
    'Short rustico blanco' => 329,
    'Short rustico rojo' => 318,
    'top falda azul' => 544,
    'Top falda bordó' => 536,
    'Top liso azul' => 99,
    'Top liso blanco' => 114,
    'Top liso celeste' => 87,
    'Top liso negro' => 56,
    'Top liso verde' => 93,
    'Top negro falda' => 548,
    'Top rayas blancas celeste' => 410,
    'Top rayas blancas negro' => 400,
    'Top rayas blancas rosa' => 420,
    'Top rejilla negro' => 487,
    'Top rustico azul' => 308,
    'Top rustico blanco' => 288,
    'Top rustico rojo' => 278,
];

$skipped_folders = [
    'Short rayas blancas' => 'Ambigua: no indica color y matchea varios productos.',
    'Short rojo rústico' => 'Duplicada con Short rustico rojo.',
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

function hf_final_photo_files(string $folder): array {
    $files = glob($folder . '/*');
    $files = array_values(array_filter($files, function ($file) {
        return is_file($file) && preg_match('/\.(jpe?g|png|webp)$/i', $file);
    }));
    natsort($files);
    return array_values($files);
}

function hf_delete_existing_product_images(int $product_id): void {
    $ids = [];

    $thumb = (int) get_post_thumbnail_id($product_id);
    if ($thumb) {
        $ids[$thumb] = true;
    }

    $gallery = (string) get_post_meta($product_id, '_product_image_gallery', true);
    foreach (array_filter(array_map('intval', explode(',', $gallery))) as $id) {
        if ($id) {
            $ids[$id] = true;
        }
    }

    $children = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'post_parent' => $product_id,
        'posts_per_page' => -1,
        'fields' => 'ids',
    ]);
    foreach ($children as $id) {
        $ids[(int) $id] = true;
    }

    delete_post_meta($product_id, '_thumbnail_id');
    delete_post_meta($product_id, '_product_image_gallery');

    foreach (array_keys($ids) as $id) {
        wp_delete_attachment((int) $id, true);
    }
}

function hf_import_image_for_product(string $file, int $product_id): int {
    $tmp = wp_tempnam($file);
    if (!$tmp || !copy($file, $tmp)) {
        throw new RuntimeException("No pude copiar temporal: {$file}");
    }

    $file_array = [
        'name' => basename($file),
        'tmp_name' => $tmp,
    ];

    $attachment_id = media_handle_sideload($file_array, $product_id);
    if (is_wp_error($attachment_id)) {
        @unlink($tmp);
        throw new RuntimeException($attachment_id->get_error_message());
    }

    return (int) $attachment_id;
}

echo $dry_run ? "DRY RUN: no se escribe nada.\n" : "IMPORT REAL: se escriben imágenes.\n";

$imported_products = 0;
$imported_images = 0;

foreach ($map as $folder_name => $product_id) {
    $folder = $base_dir . '/' . $folder_name;
    $product = wc_get_product($product_id);
    $files = is_dir($folder) ? hf_final_photo_files($folder) : [];

    if (!$product) {
        echo "ERROR producto inexistente {$product_id} para carpeta {$folder_name}\n";
        continue;
    }

    if (!$files) {
        echo "ERROR sin fotos: {$folder_name} -> {$product_id} {$product->get_name()}\n";
        continue;
    }

    echo "{$folder_name} -> {$product_id} {$product->get_name()} | fotos: " . count($files) . "\n";

    if ($dry_run) {
        continue;
    }

    hf_delete_existing_product_images($product_id);

    $attachment_ids = [];
    foreach ($files as $file) {
        $attachment_ids[] = hf_import_image_for_product($file, $product_id);
    }

    if ($attachment_ids) {
        set_post_thumbnail($product_id, $attachment_ids[0]);
        update_post_meta($product_id, '_product_image_gallery', implode(',', array_slice($attachment_ids, 1)));
        $imported_products++;
        $imported_images += count($attachment_ids);
    }
}

foreach ($skipped_folders as $folder_name => $reason) {
    $folder = $base_dir . '/' . $folder_name;
    $count = is_dir($folder) ? count(hf_final_photo_files($folder)) : 0;
    echo "SALTADA: {$folder_name} | fotos: {$count} | {$reason}\n";
}

if (!$dry_run) {
    if (function_exists('hf_regenerate_featured_products_cache')) {
        hf_regenerate_featured_products_cache();
    }
    if (function_exists('hf_regenerate_featured_sets_cache')) {
        hf_regenerate_featured_sets_cache();
    }
    if (function_exists('hf_regenerate_sections_cache')) {
        hf_regenerate_sections_cache();
    }
    if (function_exists('hf_regenerate_menu_cache')) {
        hf_regenerate_menu_cache();
    }
}

echo "Productos importados: {$imported_products}\n";
echo "Imágenes importadas: {$imported_images}\n";
echo "Listo.\n";

