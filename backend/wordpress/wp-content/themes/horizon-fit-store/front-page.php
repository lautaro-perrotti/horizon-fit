<?php
get_header();

$featured_products = wc_get_products(
    array(
        'status'   => 'publish',
        'limit'    => 10,
        'featured' => true,
    )
);
$featured_collections = hf_store_get_featured_collections(5);
$home_categories      = hf_store_get_home_categories(6);
$sale_products        = wc_get_products(
    array(
        'status'   => 'publish',
        'limit'    => 8,
        'category' => array('ofertas'),
    )
);
?>
<main class="hf-home">
    <section class="hf-hero">
        <div class="container hf-hero__grid">
            <div class="hf-hero__copy">
                <p class="hf-hero__eyebrow"><?php esc_html_e('Storefront conectado a WooCommerce', 'horizon-fit-store'); ?></p>
                <h1 class="hf-hero__title"><?php esc_html_e('Horizon Fit ahora vende con catálogo real, colecciones reales y ofertas reales.', 'horizon-fit-store'); ?></h1>
                <p class="hf-hero__text"><?php esc_html_e('La estética sigue siendo propia, pero el backend ya puede manejar productos variables, fotos, descuentos, stock y checkout end-to-end.', 'horizon-fit-store'); ?></p>
                <div class="hf-hero__actions">
                    <a class="hf-button" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>"><?php esc_html_e('Ver tienda', 'horizon-fit-store'); ?></a>
                    <a class="hf-button hf-button--ghost" href="#fullSlider"><?php esc_html_e('Explorar conjuntos', 'horizon-fit-store'); ?></a>
                </div>
            </div>
            <div class="hf-hero__visual">
                <img src="https://images.pexels.com/photos/3757954/pexels-photo-3757954.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1" alt="<?php esc_attr_e('Look Horizon Fit', 'horizon-fit-store'); ?>">
            </div>
        </div>
    </section>

    <section class="hf-section" id="productGrid1">
        <div class="container">
            <div class="hf-section__head">
                <div>
                    <p class="hf-section__eyebrow"><?php esc_html_e('Productos destacados', 'horizon-fit-store'); ?></p>
                    <h2 class="hf-section__title"><?php esc_html_e('Lo más fuerte del catálogo real', 'horizon-fit-store'); ?></h2>
                </div>
                <a class="hf-section__link" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>"><?php esc_html_e('Ver todo', 'horizon-fit-store'); ?></a>
            </div>
            <div class="hf-product-strip">
                <?php foreach ($featured_products as $product) : ?>
                    <?php hf_store_render_product_card($product); ?>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <section class="hf-section hf-section--collections" id="fullSlider">
        <div class="container">
            <div class="hf-section__head">
                <div>
                    <p class="hf-section__eyebrow"><?php esc_html_e('Conjuntos destacados', 'horizon-fit-store'); ?></p>
                    <h2 class="hf-section__title"><?php esc_html_e('Colecciones curadas para vender el look completo', 'horizon-fit-store'); ?></h2>
                </div>
            </div>
            <div class="hf-collection-strip">
                <?php foreach ($featured_collections as $collection) : ?>
                    <?php hf_store_render_collection_card($collection); ?>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <section class="hf-section" id="homeCategories">
        <div class="container">
            <div class="hf-section__head">
                <div>
                    <p class="hf-section__eyebrow"><?php esc_html_e('Compra por categoría', 'horizon-fit-store'); ?></p>
                    <h2 class="hf-section__title"><?php esc_html_e('Las categorías que hoy mandan en la home', 'horizon-fit-store'); ?></h2>
                </div>
            </div>
            <div class="hf-category-grid">
                <?php foreach ($home_categories as $term) : ?>
                    <?php $image = hf_store_get_term_image_url($term, 'large'); ?>
                    <a class="hf-category-card" href="<?php echo esc_url(get_term_link($term)); ?>">
                        <?php if ($image) : ?>
                            <img src="<?php echo esc_url($image); ?>" alt="<?php echo esc_attr($term->name); ?>">
                        <?php endif; ?>
                        <span class="hf-category-card__overlay">
                            <span class="hf-category-card__title"><?php echo esc_html($term->name); ?></span>
                            <span class="hf-category-card__cta"><?php esc_html_e('Quiero ver', 'horizon-fit-store'); ?></span>
                        </span>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <?php if (! empty($sale_products)) : ?>
        <section class="hf-section hf-section--offers">
            <div class="container">
                <div class="hf-section__head">
                    <div>
                        <p class="hf-section__eyebrow"><?php esc_html_e('Ofertas activas', 'horizon-fit-store'); ?></p>
                        <h2 class="hf-section__title"><?php esc_html_e('Sección conectada a sale price real de WooCommerce', 'horizon-fit-store'); ?></h2>
                    </div>
                    <a class="hf-section__link" href="<?php echo esc_url(hf_store_get_offers_url()); ?>"><?php esc_html_e('Ir a ofertas', 'horizon-fit-store'); ?></a>
                </div>
                <div class="hf-product-strip">
                    <?php foreach ($sale_products as $product) : ?>
                        <?php hf_store_render_product_card($product); ?>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
    <?php endif; ?>

    <section class="hf-benefits">
        <div class="container hf-benefits__grid">
            <article class="hf-benefit">
                <h3><?php esc_html_e('Envíos a todo el país', 'horizon-fit-store'); ?></h3>
                <p><?php esc_html_e('Tu catálogo y el checkout real quedan listos para sumar logística y pasarelas después.', 'horizon-fit-store'); ?></p>
            </article>
            <article class="hf-benefit">
                <h3><?php esc_html_e('Precios en lote', 'horizon-fit-store'); ?></h3>
                <p><?php esc_html_e('Desde el admin podés cambiar precios por colección, categoría o selección manual.', 'horizon-fit-store'); ?></p>
            </article>
            <article class="hf-benefit">
                <h3><?php esc_html_e('Fotos sin tocar código', 'horizon-fit-store'); ?></h3>
                <p><?php esc_html_e('Productos, galerías y visuales de colecciones se corrigen desde Media Library y WooCommerce.', 'horizon-fit-store'); ?></p>
            </article>
        </div>
    </section>
</main>
<?php
get_footer();
