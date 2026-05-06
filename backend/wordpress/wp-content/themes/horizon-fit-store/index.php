<?php
get_header();
?>
<main class="hf-page-shell">
    <div class="hf-page-content container">
        <?php if (have_posts()) : ?>
            <?php while (have_posts()) : the_post(); ?>
                <article <?php post_class('hf-generic-entry'); ?>>
                    <h1 class="hf-page-title"><?php the_title(); ?></h1>
                    <div class="hf-entry-copy">
                        <?php the_content(); ?>
                    </div>
                </article>
            <?php endwhile; ?>
        <?php endif; ?>
    </div>
</main>
<?php
get_footer();
