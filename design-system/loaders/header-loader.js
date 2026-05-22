// Loader para sección tipo: header
(function() {
  const sectionData = {
    id: document.currentScript?.dataset.sectionId || null,
    data: document.currentScript?.dataset.sectionData ? JSON.parse(document.currentScript.dataset.sectionData) : {}
  };

  console.log('Loading header section:', sectionData);

  // TODO: Implementar renderización para header
  // Este es un placeholder que se expande según el tipo de sección
})();