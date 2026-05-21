/**
 * Hero Loader
 * Carga configuración del video hero desde WordPress
 */

(function() {
  'use strict';

  async function initHeroLoader() {
    try {
      const heroSettings = await HF.API.heroSettings();
      if (!heroSettings) {
        console.log('No hero settings found');
        return;
      }

      renderHero(heroSettings);
      console.log('Hero settings loaded:', heroSettings);
    } catch (error) {
      console.warn('Failed to load hero settings', error);
    }
  }

  function renderHero(settings) {
    const heroSection = document.querySelector('.hf-video-hero');
    if (!heroSection) {
      console.warn('No hero section found');
      return;
    }

    // Update video sources
    const videoMobile = settings.video_mobile;
    const videoDesktop = settings.video_desktop;

    if (videoMobile || videoDesktop) {
      const video = heroSection.querySelector('video');
      if (video) {
        const sources = video.querySelectorAll('source');
        sources.forEach(source => {
          const media = source.getAttribute('media');
          if (media && media.includes('max-width')) {
            source.setAttribute('src', videoMobile || '');
          } else {
            source.setAttribute('src', videoDesktop || '');
          }
        });
        // Reload video
        video.load();
      }
    }

    // Update title if provided
    if (settings.title) {
      const titleEl = heroSection.querySelector('.hf-video-hero__title');
      if (titleEl) {
        titleEl.textContent = settings.title;
      }
    }

    // Update buttons if provided
    const buttonsContainer = heroSection.querySelector('.hf-video-hero__buttons');
    if (settings.button1_text || settings.button2_text) {
      if (!buttonsContainer) {
        // Create buttons container if it doesn't exist
        const newContainer = document.createElement('div');
        newContainer.className = 'hf-video-hero__buttons';
        heroSection.querySelector('.hf-video-hero__content').appendChild(newContainer);
      }

      const container = heroSection.querySelector('.hf-video-hero__buttons');
      container.innerHTML = '';

      if (settings.button1_text && settings.button1_url) {
        const btn1 = document.createElement('a');
        btn1.href = settings.button1_url;
        btn1.className = 'hf-video-hero__button hf-video-hero__button--primary';
        btn1.textContent = settings.button1_text;
        container.appendChild(btn1);
      }

      if (settings.button2_text && settings.button2_url) {
        const btn2 = document.createElement('a');
        btn2.href = settings.button2_url;
        btn2.className = 'hf-video-hero__button hf-video-hero__button--secondary';
        btn2.textContent = settings.button2_text;
        container.appendChild(btn2);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initHeroLoader);
})();
