<?php
if (! defined('ABSPATH')) {
    exit;
}

$is_account_page = function_exists('is_account_page') && is_account_page();
$is_logged_in = is_user_logged_in();
$brand_logo = home_url('/LOGOS/ISOTIPO.svg');
$shop_url = function_exists('get_post_type_archive_link') ? get_post_type_archive_link('product') : home_url('/');
$collection_url = home_url('/coleccion/');
$account_url = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : home_url('/my-account/');
$logout_url = function_exists('wc_logout_url') ? wc_logout_url() : wp_logout_url(home_url('/'));
$lost_password_url = function_exists('wc_lostpassword_url') ? wc_lostpassword_url() : wp_lostpassword_url();
$orders_url = function_exists('wc_get_account_endpoint_url') ? wc_get_account_endpoint_url('orders') : $account_url;
$addresses_url = function_exists('wc_get_account_endpoint_url') ? wc_get_account_endpoint_url('edit-address') : $account_url;
$edit_account_url = function_exists('wc_get_account_endpoint_url') ? wc_get_account_endpoint_url('edit-account') : $account_url;
$whatsapp_url = 'https://wa.me/541154878253?text=' . rawurlencode('Hola Horizon Fit, necesito ayuda con mi cuenta.');
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
    <?php wp_body_open(); ?>

    <div class="hf-wp-announcement" aria-label="Novedades de Horizon Fit">
        <div class="hf-wp-announcement__track">
            <span>3 y 6 cuotas sin interes</span>
            <span>Envio gratis desde $150.000</span>
            <span>Cambios faciles</span>
            <span>3 y 6 cuotas sin interes</span>
            <span>Envio gratis desde $150.000</span>
            <span>Cambios faciles</span>
        </div>
    </div>

    <header class="hf-wp-header">
        <div class="hf-wp-header__inner">
            <a class="hf-wp-brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="Horizon Fit">
                <img class="hf-wp-brand__logo" src="<?php echo esc_url($brand_logo); ?>" alt="Horizon Fit">
                <span class="hf-wp-brand__text">Horizon Fit</span>
            </a>

            <nav class="hf-wp-nav" aria-label="Principal">
                <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
                <a href="<?php echo esc_url($shop_url); ?>">Tienda</a>
                <a href="<?php echo esc_url($collection_url); ?>">Coleccion</a>
                <a href="<?php echo esc_url($account_url); ?>"<?php echo $is_account_page ? ' aria-current="page"' : ''; ?>>Mi cuenta</a>
            </nav>

            <div class="hf-wp-header__actions">
                <a class="hf-wp-pill hf-wp-pill--ghost" href="<?php echo esc_url($whatsapp_url); ?>" target="_blank" rel="noreferrer noopener">WhatsApp</a>
            </div>
        </div>
    </header>

    <main class="hf-wp-main">
        <?php if ($is_account_page) : ?>
            <section class="hf-account-hero" aria-label="Mi cuenta">
                <div class="hf-account-hero__copy">
                    <p class="hf-account-hero__eyebrow">Horizon Fit</p>
                    <h1 class="hf-account-hero__title">Mi cuenta</h1>
                    <p class="hf-account-hero__lead">Gestiona tus pedidos, tus direcciones y tu acceso desde un mismo lugar, con una experiencia coherente con todo el sitio.</p>
                    <div class="hf-account-hero__chips" aria-label="Accesos rapidos">
                        <span>Pedidos</span>
                        <span>Direcciones</span>
                        <span>Acceso seguro</span>
                    </div>
                </div>

                <aside class="hf-account-hero__panel">
                    <p class="hf-account-hero__panel-eyebrow"><?php echo $is_logged_in ? 'Sesion activa' : 'Acceso rapido'; ?></p>
                    <h2 class="hf-account-hero__panel-title"><?php echo $is_logged_in ? 'Tu cuenta esta lista' : 'Entrar para ver tu historial'; ?></h2>
                    <p class="hf-account-hero__panel-copy">
                        <?php echo $is_logged_in ? 'Desde aca podes revisar pedidos recientes, actualizar datos y cerrar sesion cuando quieras.' : 'Inicia sesion para ver compras, direcciones guardadas y recuperar tu actividad en un vistazo.'; ?>
                    </p>
                    <div class="hf-account-hero__links">
                        <a href="<?php echo esc_url($shop_url); ?>">Ir a la tienda</a>
                        <a href="<?php echo esc_url($collection_url); ?>">Ver coleccion</a>
                        <?php if ($is_logged_in) : ?>
                            <a href="<?php echo esc_url($orders_url); ?>">Pedidos</a>
                            <a href="<?php echo esc_url($addresses_url); ?>">Direcciones</a>
                            <a href="<?php echo esc_url($edit_account_url); ?>">Editar perfil</a>
                            <a href="<?php echo esc_url($logout_url); ?>">Salir</a>
                        <?php else : ?>
                            <a href="#username">Ir al login</a>
                            <a href="<?php echo esc_url($lost_password_url); ?>">Recuperar contrasena</a>
                        <?php endif; ?>
                    </div>
                </aside>
            </section>
        <?php endif; ?>

        <?php if (have_posts()) : ?>
            <?php while (have_posts()) : the_post(); ?>
                <article <?php post_class('hf-wp-page' . ($is_account_page ? ' hf-wp-page--account' : '')); ?>>
                    <?php if (! $is_account_page) : ?>
                        <h1 class="hf-wp-title"><?php the_title(); ?></h1>
                    <?php endif; ?>
                    <div class="hf-wp-content<?php echo $is_account_page ? ' hf-wp-content--account' : ''; ?>">
                        <?php the_content(); ?>
                    </div>
                </article>
            <?php endwhile; ?>
        <?php endif; ?>
    </main>

    <footer class="hf-wp-footer">
        <div class="hf-wp-footer__inner">
            <div class="hf-wp-footer__brand">
                <p class="hf-wp-footer__eyebrow">Horizon Fit</p>
                <h2 class="hf-wp-footer__title">Entrenamiento, diseño y una experiencia de marca consistente.</h2>
                <p class="hf-wp-footer__copy">La cuenta, la tienda y el soporte comparten el mismo sistema visual para que todo se sienta parte de una sola web.</p>
            </div>
            <div class="hf-wp-footer__meta">
                <div>
                    <h3>Explora</h3>
                    <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
                    <a href="<?php echo esc_url($shop_url); ?>">Tienda</a>
                    <a href="<?php echo esc_url($collection_url); ?>">Coleccion</a>
                </div>
                <div>
                    <h3>Cuenta</h3>
                    <a href="<?php echo esc_url($account_url); ?>">Mi cuenta</a>
                    <a href="<?php echo esc_url($orders_url); ?>">Pedidos</a>
                    <a href="<?php echo esc_url($lost_password_url); ?>">Recuperar contrasena</a>
                </div>
                <div>
                    <h3>Seguinos</h3>
                    <div class="hf-wp-footer__social">
                        <a href="https://instagram.com" target="_blank" rel="noreferrer noopener">Instagram</a>
                        <a href="https://facebook.com" target="_blank" rel="noreferrer noopener">Facebook</a>
                        <a href="https://tiktok.com" target="_blank" rel="noreferrer noopener">TikTok</a>
                        <a href="https://spotify.com" target="_blank" rel="noreferrer noopener">Spotify</a>
                    </div>
                </div>
            </div>
        </div>
    </footer>

    <a class="hf-wp-whatsapp" href="<?php echo esc_url($whatsapp_url); ?>" target="_blank" rel="noreferrer noopener" aria-label="WhatsApp">
        <span class="screen-reader-text">WhatsApp</span>
        <span aria-hidden="true">WhatsApp</span>
    </a>

    <?php wp_footer(); ?>
</body>
</html>
