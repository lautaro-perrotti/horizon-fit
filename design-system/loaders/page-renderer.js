// Detecta la página actual y carga secciones desde API

(async function() {
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8089'
    : 'http://localhost:8089';

  // Detectar página slug del URL o usar 'home' por defecto
  let pageSlug = 'home';
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path.length > 0 && path[0] !== 'index.html') {
    pageSlug = path[0];
  }

  console.log('Page slug:', pageSlug);

  try {
    // Fetch las secciones desde API
    const response = await fetch(${ API_BASE }/wp-json/wp/v2/pages//sections);
    if (!response.ok) throw new Error(HTTP );

    const sections = await response.json();
    console.log('Sections loaded:', sections);

    // Renderizar cada sección
    const pageContent = document.getElementById('page-content') || document.body;

    for (const section of sections) {
      if (!section.visible) continue;

      console.log(Rendering section:  (order ));

      // Cargar el loader específico para este tipo de sección
      const loaderScript = document.createElement('script');
      loaderScript.src = design-system/loaders/-loader.js;
      loaderScript.dataset.sectionId = section.id;
      loaderScript.dataset.sectionData = JSON.stringify(section);

      document.head.appendChild(loaderScript);
    }
  } catch (error) {
    console.error('Error loading page sections:', error);
    // Fallback: cargar archivo estático como respaldo
    // document.body.innerHTML = '<h1>Error cargando página</h1>';
  }
})();
