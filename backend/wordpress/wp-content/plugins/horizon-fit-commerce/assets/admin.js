jQuery(function ($) {
  // Uploader que guarda el ID del attachment (imágenes de colección/categoría).
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

  // Uploader que guarda la URL del attachment (style-edit/social-strip).
  // data-hf-media-url-type = "image" | "video" para filtrar la biblioteca.
  $(document).on('click', '[data-hf-media-url]', function (event) {
    event.preventDefault();

    var button = $(this);
    var target = $(button.data('hf-target'));
    var preview = $(button.data('hf-preview'));
    var type = button.data('hf-media-url-type') || 'image';

    var frame = wp.media({
      title: type === 'video' ? 'Elegir video' : 'Elegir imagen',
      library: { type: type },
      multiple: false,
      button: { text: 'Usar este archivo' }
    });

    frame.on('select', function () {
      var attachment = frame.state().get('selection').first().toJSON();
      target.val(attachment.url).trigger('change');
      if (preview.length) {
        if (type === 'video') {
          preview.html('<video src="' + attachment.url + '" muted loop style="max-width:140px;border-radius:6px;"></video>');
        } else {
          preview.html('<img src="' + attachment.url + '" alt="" style="max-width:140px;border-radius:6px;">');
        }
      }
    });

    frame.open();
  });
});
