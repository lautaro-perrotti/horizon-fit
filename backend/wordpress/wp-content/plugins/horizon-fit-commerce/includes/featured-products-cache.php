<?php
/**
 * Horizon Fit — Featured Products Static Cache
 * Genera archivo JSON estático en /wp-content/uploads/horizon-fit-cache/featured-products.json
 * Frontend fetcha SOLO ese archivo (sin PHP, sin REST, sin queries en runtime)
 */

add_action('save_post_product', 'hf_regenerate_featured_products_cache', 30);
add_action('deleted_post', function($post_id) {
  $post = get_post($post_id);
  if ($post && $post->post_type === 'product') {
    hf_regenerate_featured_products_cache();
  }
}, 10);

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

register_deactivation_hook(dirname(dirname(__FILE__)) . '/horizon-fit-commerce.php', function() {
  wp_clear_scheduled_hook('hf_regenerate_featured_products_cache_cron');
});

if (defined('WP_CLI') && WP_CLI) {
  WP_CLI::add_command('horizon-fit regenerate-featured-products-cache', function() {
    hf_regenerate_featured_products_cache();
    WP_CLI::success('Featured products cache regenerated');
  });
}

function hf_featured_products_cache_path() {
  $cache_dir = wp_upload_dir()['basedir'] . '/horizon-fit-cache';
  if (!is_dir($cache_dir)) {
    @mkdir($cache_dir, 0755, true);
  }
  return $cache_dir . '/featured-products.json';
}

function hf_featured_products_format_price($price) {
  if ($price === '' || $price === null || !is_numeric($price)) {
    return '';
  }

  return '$ ' . number_format((float) $price, 2, ',', '.');
}

function hf_featured_products_get_terms($product_id, $taxonomy) {
  $terms = get_the_terms($product_id, $taxonomy);
  if (!$terms || is_wp_error($terms)) {
    return [];
  }

  return array_values(array_map(function($term) {
    return [
      'id' => (int) $term->term_id,
      'slug' => $term->slug,
      'name' => $term->name,
    ];
  }, $terms));
}

function hf_featured_products_get_attributes($product) {
  $attributes = [];

  foreach ($product->get_attributes() as $attribute) {
    if (!$attribute) {
      continue;
    }

    $name = $attribute->get_name();
    $values = [];

    if ($attribute->is_taxonomy()) {
      $terms = wc_get_product_terms($product->get_id(), $name, ['fields' => 'all']);
      foreach ($terms as $term) {
        $values[] = [
          'id' => (int) $term->term_id,
          'slug' => $term->slug,
          'name' => $term->name,
        ];
      }
    } else {
      foreach ($attribute->get_options() as $option) {
        foreach (preg_split('/[,|]/', $option) as $value) {
          $value = trim($value);
          if ($value !== '') {
            $values[] = [
              'slug' => sanitize_title($value),
              'name' => $value,
            ];
          }
        }
      }
    }

    $attributes[] = [
      'name' => $name,
      'label' => wc_attribute_label($name),
      'values' => $values,
      'visible' => (bool) $attribute->get_visible(),
      'variation' => (bool) $attribute->get_variation(),
    ];
  }

  return $attributes;
}

function hf_featured_products_get_sizes($attributes, $variations) {
  $sizes = [];

  foreach ($attributes as $attribute) {
    $key = strtolower($attribute['name'] . ' ' . $attribute['label']);
    if (strpos($key, 'talle') === false && strpos($key, 'size') === false) {
      continue;
    }

    foreach ($attribute['values'] as $value) {
      if (!empty($value['name'])) {
        $sizes[] = $value['name'];
      }
    }
  }

  foreach ($variations as $variation) {
    foreach ($variation['attributes'] as $name => $value) {
      $key = strtolower($name);
      if ((strpos($key, 'talle') !== false || strpos($key, 'size') !== false) && $value !== '') {
        $sizes[] = $value;
      }
    }
  }

  return array_values(array_unique(array_filter($sizes)));
}

function hf_featured_products_get_image_object($image_id, $product_name) {
  $full = wp_get_attachment_image_src($image_id, 'full');
  if (!$full) {
    return null;
  }

  $large = wp_get_attachment_image_src($image_id, 'large');
  $medium = wp_get_attachment_image_src($image_id, 'medium_large');

  return [
    'id' => (int) $image_id,
    'url' => $full[0],
    'width' => isset($full[1]) ? (int) $full[1] : 0,
    'height' => isset($full[2]) ? (int) $full[2] : 0,
    'large' => $large ? $large[0] : $full[0],
    'medium' => $medium ? $medium[0] : ($large ? $large[0] : $full[0]),
    'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true) ?: $product_name,
    'caption' => wp_get_attachment_caption($image_id) ?: '',
  ];
}

function hf_featured_products_get_images($product) {
  $image_ids = [];
  $main_image_id = $product->get_image_id();

  if ($main_image_id) {
    $image_ids[] = $main_image_id;
  }

  foreach ((array) $product->get_gallery_image_ids() as $gallery_id) {
    $image_ids[] = $gallery_id;
  }

  $images = [];
  foreach (array_unique(array_filter($image_ids)) as $image_id) {
    $image = hf_featured_products_get_image_object($image_id, $product->get_name());
    if ($image) {
      $images[] = $image;
    }
  }

  return $images;
}

