<?php
function hf_render_marquee($config = []) {
    $messages = $config['messages'] ?? ['3 y 6 cuotas sin interés'];
    $message = is_array($messages) ? $messages[0] : $messages;

    ob_start();
    ?>
<!-- ANNOUNCEMENT BANNER -->
<div class="hf-marquee hf-marquee--fixed" id="topMarquee" data-hf="marquee" data-speed="20">
  <div class="hf-marquee__track">
    <div class="hf-marquee__content">
      <span class="hf-marquee__item"><?php echo esc_html($message); ?></span>
      <span class="hf-marquee__separator" aria-hidden="true"></span>
    </div>
  </div>
</div>
    <?php
    return ob_get_clean();
}
