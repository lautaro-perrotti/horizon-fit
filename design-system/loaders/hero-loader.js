// Loader para sección tipo: hero
(function() {
  const sectionData = {
    id: document.currentScript?.dataset.sectionId || null,
    data: document.currentScript?.dataset.sectionData ? JSON.parse(document.currentScript.dataset.sectionData) : {}
  };

  console.log('Loading hero section:', sectionData);

  // TODO: Implementar renderización para hero
  // Este es un placeholder que se expande según el tipo de sección
})();