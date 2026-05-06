<?php
?>
<footer class="hf-footer">
    <div class="container hf-footer__grid">
        <div>
            <p class="hf-footer__eyebrow"><?php esc_html_e('Horizon Fit', 'horizon-fit-store'); ?></p>
            <h2 class="hf-footer__title"><?php esc_html_e('Entrenamiento, diseño y un backend listo para escalar.', 'horizon-fit-store'); ?></h2>
            <p class="hf-footer__copy"><?php esc_html_e('WooCommerce queda conectado como fuente de verdad para productos, colecciones, precios, fotos y ofertas.', 'horizon-fit-store'); ?></p>
        </div>
        <div class="hf-footer__meta">
            <div>
                <h3><?php esc_html_e('Explorá', 'horizon-fit-store'); ?></h3>
                <a href="<?php echo esc_url(get_post_type_archive_link('product')); ?>"><?php esc_html_e('Tienda', 'horizon-fit-store'); ?></a>
                <a href="<?php echo esc_url(hf_store_get_offers_url()); ?>"><?php esc_html_e('Ofertas', 'horizon-fit-store'); ?></a>
                <a href="<?php echo esc_url(function_exists('wc_get_cart_url') ? wc_get_cart_url() : '#'); ?>"><?php esc_html_e('Carrito', 'horizon-fit-store'); ?></a>
            </div>
            <div>
                <h3><?php esc_html_e('Seguinos', 'horizon-fit-store'); ?></h3>
                <div class="hf-footer__social">
                    <a href="https://instagram.com" target="_blank" rel="noreferrer noopener">Instagram</a>
                    <a href="https://facebook.com" target="_blank" rel="noreferrer noopener">Facebook</a>
                    <a href="https://tiktok.com" target="_blank" rel="noreferrer noopener">TikTok</a>
                    <a href="https://spotify.com" target="_blank" rel="noreferrer noopener">Spotify</a>
                </div>
            </div>
        </div>
    </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
