<?php
/**
 * Páginas de información (links del footer) con contenido HTML editable.
 * Lista fija de páginas (ayuda + legales). Cada una: título + HTML.
 * Se guarda en la option `hf_info_pages` y se cachea en info-pages.json,
 * que el page-builder lee para rellenar el cuerpo de cada página.
 */

if (!defined('ABSPATH')) {
    exit;
}

// Lista fija de páginas: slug => [title, description]. El content lo carga el
// usuario desde el panel. El slug es también la ruta del SPA (/slug/).
function hf_info_pages_defaults() {
    return [
        'envios-y-entregas' => [
            'title' => 'Envíos y entregas',
            'description' => 'Conocé cómo preparamos, despachamos y entregamos tu compra de Horizon Fit en Argentina.',
            'content' => '<h2>Envíos a todo el país</h2><p>Realizamos envíos dentro de Argentina. El costo y las opciones disponibles se informan durante el checkout, antes de confirmar el pago.</p><h2>Costos y opciones</h2><p>El costo y las opciones disponibles se informan durante el checkout, antes de confirmar el pago.</p><h2>Preparación y seguimiento</h2><p>Una vez acreditado el pago, preparamos el pedido y enviamos la información de seguimiento al correo indicado en la compra. Los plazos pueden variar según el destino, el operador logístico y fechas de alta demanda.</p><h2>Datos de entrega</h2><p>Revisá que nombre, teléfono, código postal y dirección estén completos. Si detectás un error, escribinos por WhatsApp al +54 11 3115-0999 antes del despacho.</p>',
        ],
        'cambios-y-devoluciones' => [
            'title' => 'Cambios y devoluciones',
            'description' => 'Consultá los plazos y condiciones para cambios y devoluciones de compras realizadas en Horizon Fit.',
            'content' => '<h2>Cambios</h2><p>Podés solicitar un cambio dentro de los 6 meses posteriores a la compra. La prenda debe conservar sus etiquetas, no presentar señales de uso, lavado, manchas, olores ni alteraciones.</p><h2>Devoluciones</h2><p>Podés solicitar la devolución dentro de los 15 días posteriores a la recepción. Antes de enviar una prenda, contactanos para registrar el caso y recibir las instrucciones correspondientes.</p><h2>Cómo iniciar una solicitud</h2><p>Escribinos por WhatsApp al +54 11 3115-0999 e indicá el número de pedido, la prenda y el motivo. Si el producto llegó dañado o no corresponde con la compra, adjuntá fotografías para que podamos revisarlo.</p><h2>Reintegros</h2><p>Cuando corresponda un reintegro, se procesa por el medio disponible para la operación original. Los tiempos de acreditación finales dependen de la entidad emisora o plataforma de pago.</p>',
        ],
        'guia-de-talles' => [
            'title' => 'Guía de talles',
            'description' => 'Aprendé a tomar tus medidas y elegí el talle de activewear Horizon Fit que mejor se adapte a vos.',
            'content' => '<h2>Cómo elegir tu talle</h2><p>Usá una cinta métrica flexible y tomá las medidas sobre el cuerpo, sin ajustar de más. Comparalas con la tabla disponible en la ficha del producto cuando esa prenda cuente con medidas específicas.</p><h2>Busto</h2><p>Medí alrededor de la parte más amplia del busto, manteniendo la cinta paralela al piso.</p><h2>Cintura</h2><p>Medí el contorno de la zona más angosta del torso, respirando con normalidad.</p><h2>Cadera</h2><p>Medí alrededor de la parte más amplia de la cadera y los glúteos, con los pies juntos.</p><h2>Entre dos talles</h2><p>El calce puede variar según el modelo y la elasticidad de la tela. Si dudás entre dos talles, escribinos por WhatsApp al +54 11 3115-0999 con tus medidas y el nombre de la prenda.</p>',
        ],
        'medios-de-pago' => [
            'title' => 'Medios de pago',
            'description' => 'Conocé los medios de pago, las cuotas sin interés y el beneficio por transferencia de Horizon Fit.',
            'content' => '<h2>Tarjetas</h2><p>Podés pagar con tarjetas habilitadas mediante Payway o Mercado Pago. Las opciones definitivas se muestran en el checkout.</p><h2>Cuotas sin interés</h2><p><strong>Ofrecemos 3 y 6 cuotas sin interés.</strong></p><p>La disponibilidad puede depender de la tarjeta, el banco y la aprobación del proveedor de pagos.</p><h2>Transferencia bancaria</h2><p>Cuando esta opción esté disponible, el checkout muestra el importe final y las instrucciones necesarias para completar la operación. El pedido se prepara después de acreditar el pago.</p><h2>Seguridad</h2><p>Horizon Fit no almacena los datos completos de tu tarjeta. El procesamiento se realiza a través de las plataformas de pago habilitadas.</p>',
        ],
        'terminos' => [
            'title' => 'Términos y condiciones',
            'description' => 'Términos de compra, disponibilidad, pagos, envíos, cambios y uso del sitio web de Horizon Fit.',
            'content' => '<h2>Uso del sitio</h2><p>Al navegar o comprar en Horizon Fit aceptás estos términos y las políticas informadas en el sitio. La información del catálogo puede actualizarse para reflejar disponibilidad, precios y características de los productos.</p><h2>Precios y pedidos</h2><p>Los precios se expresan en pesos argentinos. Un pedido queda confirmado cuando el pago es aprobado y la operación es aceptada. Si se detecta un error evidente de precio, stock o publicación, nos comunicaremos antes de continuar.</p><h2>Pagos</h2><p>Los medios, promociones y cuotas disponibles se muestran durante el checkout. Las operaciones están sujetas a validación por parte del proveedor de pagos y la entidad emisora.</p><h2>Envíos, cambios y devoluciones</h2><p>Las opciones de envío, costos y plazos disponibles se muestran durante el checkout. Los cambios pueden solicitarse dentro de los 6 meses y las devoluciones dentro de los 15 días, respetando las condiciones publicadas en las páginas correspondientes.</p><h2>Contacto</h2><p>Para consultas sobre una compra, escribinos por WhatsApp al +54 11 3115-0999.</p>',
        ],
        'privacidad' => [
            'title' => 'Política de privacidad',
            'description' => 'Conocé qué datos utiliza Horizon Fit, para qué se procesan y cómo podés ejercer tus derechos de privacidad.',
            'content' => '<h2>Datos que recopilamos</h2><p>Para procesar compras podemos solicitar nombre, correo electrónico, teléfono, documento y datos de entrega y facturación. También se generan datos técnicos básicos de navegación, seguridad y funcionamiento del sitio.</p><h2>Para qué usamos la información</h2><p>Utilizamos los datos para gestionar pedidos, pagos, entregas, cambios, atención al cliente, prevención de fraude y mejora del servicio. Las novedades comerciales por correo sólo se envían cuando brindás tu consentimiento.</p><h2>Proveedores</h2><p>Compartimos únicamente la información necesaria con servicios que intervienen en la operación, como WooCommerce, Payway, Mercado Pago, operadores logísticos y proveedores de infraestructura y seguridad.</p><h2>Conservación y seguridad</h2><p>Conservamos la información durante el tiempo necesario para prestar el servicio y cumplir obligaciones aplicables. Aplicamos medidas razonables para evitar accesos, pérdidas o usos no autorizados.</p><h2>Tus derechos</h2><p>Podés solicitar acceso, actualización o eliminación de tus datos escribiendo por WhatsApp al +54 11 3115-0999.</p><h2>Cookies</h2><p>El sitio puede usar cookies necesarias para mantener el carrito, la sesión, la seguridad y las preferencias. Los servicios de terceros pueden utilizar tecnologías equivalentes conforme a sus propias políticas.</p>',
        ],
        'defensa-al-consumidor' => [
            'title' => 'Defensa al consumidor',
            'description' => 'Información y canales de atención para consumidores que compran productos en la tienda online Horizon Fit.',
            'content' => '<h2>Atención al cliente</h2><p>Si tenés una consulta o inconveniente con una compra, escribinos por WhatsApp al +54 11 3115-0999. Indicá el número de pedido y una descripción clara para que podamos ayudarte.</p><h2>Información de la compra</h2><p>Antes de confirmar el pedido podés revisar productos, cantidades, precios, descuentos, envío y medio de pago. Conservá la confirmación y el número de orden.</p><h2>Canales oficiales</h2><p>También podés consultar información y realizar gestiones en el <a href="https://www.argentina.gob.ar/produccion/consumidor" target="_blank" rel="noopener noreferrer">portal oficial de Defensa del Consumidor</a>.</p>',
        ],
        'quienes-somos' => [
            'title' => 'Quiénes somos',
            'description' => 'Conocé Horizon Fit, una propuesta argentina de activewear funcional pensada para entrenar y vivir en movimiento.',
            'content' => '<h2>Más allá de tus horizontes</h2><p>Horizon Fit nace para crear activewear funcional, cómodo y fácil de combinar. Diseñamos una propuesta que acompaña entrenamientos, rutinas cotidianas y momentos de movimiento.</p><p>Trabajamos cada colección como un sistema de prendas y colores que permite armar conjuntos completos o elegir piezas individuales. Buscamos que la experiencia sea clara desde la elección del producto hasta la entrega.</p><h2>Estamos para ayudarte</h2><p>Si necesitás orientación sobre talles, combinaciones o una compra, escribinos por WhatsApp al +54 11 3115-0999.</p>',
        ],
        'contacto' => [
            'title' => 'Contacto',
            'description' => 'Contactate con Horizon Fit por WhatsApp y recibí ayuda sobre productos, talles, pedidos, pagos o entregas.',
            'content' => '<h2>¿Necesitás ayuda?</h2><p>Escribinos por WhatsApp al <a href="https://wa.me/541131150999" target="_blank" rel="noopener noreferrer">+54 11 3115-0999</a>. Nuestro horario de atención es de lunes a viernes de 9 a 18 h.</p><h2>Consultas sobre pedidos</h2><p>Para que podamos ayudarte más rápido, indicá el número de pedido y contanos si la consulta está relacionada con un producto, talle, pago, entrega, cambio o devolución.</p><h2>Redes sociales</h2><p>También podés encontrarnos en Instagram, TikTok y Facebook desde los enlaces oficiales del pie del sitio.</p>',
        ],
        'preguntas-frecuentes' => [
            'title' => 'Preguntas frecuentes',
            'description' => 'Respuestas sobre talles, pagos, cuotas, envíos, cambios y seguimiento de pedidos de Horizon Fit.',
            'content' => '<h2>¿Cómo elijo mi talle?</h2><p>Consultá la guía de talles y la información específica de cada producto. Si seguís con dudas, escribinos con tus medidas y el nombre de la prenda.</p><h2>¿Qué cuotas están disponibles?</h2><p>Ofrecemos 3 y 6 cuotas sin interés, sujeto a las tarjetas y medios habilitados en el checkout.</p><h2>¿Cómo se calcula el envío?</h2><p>Las opciones de envío, costos y plazos disponibles se muestran durante el checkout.</p><h2>¿Cómo sigo mi pedido?</h2><p>Después del despacho enviamos la información de seguimiento al correo utilizado en la compra.</p><h2>¿Cuánto tiempo tengo para cambiar una prenda?</h2><p>Podés solicitar un cambio dentro de los 6 meses o una devolución dentro de los 15 días, respetando las condiciones publicadas.</p>',
        ],
    ];
}

