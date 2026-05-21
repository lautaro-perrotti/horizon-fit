/**
 * Page Renderer
 * Carga y renderiza dinámicamente secciones de una página desde WordPress
 */

(function() {
  'use strict';

  // Detectar página actual desde URL
  function getCurrentPageSlug() {
    const path = window.location.pathname.toLowerCase();

    // Si es raíz o home
    if (path === '/' || path === '' || path === '/index.html') {
      return 'home';
    }

    // Extraer slug de la URL
    const segments = path.split('/').filter(s => s);
    return segments[0] || 'home';
  }

  async function initPageRenderer() {
    const pageSlug = getCurrentPageSlug();

    try {
      const sections = await HF.API.pageSections(pageSlug);

      if (!sections || sections.length === 0) {
        console.log(`No sections found for page: ${pageSlug}`);
        return;
      }

      // Ordenar por order (redundante pero seguro)
      sections.sort((a, b) => a.order - b.order);

      // Renderizar cada sección
      for (const section of sections) {
        if (!section.visible) {
          console.log(`Section ${section.id} (${section.type}) skipped (not visible)`);
          continue;
        }

        renderSection(section);
      }

      console.log(`Page sections loaded for "${pageSlug}":`, sections);
    } catch (error) {
      console.warn(`Failed to load page sections for "${pageSlug}"`, error);
    }
  }

  function renderSection(section) {
    const { id, type, settings } = section;

    switch (type) {
      case 'marquee':
        renderMarqueeSection(settings);
        break;
      case 'hero':
        renderHeroSection(settings);
        break;
      case 'productos':
        renderProductosSection(settings);
        break;
      case 'testimonios':
        renderTestimoniosSection(settings);
        break;
      case 'info_banner':
        renderInfoBannerSection(settings);
        break;
      default:
        console.warn(`Unknown section type: ${type}`);
    }
  }

  function renderMarqueeSection(settings) {
    // Marquee ya se renderiza via marquee-loader.js
    // Solo aseguramos que los datos estén disponibles
    if (HF.marqueeSettings) {
      HF.marqueeSettings = settings;
    }
  }

  function renderHeroSection(settings) {
    // Hero ya se renderiza via hero-loader.js
    // Solo aseguramos que los datos estén disponibles
    if (HF.heroSettings) {
      HF.heroSettings = settings;
    }
  }

  function renderProductosSection(settings) {
    // Placeholder para futuro loader de productos
    console.log('Productos section:', settings);
  }

  function renderTestimoniosSection(settings) {
    // Placeholder para futuro loader de testimonios
    console.log('Testimonios section:', settings);
  }

  function renderInfoBannerSection(settings) {
    // Placeholder para futuro loader de info banners
    console.log('Info banner section:', settings);
  }

  // Inicializar cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', initPageRenderer);
})();
