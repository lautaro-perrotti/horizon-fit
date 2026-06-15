<?php
if (! defined('ABSPATH')) {
    exit;
}
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
    <header class="hf-wp-header">
        <a class="hf-wp-brand" href="<?php echo esc_url(home_url('/')); ?>">Horizon Fit</a>
    </header>
    <main class="hf-wp-main">
        <?php if (have_posts()) : ?>
            <?php while (have_posts()) : the_post(); ?>
                <article <?php post_class('hf-wp-page'); ?>>
                    <h1 class="hf-wp-title"><?php the_title(); ?></h1>
                    <div class="hf-wp-content">
                        <?php the_content(); ?>
                    </div>
                </article>
            <?php endwhile; ?>
        <?php endif; ?>
    </main>
    <?php wp_footer(); ?>
</body>
</html>
