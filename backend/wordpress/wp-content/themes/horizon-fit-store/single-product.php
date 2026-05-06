<?php
defined('ABSPATH') || exit;

get_header();

global $product;

if (! $product instanceof WC_Product) {
    $product = wc_get_product(get_the_ID());
}

if ($product instanceof WC_Product_Variable) {
    wp_enqueue_script('wc-add-to-cart-variation');
}

$gallery_ids      = $product ? $product->get_gallery_image_ids() : array();
$main_image_id    = $product ? $product->get_image_id() : 0;
$main_image_url   = $main_image_id ? wp_get_attachment_image_url($main_image_id, 'full') : wc_placeholder_img_src('full');
$main_image_label = $product ? $product->get_name() : '';
$sizes            = $product ? hf_store_get_product_sizes($product) : array();
$look_products    = $product ? hf_store_get_related_products_for_look($product->get_id(), 3) : array();
?>
<main class="hf-product-page">
    <?php while (have_posts()) : the_post(); ?>
        <section class="hf-product-shell">
            <div class="container hf-product-shell__grid">
                <div class="hf-gallery">
                    <div class="hf-gallery__hero">
                        <img src="<?php echo esc_url($main_image_url); ?>" alt="<?php echo esc_attr($main_image_label); ?>" data-hf-gallery-target>
                    </div>
                    <div class="hf-gallery__thumbs">
                        <?php if ($main_image_id) : ?>
                            <button class="hf-gallery__thumb is-active" type="button" data-hf-gallery-thumb="<?php echo esc_url($main_image_url); ?>" data-hf-gallery-alt="<?php echo esc_attr($main_image_label); ?>">
                                <?php echo wp_get_attachment_image($main_image_id, 'thumbnail'); ?>
                            </button>
                        <?php endif; ?>
                        <?php foreach ($gallery_ids as $attachment_id) : ?>
                            <?php $image = wp_get_attachment_image_url($attachment_id, 'full'); ?>
                            <button class="hf-gallery__thumb" type="button" data-hf-gallery-thumb="<?php echo esc_url($image); ?>" data-hf-gallery-alt="<?php echo esc_attr(get_the_title()); ?>">
                                <?php echo wp_get_attachment_image($attachment_id, 'thumbnail'); ?>
                            </button>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="hf-product-summary">
                    <p class="hf-product-summary__eyebrow"><?php esc_html_e('Producto real conectado a WooCommerce', 'horizon-fit-store'); ?></p>
                    <h1 class="hf-page-title hf-page-title--product"><?php the_title(); ?></h1>
                    <div class="hf-product-summary__price"><?php woocommerce_template_single_price(); ?></div>
                    <div class="hf-product-summary__excerpt">
                        <p><?php echo wp_kses_post(hf_store_excerpt_fallback($product)); ?></p>
                    </div>

                    <?php if (! empty($sizes)) : ?>
                        <div class="hf-product-summary__sizes">
                            <span><?php esc_html_e('Talles', 'horizon-fit-store'); ?></span>
                            <div class="hf-size-list">
                                <?php foreach ($sizes as $size) : ?>
                                    <span class="hf-size-pill"><?php echo esc_html($size); ?></span>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <div class="hf-product-summary__form">
                        <?php woocommerce_template_single_add_to_cart(); ?>
                    </div>

                    <div class="hf-product-summary__meta">
                        <?php woocommerce_template_single_meta(); ?>
                    </div>
                </div>
            </div>
        </section>

        <?php if (! empty($look_products)) : ?>
            <section class="hf-pdp-look" aria-label="<?php esc_attr_e('El look completo', 'horizon-fit-store'); ?>">
                <div class="hf-pdp-look__panel">
                    <p class="hf-pdp-look__eyebrow"><?php esc_html_e('Styling edit', 'horizon-fit-store'); ?></p>
                    <h2 class="hf-pdp-look__title"><?php esc_html_e('El look completo', 'horizon-fit-store'); ?></h2>
                    <div class="hf-pdp-look__list">
                        <?php foreach ($look_products as $look_product) : ?>
                            <?php hf_store_render_product_card($look_product); ?>
                        <?php endforeach; ?>
                    </div>
                </div>
                <div class="hf-pdp-look__visual">
                    <span class="hf-pdp-look__tag"><?php echo esc_html($product->get_name()); ?></span>
                    <img class="hf-pdp-look__hero" src="<?php echo esc_url($main_image_url); ?>" alt="<?php echo esc_attr($main_image_label); ?>">
                </div>
            </section>
        <?php endif; ?>
    <?php endwhile; ?>
</main>
<?php
get_footer();
