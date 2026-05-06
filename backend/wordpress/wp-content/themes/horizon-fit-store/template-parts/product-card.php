<?php
defined('ABSPATH') || exit;

$product = isset($product) && $product instanceof WC_Product ? $product : null;
if (! $product) {
    return;
}

$sizes       = hf_store_get_product_sizes($product);
$image       = wp_get_attachment_image_url($product->get_image_id(), 'medium_large');
$default_var = $product->is_type('variable') ? hf_store_get_default_variation_payload($product) : null;
?>
<article class="hf-product-card">
    <a class="hf-product-card__media" href="<?php echo esc_url($product->get_permalink()); ?>">
        <?php if ($product->is_on_sale()) : ?>
            <span class="hf-product-card__badge"><?php esc_html_e('Oferta', 'horizon-fit-store'); ?></span>
        <?php endif; ?>
        <img src="<?php echo esc_url($image ?: wc_placeholder_img_src('woocommerce_thumbnail')); ?>" alt="<?php echo esc_attr($product->get_name()); ?>">
    </a>
    <div class="hf-product-card__body">
        <?php if (! empty($sizes)) : ?>
            <div class="hf-product-card__sizes">
                <?php foreach (array_slice($sizes, 0, 4) as $size) : ?>
                    <span><?php echo esc_html($size); ?></span>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        <h3 class="hf-product-card__title"><a href="<?php echo esc_url($product->get_permalink()); ?>"><?php echo esc_html($product->get_name()); ?></a></h3>
        <div class="hf-product-card__price"><?php echo wp_kses_post($product->get_price_html()); ?></div>
        <p class="hf-product-card__excerpt"><?php echo esc_html(wp_trim_words(wp_strip_all_tags(hf_store_excerpt_fallback($product)), 18)); ?></p>
        <div class="hf-product-card__actions">
            <a class="hf-button hf-button--ghost" href="<?php echo esc_url($product->get_permalink()); ?>"><?php esc_html_e('Ver producto', 'horizon-fit-store'); ?></a>
            <?php if ($default_var) : ?>
                <form class="hf-product-card__cart" method="post" action="<?php echo esc_url($product->get_permalink()); ?>">
                    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product->get_id()); ?>">
                    <input type="hidden" name="product_id" value="<?php echo esc_attr($product->get_id()); ?>">
                    <input type="hidden" name="variation_id" value="<?php echo esc_attr($default_var['variation_id']); ?>">
                    <?php foreach ($default_var['attributes'] as $attribute_name => $attribute_value) : ?>
                        <input type="hidden" name="<?php echo esc_attr($attribute_name); ?>" value="<?php echo esc_attr($attribute_value); ?>">
                    <?php endforeach; ?>
                    <button class="hf-button" type="submit"><?php esc_html_e('Agregar', 'horizon-fit-store'); ?></button>
                </form>
            <?php else : ?>
                <form class="hf-product-card__cart" method="post" action="<?php echo esc_url($product->get_permalink()); ?>">
                    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product->get_id()); ?>">
                    <button class="hf-button" type="submit"><?php esc_html_e('Agregar', 'horizon-fit-store'); ?></button>
                </form>
            <?php endif; ?>
        </div>
    </div>
</article>
