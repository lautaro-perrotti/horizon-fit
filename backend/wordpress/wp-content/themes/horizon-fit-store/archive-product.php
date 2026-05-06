<?php
get_header();

$queried_term = is_tax('product_cat') ? get_queried_object() : null;
$hero_image   = $queried_term instanceof WP_Term ? hf_store_get_term_image_url($queried_term, 'large') : '';
?>
<main class="hf-archive">
    <section class="hf-archive-hero">
        <div class="container hf-archive-hero__grid">
            <div>
                <p class="hf-section__eyebrow"><?php echo esc_html($queried_term instanceof WP_Term ? $queried_term->taxonomy : __('Shop', 'horizon-fit-store')); ?></p>
                <h1 class="hf-page-title"><?php woocommerce_page_title(); ?></h1>
                <div class="hf-entry-copy">
                    <?php if ($queried_term instanceof WP_Term) : ?>
                        <?php echo wp_kses_post(wpautop(term_description($queried_term))); ?>
                    <?php else : ?>
                        <p><?php esc_html_e('Una tienda visual, flexible y conectada al backend real de WooCommerce.', 'horizon-fit-store'); ?></p>
                    <?php endif; ?>
                </div>
            </div>
            <?php if ($hero_image) : ?>
                <div class="hf-archive-hero__media">
                    <img src="<?php echo esc_url($hero_image); ?>" alt="<?php echo esc_attr(woocommerce_page_title(false)); ?>">
                </div>
            <?php endif; ?>
        </div>
    </section>

    <section class="hf-section">
        <div class="container">
            <?php if (woocommerce_product_loop()) : ?>
                <div class="hf-product-grid">
                    <?php while (have_posts()) : the_post(); ?>
                        <?php hf_store_render_product_card(wc_get_product(get_the_ID())); ?>
                    <?php endwhile; ?>
                </div>
                <?php the_posts_pagination(array('mid_size' => 1)); ?>
            <?php else : ?>
                <div class="hf-empty-state">
                    <h2><?php esc_html_e('Todavía no hay productos en esta vista.', 'horizon-fit-store'); ?></h2>
                    <p><?php esc_html_e('Cuando cargues el catálogo en WooCommerce, esta sección se llena sola.', 'horizon-fit-store'); ?></p>
                </div>
            <?php endif; ?>
        </div>
    </section>
</main>
<?php
get_footer();
