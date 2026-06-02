/**
 * Page Renderer — Cargar secciones dinámicamente desde WordPress
 */

const PAGE_RENDERER = (() => {
  const baseUrl = 'http://localhost:8089';
  const loadedScripts = {};

  const getPageSlug = () => {
    const path = window.location.pathname;
    if (path === '/' || path === '') return 'home';
    return path.replace(/^\/+|\/+$/g, '').split('/')[0] || 'home';
  };

  const fetchSections = async (slug) => {
    try {
      const url = baseUrl + '/wp-json/wp/v2/pages/' + slug + '/sections';
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) {
        console.warn('Sections fetch failed');
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('Sections fetch error:', error);
      return null;
    }
  };

  const loadSectionComponent = async (type) => {
    try {
      const path = 'design-system/components/' + type + '/' + type + '.html';
      const response = await fetch(path);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.error('Failed to load ' + type + ' component:', error);
    }
    return '';
  };

  const loadLoaderScript = (type) => {
    return new Promise((resolve) => {
      const loaderPath = 'design-system/loaders/' + type + '-loader.js';

      if (loadedScripts[loaderPath]) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = loaderPath;
      script.onload = () => {
        loadedScripts[loaderPath] = true;
        resolve();
      };
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  };

  const renderSection = async (section) => {
    const { type, settings = {} } = section;

    const componentHtml = await loadSectionComponent(type);
    if (!componentHtml) return null;

    const container = document.createElement('div');
    container.innerHTML = componentHtml;
    const sectionElement = container.firstElementChild;

    await loadLoaderScript(type);

    const loaderName = type.toUpperCase() + '_LOADER';
    if (window[loaderName] && window[loaderName].init) {
      window[loaderName].init(sectionElement, section);
    }

    return sectionElement;
  };

  const init = async () => {
    const slug = getPageSlug();
    console.log('Rendering page: ' + slug);

    let sections = await fetchSections(slug);

    if (!sections) {
      console.error('No sections found');
      return;
    }

    sections = sections.sort((a, b) => (a.order || 0) - (b.order || 0));
    console.log('Found ' + sections.length + ' sections');

    const pageContent = document.getElementById('page-content');
    if (!pageContent) {
      console.error('#page-content not found');
      return;
    }

    for (const section of sections) {
      if (section.visible === false) continue;
      const rendered = await renderSection(section);
      if (rendered) {
        pageContent.appendChild(rendered);
      }
    }

    console.log('Page rendered');
  };

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PAGE_RENDERER.init());
} else {
  PAGE_RENDERER.init();
}
