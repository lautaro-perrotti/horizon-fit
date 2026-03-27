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
