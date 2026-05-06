jQuery(function ($) {
  $(document).on('click', '[data-hf-media-open]', function (event) {
    event.preventDefault();

    var button = $(this);
    var target = $(button.data('hf-target'));
    var preview = $(button.data('hf-preview'));

    var frame = wp.media({
      title: 'Elegir imagen',
      library: { type: 'image' },
      multiple: false,
      button: { text: 'Usar esta imagen' }
    });

    frame.on('select', function () {
      var attachment = frame.state().get('selection').first().toJSON();
      var previewUrl = attachment.url;
      if (attachment.sizes) {
        if (attachment.sizes.medium) {
          previewUrl = attachment.sizes.medium.url;
        } else if (attachment.sizes.thumbnail) {
          previewUrl = attachment.sizes.thumbnail.url;
        }
      }
      target.val(attachment.id);
      preview.html('<img src="' + previewUrl + '" alt="">');
    });

    frame.open();
  });
});
