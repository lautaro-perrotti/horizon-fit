<?php
get_header();

$term          = get_queried_object();
$hero_image    = $term instanceof WP_Term ? hf_store_get_term_image_url($term, 'large') : '';
$term_products = $term instanceof WP_Term ? hf_store_get_collection_products($term->term_id, 24) : array();
?>
<main class="hf-archive hf-archive--collection">
    <section class="hf-archive-hero">
        <div class="container hf-archive-hero__grid">
            <div>
                <p class="hf-section__eyebrow"><?php esc_html_e('Colección curada', 'horizon-fit-store'); ?></p>
                <h1 class="hf-page-title"><?php echo esc_html($term instanceof WP_Term ? $term->name : __('Colección', 'horizon-fit-store')); ?></h1>
                <div class="hf-entry-copy">
                    <p><?php echo esc_html($term instanceof WP_Term ? ($term->description ?: __('Una combinación pensada para vender el look completo.', 'horizon-fit-store')) : ''); ?></p>
                </div>
            </div>
            <?php if ($hero_image) : ?>
                <div class="hf-archive-hero__media">
                    <img src="<?php echo esc_url($hero_image); ?>" alt="<?php echo esc_attr($term->name); ?>">
                </div>
            <?php endif; ?>
        </div>
    </section>

    <section class="hf-section">
        <div class="container">
            <div class="hf-product-grid">
                <?php foreach ($term_products as $product) : ?>
                    <?php hf_store_render_product_card($product); ?>
                <?php endforeach; ?>
            </div>
            <?php if (empty($term_products)) : ?>
                <div class="hf-empty-state">
                    <h2><?php esc_html_e('La colección ya existe, pero todavía no tiene productos vinculados.', 'horizon-fit-store'); ?></h2>
                    <p><?php esc_html_e('Podés asignarlos desde el admin de productos o relanzar el seeder inicial.', 'horizon-fit-store'); ?></p>
                </div>
            <?php endif; ?>
        </div>
    </section>
</main>
<?php
get_footer();
