/**
 * Trust Bar Component
 * Automatic slider for mobile view
 */
(function() {
  'use strict';

  function initTrustBar() {
    const bars = document.querySelectorAll('.trust-bar');
    const mobileSliderMq = window.matchMedia('(max-width: 1024px)');

    bars.forEach(bar => {
      if (bar.dataset.trustBarInitialized === 'true') return;

      const track = bar.querySelector('.trust-bar__track');
      const items = bar.querySelectorAll('.trust-item');
      if (!track || items.length === 0) return;

      bar.dataset.trustBarInitialized = 'true';

      const viewport = bar.querySelector('.trust-bar__viewport');
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'trust-bar__dots';

      const dots = Array.from(items).map((_, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'trust-bar__dot';
        dot.setAttribute('aria-label', `Ir al slide ${index + 1}`);
        dot.addEventListener('click', () => {
          currentIndex = index;
          updateSlider();
          stopAutoPlay();
          startAutoPlay();
        });
        dotsWrap.appendChild(dot);
        return dot;
      });

      if (viewport) viewport.insertAdjacentElement('afterend', dotsWrap);

      let currentIndex = 0;
      let interval = null;
      const delay = 4000; // 4 seconds per slide

      function updateSlider() {
        if (mobileSliderMq.matches) {
          track.style.transform = `translateX(-${currentIndex * 100}%)`;
          dotsWrap.classList.add('is-visible');
          dots.forEach((dot, index) => {
            const isActive = index === currentIndex;
            dot.classList.toggle('is-active', isActive);
            dot.setAttribute('aria-current', isActive ? 'true' : 'false');
          });
        } else {
          track.style.transform = 'none';
          dotsWrap.classList.remove('is-visible');
        }
      }

      function nextSlide() {
        currentIndex = (currentIndex + 1) % items.length;
        updateSlider();
      }

      function startAutoPlay() {
        if (interval) return;
        interval = setInterval(nextSlide, delay);
      }

      function stopAutoPlay() {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }

      // Initialize autoplay only on mobile
      const handleResize = () => {
        if (mobileSliderMq.matches) {
          startAutoPlay();
          updateSlider();
        } else {
          stopAutoPlay();
          updateSlider();
        }
      };

      if (typeof mobileSliderMq.addEventListener === 'function') {
        mobileSliderMq.addEventListener('change', handleResize);
      } else if (typeof mobileSliderMq.addListener === 'function') {
        mobileSliderMq.addListener(handleResize);
      }
      handleResize(); // Initial check

      // Swipe support (basic)
      let touchStartX = 0;
      let touchEndX = 0;

      bar.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
      }, { passive: true });

      bar.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleGesture();
        startAutoPlay();
      }, { passive: true });

      function handleGesture() {
        if (touchEndX < touchStartX - 50) {
          // Swipe left
          currentIndex = (currentIndex + 1) % items.length;
        } else if (touchEndX > touchStartX + 50) {
          // Swipe right
          currentIndex = (currentIndex - 1 + items.length) % items.length;
        }
        updateSlider();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrustBar);
  } else {
    initTrustBar();
  }

  // Expuesta para que el page-builder la llame tras inyectar la sección
  // (el componente se inserta de forma async, después del DOMContentLoaded).
  window.initTrustBar = initTrustBar;
})();
