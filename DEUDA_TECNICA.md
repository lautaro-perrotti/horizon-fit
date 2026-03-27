# Deuda Técnica

## Badge de descuento en productos destacados

**Estado:** Omitido temporalmente
**Archivo afectado:** `design-system/components/product-item/product-item.css`
**Elemento:** `.hf-product-item__badge`

### Qué se hizo

Se ocultó el badge de descuento (ej: "50% OFF!") en mobile mediante:

```css
@media (max-width: 768px) {
  .hf-product-item__badge {
    display: none;
  }
}
```

### Por qué

Para mostrar productos sin descuento en la vista mobile sin eliminar el código, preservando la funcionalidad para cuando se necesite mostrar productos con descuento.

### Cómo reactivarlo

Cuando haya un producto con descuento para mostrar, simplemente eliminar o comentar la regla anterior. El HTML del badge ya está en cada `hf-product-item`:

```html
<span class="hf-product-item__badge">50% OFF!</span>
```

---

## Eyebrow del video hero

**Estado:** Omitido temporalmente
**Archivo afectado:** `index.html`
**Elemento:** `.hf-video-hero__eyebrow` dentro de `hf-video-hero__content`

### Nota

El texto informativo sobre cuotas y envíos está comentado en el video hero. Restaurar descomentando cuando se quiera mostrar:

```html
<p class="hf-video-hero__eyebrow">Recordá: 3 y 6 cuotas sin interés · envío gratis desde $150.000 · cambios fáciles</p>
```

---

## Padding vertical del navbar en mobile

**Estado:** No implementar salvo indicación explícita
**Archivo afectado:** `index.html`
**Elemento:** `.nav__inner` dentro de `@media (max-width: 768px)`

### Nota

Se guarda como referencia el valor con padding vertical por si se quiere dar más altura al navbar en mobile:

```css
@media (max-width: 768px) {
  .nav__inner {
    padding: 10px 16px !important;
  }
}
```

Actualmente está en `0px 16px`. No cambiar a menos que se indique explícitamente.
