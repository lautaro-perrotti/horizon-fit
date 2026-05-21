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

    const messages = Array.isArray(settings.messages) ? settings.messages : ['3 y 6 cuotas sin interés'];
    const speed = settings.speed || 20;

    // Update marquee speed
    marquee.setAttribute('data-speed', speed);
    marquee.style.setProperty('--marquee-speed', `${speed}s`);

    // Clear existing content
    const track = marquee.querySelector('.hf-marquee__track');
    if (!track) return;

    track.innerHTML = '';

    // Add messages
    messages.forEach((msg, index) => {
      // Main content
      const content = document.createElement('div');
      content.className = 'hf-marquee__content';
      const item = document.createElement('span');
      item.className = 'hf-marquee__item';
      item.textContent = msg;
      content.appendChild(item);
      track.appendChild(content);

      // Separator
      if (index < messages.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'hf-marquee__separator hf-marquee__separator--between';
        sep.setAttribute('aria-hidden', 'true');
        track.appendChild(sep);
      }
    });

    // Add duplicates for infinite loop (aria-hidden)
    messages.forEach((msg, index) => {
      const contentDupe = document.createElement('div');
      contentDupe.className = 'hf-marquee__content';
      contentDupe.setAttribute('aria-hidden', 'true');
      const itemDupe = document.createElement('span');
      itemDupe.className = 'hf-marquee__item';
      itemDupe.textContent = msg;
      contentDupe.appendChild(itemDupe);
      track.appendChild(contentDupe);

      if (index < messages.length - 1) {
        const sepDupe = document.createElement('span');
        sepDupe.className = 'hf-marquee__separator hf-marquee__separator--between';
        sepDupe.setAttribute('aria-hidden', 'true');
        track.appendChild(sepDupe);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initMarqueeLoader);
})();
