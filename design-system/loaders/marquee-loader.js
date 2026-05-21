/**
 * Marquee Loader
 * Carga configuración del marquee desde WordPress
 */

(function() {
  'use strict';

  async function initMarqueeLoader() {
    try {
      const marqueeSettings = await HF.API.marqueeSettings();
      if (!marqueeSettings) {
        console.log('No marquee settings found');
        return;
      }

      renderMarquee(marqueeSettings);
      console.log('Marquee loaded:', marqueeSettings);
    } catch (error) {
      console.warn('Failed to load marquee settings', error);
    }
  }

  function renderMarquee(settings) {
    const marquee = document.querySelector('[data-hf="marquee"]');
    if (!marquee) {
      console.warn('No marquee element found');
      return;
    }

    const text = settings.text || '3 y 6 cuotas sin interés';
    const speed = settings.speed || 20;

    // Update marquee speed
    marquee.setAttribute('data-speed', speed);
    marquee.style.setProperty('--marquee-speed', `${speed}s`);

    // Update text content
    const items = marquee.querySelectorAll('.hf-marquee__item');
    items.forEach(item => {
      item.textContent = text;
    });
  }

  document.addEventListener('DOMContentLoaded', initMarqueeLoader);
})();
