// Loader para sección tipo: categorias
(function() {
  const sectionData = {
    id: document.currentScript?.dataset.sectionId || null,
    data: document.currentScript?.dataset.sectionData ? JSON.parse(document.currentScript.dataset.sectionData) : {}
  };

  console.log('Loading categorias section:', sectionData);

  // TODO: Implementar renderización para categorias
  // Este es un placeholder que se expande según el tipo de sección
})();