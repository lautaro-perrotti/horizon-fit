<?php
/**
 * Horizon Fit — Featured Products Static Cache
 * Genera archivo JSON estático en /wp-content/uploads/horizon-fit-cache/featured-products.json
 * Frontend fetcha SOLO ese archivo (sin PHP, sin REST, sin queries en runtime)
 */

// Regenerar caché cuando cambian productos
add_action('save_post_product', 'hf_regenerate_featured_products_cache', 30);
add_action('deleted_post', function($post_id) {
  $post = get_post($post_id);
  if ($post && $post->post_type === 'product') {
    hf_regenerate_featured_products_cache();
  }
}, 10);

// Cron job: regenerar cada hora automáticamente (solo verifica 1x por hora)
add_action('init', function() {
  if (get_transient('hf_cron_scheduled')) {
    return;
  }

  if (!wp_next_scheduled('hf_regenerate_featured_products_cache_cron')) {
    wp_schedule_event(time(), 'hourly', 'hf_regenerate_featured_products_cache_cron');
  }

  set_transient('hf_cron_scheduled', 1, 3600);
});
add_action('hf_regenerate_featured_products_cache_cron', 'hf_regenerate_featured_products_cache');

// Limpiar cron en deactivation
register_deactivation_hook(dirname(dirname(__FILE__)) . '/horizon-fit-commerce.php', function() {
  wp_clear_scheduled_hook('hf_regenerate_featured_products_cache_cron');
});

// WP-CLI command (opcional)
if (defined('WP_CLI') && WP_CLI) {
  WP_CLI::add_command('horizon-fit regenerate-featured-products-cache', function() {
    hf_regenerate_featured_products_cache();
    WP_CLI::success('Featured products cache regenerated');
  });
}

// Path del archivo de caché
function hf_featured_products_cache_path() {
  $cache_dir = wp_upload_dir()['basedir'] . '/horizon-fit-cache';
  if (!is_dir($cache_dir)) {
    @mkdir($cache_dir, 0755, true);
  }
  return $cache_dir . '/featured-products.json';
}

// Generar caché estático
function hf_regenerate_featured_products_cache() {
  if (!class_exists('WooCommerce')) {
    return;
  }

  $products = wc_get_products([
    'status' => 'publish',
    'limit' => 8,
    'orderby' => 'date',
    'order' => 'DESC',
  ]);

  $result = [];
  foreach ($products as $product) {
    $price = (float) $product->get_price();
    $installment = $price > 0 ? $price / 6 : 0;
    $transfer = $price > 0 ? $price * 0.85 : 0;

    // Get images (máx 2)
    $image_id = $product->get_image_id();
    $images = [];

    if ($image_id) {
      $img_url = wp_get_attachment_image_url($image_id, 'large');
      if ($img_url) {
        $images[] = $img_url;
      }
    }

    $gallery_ids = $product->get_gallery_image_ids();
    foreach ((array) $gallery_ids as $gid) {
      if (count($images) >= 2) break;
      $img_url = wp_get_attachment_image_url($gid, 'large');
      if ($img_url) {
        $images[] = $img_url;
      }
    }

    // Fallback to placeholder
    if (empty($images)) {
      $images[] = wc_placeholder_img_src('large');
    }

    // Build permalink from slug or ID fallback
    $slug = $product->get_slug();
    $product_id = $product->get_id();

    if ($slug && !empty($slug)) {
      $permalink = home_url('/product/' . $slug . '/');
    } else {
      // Fallback to ID-based URL
      $permalink = home_url('/?p=' . $product_id . '&post_type=product');
    }

    $result[] = [
      'id' => $product->get_id(),
      'name' => $product->get_name(),
      'permalink' => $permalink,
      'priceText' => '$ ' . number_format($price, 2, ',', '.'),
      'installmentsText' => '6 cuotas de: $ ' . number_format($installment, 2, ',', '.'),
      'transferText' => '$ ' . number_format($transfer, 2, ',', '.') . ' con Transferencia',
      'images' => $images,
    ];
  }

  // Guardar JSON con encoding correcto
  $cache_file = hf_featured_products_cache_path();
  $json = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
  file_put_contents($cache_file, $json, LOCK_EX);
}

// Generar caché en activation
register_activation_hook(dirname(dirname(__FILE__)) . '/horizon-fit-commerce.php', function() {
  hf_regenerate_featured_products_cache();
});
