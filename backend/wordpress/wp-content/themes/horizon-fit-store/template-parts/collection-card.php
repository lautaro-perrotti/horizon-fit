<?php
defined('ABSPATH') || exit;

$term = isset($term) && $term instanceof WP_Term ? $term : null;
if (! $term) {
    return;
}

$image      = hf_store_get_term_image_url($term, 'large');
$copy       = get_term_meta($term->term_id, 'hf_card_copy', true);
$products   = hf_store_get_collection_products($term->term_id, 3);
$first_item = ! empty($products) ? $products[0]->get_name() : __('Selección premium', 'horizon-fit-store');
?>
<article class="hf-collection-card">
    <a class="hf-collection-card__media" href="<?php echo esc_url(get_term_link($term)); ?>">
        <?php if ($image) : ?>
            <img src="<?php echo esc_url($image); ?>" alt="<?php echo esc_attr($term->name); ?>">
        <?php endif; ?>
    </a>
    <div class="hf-collection-card__body">
        <p class="hf-section__eyebrow"><?php esc_html_e('Conjunto destacado', 'horizon-fit-store'); ?></p>
        <h3 class="hf-collection-card__title"><a href="<?php echo esc_url(get_term_link($term)); ?>"><?php echo esc_html($term->name); ?></a></h3>
        <p class="hf-collection-card__copy"><?php echo esc_html($copy ?: $term->description); ?></p>
        <ul class="hf-collection-card__list">
            <?php foreach ($products as $product) : ?>
                <li><?php echo esc_html($product->get_name()); ?></li>
            <?php endforeach; ?>
            <?php if (empty($products)) : ?>
                <li><?php echo esc_html($first_item); ?></li>
            <?php endif; ?>
        </ul>
        <div class="hf-collection-card__actions">
            <a class="hf-button" href="<?php echo esc_url(get_term_link($term)); ?>"><?php esc_html_e('Ver conjunto', 'horizon-fit-store'); ?></a>
        </div>
    </div>
</article>
