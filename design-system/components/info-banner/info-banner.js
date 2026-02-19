// Slider automático para mobile
(function() {
  const banner = document.querySelector('.info-banner');
  if (!banner) return;
  const items = banner.querySelectorAll('.info-item');
  if (items.length < 2) return;

  let current = 0;
  let interval = null;

  function showItem(idx) {
    items.forEach((item, i) => {
      item.style.transform = `translateX(-${idx * 100}%)`;
    });
  }

  function startSlider() {
    if (window.innerWidth > 600) return;
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      current = (current + 1) % items.length;
      showItem(current);
    }, 3000);
  }

  function stopSlider() {
    if (interval) clearInterval(interval);
    interval = null;
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 600) {
      startSlider();
    } else {
      stopSlider();
      showItem(0);
    }
  });

  if (window.innerWidth <= 600) {
    startSlider();
  }
})();
