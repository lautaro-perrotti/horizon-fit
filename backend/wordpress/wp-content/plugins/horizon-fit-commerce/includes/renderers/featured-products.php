<?php
function hf_render_featured_products($config = []) {
    $limit = $config['limit'] ?? 8;
    $source = $config['source'] ?? 'manual';
    $product_ids = $config['product_ids'] ?? [];

    // Obtener productos en el orden especificado
    $products = hf_get_featured_products_by_ids($product_ids, $limit);

    if (empty($products)) {
        return '';
    }

    ob_start();
    ?>
<section class="section section--featured-products" style="background: var(--surface); padding-bottom: 0;">
  <div class="container">
    <div class="hf-section-head"
      style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding-top: 64px; margin-bottom: 32px;">
      <div aria-hidden="true"></div>
      <div class="hf-section-head__title" style="text-align:center;">
        <h2 style="font-size:clamp(28px,4vw,44px);font-weight:400 !important;margin:0;letter-spacing:-0.02em;">
          Productos destacados
        </h2>
      </div>
      <div aria-hidden="true"></div>
    </div>
  </div>

  <div class="hf-product-scroll-shell" data-grid-shell="productGrid1">
    <div style="padding: 0 var(--s-4);">
      <div id="productGrid1" class="hf-product-grid--h-scroll hide-scrollbar">
        <?php foreach ($products as $product): ?>
          <?php echo hf_render_product_card($product); ?>
        <?php endforeach; ?>
      </div>
    </div>

    <button class="hf-carousel__nav hf-carousel__nav--prev" type="button" data-dir="-1" aria-label="Anterior" disabled>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <button class="hf-carousel__nav hf-carousel__nav--next" type="button" data-dir="1" aria-label="Siguiente">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </div>
</section>
    <?php
    return ob_get_clean();
}

function hf_get_featured_products_by_ids($product_ids = [], $limit = 8) {
    if (empty($product_ids)) {
        return [];
    }

    $product_ids = array_slice($product_ids, 0, $limit);
    $products = [];

    foreach ($product_ids as $product_id) {
        $post = get_post($product_id);

        if (!$post || $post->post_type !== 'product') {
            continue;
        }

        $products[] = $post;
    }

    return $products;
}

function hf_render_product_card($product) {
    if (!is_a($product, 'WP_Post') || $product->post_type !== 'product') {
        return '';
    }

    $product_obj = wc_get_product($product->ID);

    if (!$product_obj) {
        return '';
    }

    $title = wp_strip_all_tags($product->post_title);
    $price = $product_obj->get_price_html();
    $permalink = get_permalink($product->ID);
    $images = $product_obj->get_gallery_image_ids();

    $image1_url = wp_get_attachment_url($images[0] ?? $product_obj->get_image_id());
    $image2_url = wp_get_attachment_url($images[1] ?? $images[0] ?? $product_obj->get_image_id());

    if (!$image1_url) {
        return '';
    }

    ob_start();
    ?>
<article class="hf-product-item hf-product-item--slider" data-product-id="<?php echo esc_attr($product->ID); ?>">
  <a href="<?php echo esc_url($permalink); ?>" aria-label="Ver fotos de <?php echo esc_attr($title); ?>" class="hf-product-item__link">
    <div class="hf-product-item__media">
      <span class="hf-product-item__badge">50% OFF!</span>
      <div class="hf-product-item__slider" data-slider>
        <div class="hf-product-item__slide"><img src="<?php echo esc_url($image1_url); ?>" alt="<?php echo esc_attr($title); ?>"></div>
        <div class="hf-product-item__slide"><img src="<?php echo esc_url($image2_url); ?>" alt="<?php echo esc_attr($title); ?>"></div>
      </div>
      <div class="hf-product-item__dots">
        <button class="hf-product-item__dot is-active" data-slide="0"></button>
        <button class="hf-product-item__dot" data-slide="1"></button>
      </div>
    </div>
  </a>

  <div class="hf-product-item__body">
    <div class="hf-product-item__sizes">
      <button class="hf-product-item__size" aria-pressed="false">S</button>
      <button class="hf-product-item__size" aria-pressed="false">M</button>
      <button class="hf-product-item__size" aria-pressed="false">L</button>
    </div>

    <a href="<?php echo esc_url($permalink); ?>" aria-label="Ver detalle de <?php echo esc_attr($title); ?>" class="hf-product-item__link">
      <h3 class="hf-product-item__title"><?php echo esc_html($title); ?></h3>
    </a>

    <div class="hf-product-item__pricing">
      <div class="hf-product-item__price-row">
        <span class="hf-product-item__price"><?php echo wp_kses_post($price); ?></span>
      </div>
      <p class="hf-product-item__installments">6 cuotas sin interés</p>
      <p class="hf-product-item__transfer">Transferencia disponible</p>
    </div>
  </div>
</article>
    <?php
    return ob_get_clean();
}
