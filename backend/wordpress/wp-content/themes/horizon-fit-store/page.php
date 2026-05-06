<?php
get_header();
?>
<main class="hf-page-shell">
    <div class="container">
        <?php while (have_posts()) : the_post(); ?>
            <article <?php post_class('hf-page-card'); ?>>
                <header class="hf-page-card__header">
                    <h1 class="hf-page-title"><?php the_title(); ?></h1>
                </header>
                <div class="hf-entry-copy">
                    <?php the_content(); ?>
                </div>
            </article>
        <?php endwhile; ?>
    </div>
</main>
<?php
get_footer();
