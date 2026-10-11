# Horizon Control — sistema visual "Dusk"

Sala de control interna de Horizon Fit. Una sola tienda, Tailscale, desktop 1440–1920. Se abre a la mañana para responder cinco preguntas — cómo vamos, qué cambió, qué está mal, qué funciona, qué hacer hoy — y entrar a un SKU o a una oportunidad.

Canvas de diseño (22 artboards): https://claude.ai/artifact/A3V4x6F8jbWSvEaQiR5LWa

## Principios

1. **Un dato o su razón.** Cada bloque sale de un SourceSlice. Si el dato no está, se dice por qué y dónde se arregla. Nunca `$0` cuando hay `null`; sin pedidos se escribe "Sin pedidos".
2. **Una acción, un color.** El azul horizonte marca solo lo que se puede tocar y hacer.
3. **Una pregunta por pantalla.** El rail enseña el modelo mental: Decidir → Producto → Demanda → Plata → Sistema.
4. **Integrar, no reconstruir.** GA4, Search Console, Woo y Merchant se leen y se linkean; no se clonan.

## Color

Tokens en `tokens.css`. `data-theme="dusk"` (default) o `"dawn"` en `<html>`; los nombres no cambian.

| Token | Dusk | Dawn | Uso |
| --- | --- | --- | --- |
| `--bg` | `#0C0820` | `#FBF3E8` | fondo (noche índigo de la marca / crema de la tienda) |
| `--s1` `--s2` `--s3` | `#130E2B` `#1B1540` `#251C55` | `#FFFDF9` `#F4E9DB` `#EADCCB` | superficies: la profundidad sale del cambio de superficie |
| `--sel` | `#2A1E63` | `#EBE1F7` | fila / opción seleccionada (violeta de marca levantado) |
| `--ink` … `--ink-4` | `#FBF3E8` al 100/76/56/34 % | `#0B0B0F` al 100/76/60/38 % | texto; la tinta Dusk es el crema de la tienda |
| `--act` | `#758AFD` | `#3F57E8` | **única** acción (accent de Horizon Fit) |
| `--ok` | `#A9C66A` | `#4A7A16` | ok (verde de marca desaturado) |
| `--warn` | `#E6B05A` | `#8F5A00` | warning, bajas, stale |
| `--bad` | `#F2704A` | `#C2401A` | crítico (coral de marca) |
| `--join` | `#A592F2` | `#5B3FC4` | sin join / inferido |
| `--glow` | coral → violeta | | línea de horizonte, una vez por pantalla (bajo la topbar, login) |

Sombras solo en el monitor del sitio y en la paleta. Todo lo demás: hairline (`--hair`, `--line`) y superficie.

## Tipografía

- **Archivo Narrow 700** (`.disp`): cifras y titulares, estilo marcador. Nunca párrafos.
- **Archivo 400–700**: UI, 13,5 px base. `font-variant-numeric: tabular-nums` en toda la app.
- **Mono del sistema** (`.mono`): SKUs, ids de reglas, tipos de oportunidad.
- Labels (`.lbl`): 10,5 px, mayúsculas, tracking 0,09 em.

Fuentes de `TIPOGRAFIAS/` subseteadas a woff2 en `fonts/` (SIL OFL, ver `fonts/NOTICE`).

## SourceSlice → chip

`ui/components.js · chip(status)`. Cada estado cambia color **y** forma del punto, para no depender solo del color.

| Estado | Texto | Forma |
| --- | --- | --- |
| `ok` | ok | punto lleno verde |
| `zero` | cero | punto hueco neutro — respondió y no hay nada |
| `unknown` | desconocido | punto hueco, borde punteado |
| `not_configured` | sin configurar | guion, borde rayado — falta una clave; nunca esqueleto falso |
| `error` | error | rombo coral — se muestra el último dato si existe |
| `stale` | viejo | punto hueco ámbar — dato vencido con aviso |
| `not_joined` | sin join | cuadrado hueco violeta — "este SKU no matchea X todavía" |
| `loading` | cargando | punto que late |
| `session` (401) | sesión vencida | borde ámbar — entrar de nuevo vuelve a la misma vista |
| `scope` (403) | falta scope | cuadrado, borde — "se habilita en Auth0, no acá" |

## Componentes

| Componente | Archivo | Contrato |
| --- | --- | --- |
| AppShell | `index.html`, `ui/shell.js` | rail 224 px (64 colapsado, tecla `[`), topbar 53 px con ventana global, pulso y Ctrl/⌘K/J; Consulta 380 px empuja el contenido |
| Registro de vistas | `core/views.js` | una entrada por pantalla: ruta, grupo, label, ícono, herramientas, tecla `g`+x |
| SliceChip / pip | `ui/components.js` | estados de arriba; severidad critical/warning/info |
| Money / Delta | `core/format.js` | Intl es-AR; `money(v, {orders})`; bajas en ámbar, crítico en coral |
| ScoreBreakdown | `ui/components.js` | barra de aportes + tabla de los 8 componentes (peso base, usado, valor, aporte, por qué); lo que falta sale del cálculo y los pesos se renormalizan |
| OpportunityRow | `views/hoy.js`, `views/oportunidades.js` | severidad · tipo humano + id mono · SKU · producto · score. PRICE_OUTLIER es un hecho, nunca "bajá el precio" |
| ProductHeader + JoinRail | `views/producto.js` | foto, precio, talles con stock, 7 joins con confianza (exacto/inferido/sin join) y frescura |
| SourceEmpty | `ui/components.js · empty / notConfigured / errorState` | qué falta · dónde se arregla · id del motivo en mono |
| Chart | `ui/chart.js` | ECharts vendorizado; colores desde tokens; días sin observación quedan como hueco (`connectNulls: false`) |

## Teclado

`Ctrl/⌘K` paleta (SKU, vistas, acciones) · `Ctrl/⌘J` Consulta · `g` + tecla de la vista · `[` colapsar rail · `/` buscar en la vista.

## No hacer

- Grillas de cards idénticas "número grande + label".
- "Source: commerce.sales · Woo REST" visible en cada bloque: la fuente va en el chip y su tooltip.
- Gasto de Ads, rivales o métricas inventadas.
- Escribir en horizonfit.com.ar: lo aprobado en Contenido se copia a mano.
- Scripts inline (la CSP los bloquea): todo JS va en archivos.
