function loadPdpSets() {
  const grid = document.querySelector('[data-sets-grid]');
  if (!grid) return;

  const sets = [
    {
      name: "Set Motion",
      image: "https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1",
      url: "index.html?name=SET+MOTION&view=product"
    },
    {
      name: "Set Power",
      image: "https://images.pexels.com/photos/863988/pexels-photo-863988.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1",
      url: "index.html?name=SET+POWER&view=product"
    },
    {
      name: "Set Urban",
      image: "https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1800&dpr=1",
      url: "index.html?name=SET+URBAN&view=product"
    }
  ];

  grid.innerHTML = sets.map(set => `
    <a href="${set.url}" style="text-decoration: none; color: inherit;">
      <img src="${set.image}" style="width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 8px;">
      <p style="font-size: 11px; margin-top: 8px; text-align: center; font-weight: bold;">${set.name}</p>
    </a>
  `).join('');
}

// Ejecutar cuando DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadPdpSets);
} else {
  loadPdpSets();
}

// Y también ejecutar después de un delay
setTimeout(loadPdpSets, 200);