// Devuelve las páginas con su contenido guardado mezclado con los defaults.
// Estructura: slug => ['title', 'description', 'content'].
function hf_info_pages_get() {
    $defaults = hf_info_pages_defaults();
    $saved = get_option('hf_info_pages', []);
    $saved = is_array($saved) ? $saved : [];

    $out = [];
    foreach ($defaults as $slug => $def) {
        $s = isset($saved[$slug]) && is_array($saved[$slug]) ? $saved[$slug] : [];
        $saved_content = trim((string) ($s['content'] ?? ''));

        // Reemplazar solamente versiones heredadas que contradicen las
        // políticas comerciales vigentes. El contenido personalizado que ya
        // utiliza los importes y plazos actuales continúa siendo editable.
        $has_legacy_policy = false;
        if ('envios-y-entregas' === $slug) {
            $has_legacy_policy = false !== stripos($saved_content, '$40.000')
                || false !== stripos($saved_content, '$150.000')
                || false !== stripos($saved_content, 'Retira gratis')
                || false !== stripos($saved_content, 'retiro en nuestras tiendas');
        } elseif ('cambios-y-devoluciones' === $slug) {
            $has_legacy_policy = '' !== $saved_content
                && (false === stripos($saved_content, '6 meses') || false === stripos($saved_content, '15 días'));
        } elseif ('medios-de-pago' === $slug) {
            $has_legacy_policy = false !== stripos($saved_content, '$60.000')
                || false !== stripos($saved_content, '6 cuotas sin interés desde $150.000');
        } elseif ('terminos' === $slug || 'preguntas-frecuentes' === $slug) {
            $has_legacy_policy = false !== stripos($saved_content, '$150.000');
        }

        if ($has_legacy_policy) {
            $saved_content = '';
        }

        $out[$slug] = [
            'title'       => ($s['title'] ?? '') !== '' ? $s['title'] : $def['title'],
            'description' => ($s['description'] ?? '') !== '' ? $s['description'] : $def['description'],
            'content'     => '' !== $saved_content ? $saved_content : ($def['content'] ?? ''),
        ];
    }
    return $out;
}

// Genera /uploads/horizon-fit-cache/info-pages.json con formato
// { "/slug": { title, description, content } } (la clave incluye la barra
// inicial para que matchee el path del page-builder).
function hf_regenerate_info_pages_cache() {
    if (!function_exists('hf_featured_products_cache_path')) {
        return;
    }
    $pages = hf_info_pages_get();
    $data = [];
    foreach ($pages as $slug => $page) {
        $data['/' . $slug] = $page;
    }
    $cache_file = dirname(hf_featured_products_cache_path()) . '/info-pages.json';
    hf_featured_products_write_cache($cache_file, $data);
}

// Asegurar que el JSON exista al arrancar (con los defaults si nunca se guardó).
add_action('init', function () {
    if (function_exists('hf_featured_products_cache_path')) {
        $cache_file = dirname(hf_featured_products_cache_path()) . '/info-pages.json';
        if (!file_exists($cache_file)) {
            hf_regenerate_info_pages_cache();
        }
    }
}, 25);
