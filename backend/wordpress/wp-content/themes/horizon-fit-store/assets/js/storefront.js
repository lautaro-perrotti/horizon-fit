(function () {
  function setDrawerState(name, open) {
    var shell = document.querySelector('[data-drawer-shell="' + name + '"]');
    if (!shell) {
      return;
    }

    shell.hidden = !open;
    document.body.classList.toggle('hf-has-open-drawer', open);
  }

  function closeAllDrawers() {
    document.querySelectorAll('[data-drawer-shell]').forEach(function (shell) {
      shell.hidden = true;
    });
    document.body.classList.remove('hf-has-open-drawer');
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-drawer-open]');
    if (opener) {
      event.preventDefault();
      closeAllDrawers();
      setDrawerState(opener.getAttribute('data-drawer-open'), true);
      return;
    }

    if (event.target.closest('[data-drawer-close]')) {
      event.preventDefault();
      closeAllDrawers();
      return;
    }

    var shell = event.target.closest('[data-drawer-shell]');
    if (shell && !event.target.closest('.hf-drawer')) {
      closeAllDrawers();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeAllDrawers();
    }
  });

  document.querySelectorAll('[data-hf-gallery-thumb]').forEach(function (button) {
    button.addEventListener('click', function () {
      var container = button.closest('.hf-gallery');
      if (!container) {
        return;
      }

      var target = container.querySelector('[data-hf-gallery-target]');
      if (!target) {
        return;
      }

      container.querySelectorAll('[data-hf-gallery-thumb]').forEach(function (thumb) {
        thumb.classList.remove('is-active');
      });

      target.src = button.getAttribute('data-hf-gallery-thumb');
      target.alt = button.getAttribute('data-hf-gallery-alt') || target.alt;
      button.classList.add('is-active');
    });
  });

})();
