<?php
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div class="hf-announce-bar" role="presentation">
    <div class="hf-announce-bar__track">
        <span>3 y 6 cuotas sin inter&eacute;s</span>
        <span>Env&iacute;o gratis desde $150.000</span>
        <span>Cambios f&aacute;ciles</span>
        <span>3 y 6 cuotas sin inter&eacute;s</span>
        <span>Env&iacute;o gratis desde $150.000</span>
        <span>Cambios f&aacute;ciles</span>
    </div>
</div>

<header class="hf-header">
    <div class="container hf-header__inner">
        <button class="hf-icon-button" type="button" data-drawer-open="menu" aria-label="<?php esc_attr_e('Abrir menú', 'horizon-fit-store'); ?>">
            <span></span>
            <span></span>
            <span></span>
        </button>

        <a class="hf-brand" href="<?php echo esc_url(home_url('/')); ?>">
            <span class="hf-brand__mark" aria-hidden="true">~</span>
            <span class="hf-brand__label"><?php bloginfo('name'); ?></span>
        </a>

        <div class="hf-header__actions">
            <a class="hf-header__link" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">
                <?php esc_html_e('Shop', 'horizon-fit-store'); ?>
            </a>
            <button class="hf-cart-button" type="button" data-drawer-open="cart" aria-label="<?php esc_attr_e('Abrir carrito', 'horizon-fit-store'); ?>">
                <span class="hf-cart-button__icon" aria-hidden="true">&#128722;</span>
                <span class="hf-cart-button__count" data-cart-count><?php echo function_exists('WC') && WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0; ?></span>
            </button>
        </div>
    </div>
</header>

<div class="hf-drawer-shell" data-drawer-shell="menu" hidden>
    <button class="hf-drawer-overlay" type="button" data-drawer-close aria-label="<?php esc_attr_e('Cerrar men&uacute;', 'horizon-fit-store'); ?>"></button>
    <aside class="hf-drawer hf-drawer--menu" aria-label="<?php esc_attr_e('Menú principal', 'horizon-fit-store'); ?>">
        <button class="hf-drawer__close" type="button" data-drawer-close aria-label="<?php esc_attr_e('Cerrar', 'horizon-fit-store'); ?>">&times;</button>
        <nav class="hf-drawer__nav" aria-label="<?php esc_attr_e('Enlaces principales', 'horizon-fit-store'); ?>">
            <?php foreach (hf_store_get_primary_menu_links() as $link) : ?>
                <a class="hf-drawer__nav-link" href="<?php echo esc_url($link['url']); ?>"><?php echo esc_html($link['label']); ?></a>
            <?php endforeach; ?>
        </nav>
        <div class="hf-drawer__social">
            <a href="https://instagram.com" target="_blank" rel="noreferrer noopener" aria-label="Instagram">Instagram</a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer noopener" aria-label="Facebook">Facebook</a>
            <a href="https://tiktok.com" target="_blank" rel="noreferrer noopener" aria-label="TikTok">TikTok</a>
            <a href="https://spotify.com" target="_blank" rel="noreferrer noopener" aria-label="Spotify">Spotify</a>
        </div>
    </aside>
</div>

<div class="hf-drawer-shell" data-drawer-shell="cart" hidden>
    <button class="hf-drawer-overlay" type="button" data-drawer-close aria-label="<?php esc_attr_e('Cerrar carrito', 'horizon-fit-store'); ?>"></button>
    <aside class="hf-drawer hf-drawer--cart" aria-label="<?php esc_attr_e('Carrito', 'horizon-fit-store'); ?>">
        <button class="hf-drawer__close" type="button" data-drawer-close aria-label="<?php esc_attr_e('Cerrar', 'horizon-fit-store'); ?>">&times;</button>
        <div class="hf-drawer__cart-head">
            <p class="hf-drawer__eyebrow"><?php esc_html_e('Tu carrito', 'horizon-fit-store'); ?></p>
            <h2 class="hf-drawer__title"><?php esc_html_e('Listo para cerrar la compra', 'horizon-fit-store'); ?></h2>
        </div>
        <div class="widget_shopping_cart_content">
            <?php if (function_exists('woocommerce_mini_cart')) : ?>
                <?php woocommerce_mini_cart(); ?>
            <?php endif; ?>
        </div>
        <div class="hf-drawer__cart-actions">
            <a class="hf-button hf-button--ghost" href="<?php echo esc_url(hf_store_normalize_public_url(function_exists('wc_get_cart_url') ? wc_get_cart_url() : '#')); ?>">
                <?php esc_html_e('Ver carrito', 'horizon-fit-store'); ?>
            </a>
            <a class="hf-button" href="<?php echo esc_url(hf_store_normalize_public_url(function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : '#')); ?>">
                <?php esc_html_e('Finalizar compra', 'horizon-fit-store'); ?>
            </a>
        </div>
    </aside>
</div>
