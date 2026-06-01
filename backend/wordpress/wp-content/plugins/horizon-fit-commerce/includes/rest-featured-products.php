<?php
/**
 * Horizon Fit — Featured Products REST API
 * Endpoint: GET /wp-json/horizon-fit/v1/featured-products
 */

add_action('rest_api_init', function() {
  register_rest_route('horizon-fit/v1', '/featured-products', [
    'methods'  => 'GET',
    'callback' => 'hf_rest_featured_products',
    'permission_callback' => '__return_true',
  ]);
});

function hf_rest_featured_products() {
  header('Access-Control-Allow-Origin: http://localhost:8088');
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');

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

    $image_id = $product->get_image_id();
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'large') : wc_placeholder_img_src('large');

    $gallery_ids = $product->get_gallery_image_ids();
    $images = array_map(
      fn($id) => wp_get_attachment_image_url($id, 'large'),
      array_merge([$image_id], $gallery_ids)
    );
    // Filter out nulls
    $images = array_filter($images);
    // Ensure at least 1 image
    if (empty($images)) {
      $images = [$image];
    }

    $result[] = [
      'id' => $product->get_id(),
      'name' => $product->get_name(),
      'permalink' => get_permalink($product->get_id()),
      'priceText' => '$ ' . number_format($price, 2, ',', '.'),
      'installmentsText' => '$ ' . number_format($installment, 2, ',', '.'),
      'transferText' => '$ ' . number_format($transfer, 2, ',', '.'),
      'images' => array_values($images),
    ];
  }

  return rest_ensure_response($result);
}