function hf_featured_products_get_price_data($product) {
  $price = get_post_meta($product->get_id(), '_price', true);
  $regular_price = get_post_meta($product->get_id(), '_regular_price', true);
  $sale_price = get_post_meta($product->get_id(), '_sale_price', true);

  if ($product->is_type('variable')) {
    $variations = $product->get_children();
    if (!empty($variations)) {
      $first_var_id = $variations[0];
      $var_price = get_post_meta($first_var_id, '_price', true);
      $var_regular = get_post_meta($first_var_id, '_regular_price', true);
      $var_sale = get_post_meta($first_var_id, '_sale_price', true);

      if (!empty($var_price)) $price = $var_price;
      if (!empty($var_regular)) $regular_price = $var_regular;
      if (!empty($var_sale)) $sale_price = $var_sale;
    }
  }

  return [
    'price' => !empty($price) ? (float) $price : null,
    'regularPrice' => !empty($regular_price) ? (float) $regular_price : null,
    'salePrice' => !empty($sale_price) ? (float) $sale_price : null,
  ];
}

function hf_featured_products_get_variations($product) {
  if (!$product->is_type('variable')) {
    return [];
  }

  $variations = [];

  foreach ($product->get_children() as $variation_id) {
    $variation = wc_get_product($variation_id);
    if (!$variation) {
      continue;
    }

    $price_data = hf_featured_products_get_price_data($variation);
    $variations[] = [
      'id' => $variation->get_id(),
      'sku' => $variation->get_sku(),
      'permalink' => $variation->get_permalink(),
      'price' => $price_data['price'],
      'regularPrice' => $price_data['regularPrice'],
      'salePrice' => $price_data['salePrice'],
      'priceText' => hf_featured_products_format_price($price_data['price']),
      'regularPriceText' => hf_featured_products_format_price($price_data['regularPrice']),
      'salePriceText' => hf_featured_products_format_price($price_data['salePrice']),
      'attributes' => $variation->get_attributes(),
      'stockStatus' => $variation->get_stock_status(),
      'stockQuantity' => $variation->get_stock_quantity(),
      'isOnSale' => (bool) $variation->is_on_sale(),
    ];
  }

  return $variations;
}

function hf_featured_products_get_badge($product, $price_data) {
  if ($product->is_on_sale()) {
    return 'OFERTA';
  }

  if ($product->is_featured()) {
    return 'DESTACADO';
  }

  return '';
}

function hf_featured_products_serialize_product($product) {
  $price_data = hf_featured_products_get_price_data($product);
  $variations = hf_featured_products_get_variations($product);
  $attributes = hf_featured_products_get_attributes($product);
  $images = hf_featured_products_get_images($product);

  return [
    'id' => $product->get_id(),
    'slug' => $product->get_slug(),
    'sku' => $product->get_sku(),
    'type' => $product->get_type(),
    'status' => get_post_status($product->get_id()),
    'name' => $product->get_name(),
    'permalink' => $product->get_permalink(),
    'price' => $price_data['price'],
    'regularPrice' => $price_data['regularPrice'],
    'salePrice' => $price_data['salePrice'],
    'priceText' => hf_featured_products_format_price($price_data['price']),
    'priceOriginal' => $price_data['regularPrice'] && $price_data['price'] && $price_data['regularPrice'] > $price_data['price']
      ? hf_featured_products_format_price($price_data['regularPrice'])
      : '',
    'regularPriceText' => hf_featured_products_format_price($price_data['regularPrice']),
    'salePriceText' => hf_featured_products_format_price($price_data['salePrice']),
    'badge' => hf_featured_products_get_badge($product, $price_data),
    'categories' => hf_featured_products_get_terms($product->get_id(), 'product_cat'),
    'tags' => hf_featured_products_get_terms($product->get_id(), 'product_tag'),
    'collections' => hf_featured_products_get_terms($product->get_id(), 'hf_collection'),
    'attributes' => $attributes,
    'sizes' => hf_featured_products_get_sizes($attributes, $variations),
    'variations' => $variations,
    'stockStatus' => $product->get_stock_status(),
    'stockQuantity' => $product->get_stock_quantity(),
    'isFeatured' => (bool) $product->is_featured(),
    'isOnSale' => (bool) $product->is_on_sale(),
    'images' => array_values(array_map(function($image) {
      return $image['url'];
    }, $images)),
    'imageObjects' => $images,
  ];
}

function hf_regenerate_featured_products_cache() {
  if (!class_exists('WooCommerce')) {
    return;
  }

  $query = [
    'status' => 'publish',
    'limit' => 50,
    'orderby' => 'date',
    'order' => 'DESC',
  ];

  $query = apply_filters('hf_featured_products_cache_query', $query);
  $products = wc_get_products($query);

  $result = [];
  foreach ($products as $product) {
    $result[] = hf_featured_products_serialize_product($product);
  }

  $cache_file = hf_featured_products_cache_path();
  $json = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
  file_put_contents($cache_file, $json, LOCK_EX);
}

register_activation_hook(dirname(dirname(__FILE__)) . '/horizon-fit-commerce.php', function() {
  hf_regenerate_featured_products_cache();
});
