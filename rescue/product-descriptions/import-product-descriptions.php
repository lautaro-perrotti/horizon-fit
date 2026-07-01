<?php

/**
 * Carga descripciones de producto Horizon Fit.
 *
 * Uso:
 *   HF_DRY_RUN=1 wp eval-file /tmp/import-product-descriptions.php
 *   HF_DRY_RUN=0 wp eval-file /tmp/import-product-descriptions.php
 */

$dry_run = getenv('HF_DRY_RUN') !== '0';

$color_notes = [
    'BLA' => 'En blanco, suma una estética limpia, luminosa y fácil de combinar.',
    'NEG' => 'En negro, mantiene una impronta versátil, urbana y siempre vigente.',
    'AZU' => 'En azul, aporta un toque deportivo fresco sin perder sobriedad.',
    'CEL' => 'En celeste, suma una nota suave y fresca para looks livianos.',
    'VER' => 'En verde, aporta personalidad y una energía natural al conjunto.',
    'ROJ' => 'En rojo, suma fuerza visual y un acento decidido al look.',
    'ROS' => 'En rosa, aporta un gesto femenino, suave y moderno.',
    'BOR' => 'En bordó, refuerza una estética elegante, profunda y sofisticada.',
];

$templates = [
    '001_TOP' => 'Diseñado para acompañar tus movimientos con total libertad, este top combina un calce estilizado con el soporte justo para entrenar o moverte durante el día. Su frente limpio y el detalle sutil del logo central aportan una estética sobria que eleva cualquier look deportivo. {color}',
    '001_SHO' => 'Este short biker está pensado para convertirse en un básico de todos los días. Su diseño minimalista, cómodo y fácil de combinar acompaña tanto entrenamientos como outfits urbanos, con un calce que permite moverte con libertad sin perder estilo. {color}',
    '001_CAL' => 'Una calza larga pensada para equilibrar rendimiento, comodidad y estilo urbano. Su calce acompaña la silueta de forma natural y brinda libertad para entrenar, caminar o resolver un look cómodo de fin de semana. {color}',
    '001_CAM' => 'Tu aliada para los momentos de movimiento, pre y post entrenamiento. Esta campera crop de calce slim acompaña el cuerpo sin incomodar, suma abrigo liviano y mantiene una estética deportiva pulida para usar dentro y fuera del gimnasio. {color}',

    '002_TOP' => 'El Top Tiras Blancas combina soporte, comodidad y un diseño con líneas en contraste que enmarcan la silueta con un toque moderno. Está pensado para entrenar con seguridad y también para armar looks relajados con identidad deportiva. {color}',
    '002_SHO' => 'Este short biker une comodidad, diseño y funcionalidad para moverse sin esfuerzo durante el día. Las tiras blancas en contraste le dan una estética moderna y deportiva, ideal para entrenar o para resolver un outfit urbano con carácter. {color}',
    '002_CAL' => 'Diseñada para ofrecer equilibrio entre soporte, comodidad y diseño, esta calza acompaña entrenamientos, caminatas y planes cotidianos. Sus líneas blancas en contraste estilizan la silueta y suman una impronta deportiva actual. {color}',

    '003_TOP' => 'Este top rústico combina una sensación suave con un diseño favorecedor y funcional. Su calce brinda soporte cómodo para moverte con libertad, mientras su estética relajada permite llevarlo tanto en entrenamiento como en looks casuales. {color}',
    '003_SHO' => 'Un short rústico de corte cómodo y fluido, pensado para acompañar entrenamientos livianos, descanso y planes cotidianos. Su cintura elástica se adapta al cuerpo sin apretar y sus líneas simples lo vuelven una prenda fácil de usar todos los días. {color}',
    '003_CAM' => 'La campera rústica une estética urbana y confort deportivo. Su silueta crop con cierre y capucha aporta abrigo liviano, mientras el calce relajado permite armar conjuntos cómodos, actuales y fáciles de llevar. {color}',

    '004_TOP' => 'Este top de un solo hombro combina diseño asimétrico y funcionalidad deportiva. Su banda inferior firme ayuda a brindar soporte durante el movimiento, mientras la silueta suma un gesto moderno y de alto impacto para entrenar o salir. {color}',
    '004_FAL' => 'La falda deportiva combina feminidad, estilo y libertad de movimiento. Su caída fluida con pliegues aporta dinamismo, mientras la pretina alta y anatómica acompaña la cintura con comodidad para entrenar, jugar o usar en un look casual. {color}',

    '005_TOP' => 'Este top de rejilla combina elegancia y rendimiento con un diseño texturizado que realza la silueta. Los detalles de microtul aportan frescura y una estética diferencial, ideal para entrenamientos y looks deportivos con presencia. {color}',
    '005_SHO' => 'Un short biker con diseño de rejilla pensado para elevar el outfit deportivo. Sus recortes de microtul aportan frescura y movimiento visual, mientras la pretina alta brinda un calce cómodo y seguro para acompañarte en cada actividad. {color}',
    '005_CAL' => 'Una calza de diseño protagonista, con paneles de microtul que estilizan visualmente la pierna y suman ventilación. Combina comodidad, soporte y una estética deportiva de alto impacto para entrenar o armar un look urbano. {color}',
];

$short_templates = [
    '001_TOP' => 'Top liso de calce cómodo y soporte medio, ideal para entrenar o usar todos los días.',
    '001_SHO' => 'Short biker liso, cómodo y versátil para entrenamiento y looks urbanos.',
    '001_CAL' => 'Calza larga lisa con calce cómodo, pensada para entrenar y moverte con libertad.',
    '001_CAM' => 'Campera lisa crop, liviana y funcional para pre y post entrenamiento.',
    '002_TOP' => 'Top con tiras blancas en contraste, soporte cómodo y estética deportiva moderna.',
    '002_SHO' => 'Short biker con tiras blancas, cómodo y fácil de combinar.',
    '002_CAL' => 'Calza con tiras blancas en contraste, soporte y diseño para todos los días.',
    '003_TOP' => 'Top rústico cómodo, suave y funcional para entrenar o usar en looks casuales.',
    '003_SHO' => 'Short rústico cómodo, liviano y versátil para moverte todos los días.',
    '003_CAM' => 'Campera rústica crop con cierre y capucha, cómoda y urbana.',
    '004_TOP' => 'Top asimétrico de un hombro, con soporte y diseño de alto impacto.',
    '004_FAL' => 'Falda deportiva de tiro alto, cómoda y con movimiento.',
    '005_TOP' => 'Top de rejilla con microtul, diseño diferencial y soporte cómodo.',
    '005_SHO' => 'Short biker de rejilla con pretina alta y detalles de microtul.',
    '005_CAL' => 'Calza de rejilla con paneles de microtul y calce cómodo.',
];

$map = [
    56 => ['001_TOP', 'NEG'],
    87 => ['001_TOP', 'CEL'],
    93 => ['001_TOP', 'VER'],
    99 => ['001_TOP', 'AZU'],
    114 => ['001_TOP', 'BLA'],
    186 => ['001_SHO', 'NEG'],
    195 => ['001_SHO', 'CEL'],
    205 => ['001_SHO', 'VER'],
    216 => ['001_SHO', 'BLA'],
    227 => ['001_SHO', 'AZU'],
    133 => ['001_CAL', 'NEG'],
    142 => ['001_CAL', 'VER'],
    154 => ['001_CAL', 'CEL'],
    162 => ['001_CAL', 'BLA'],
    172 => ['001_CAL', 'AZU'],
    237 => ['001_CAM', 'NEG'],
    248 => ['001_CAM', 'VER'],
    257 => ['001_CAM', 'BLA'],
    268 => ['001_CAM', 'AZU'],

    278 => ['003_TOP', 'ROJ'],
    288 => ['003_TOP', 'BLA'],
    298 => ['003_TOP', 'NEG'],
    308 => ['003_TOP', 'AZU'],
    318 => ['003_SHO', 'ROJ'],
    329 => ['003_SHO', 'BLA'],
    341 => ['003_SHO', 'AZU'],
    350 => ['003_SHO', 'NEG'],
    359 => ['003_CAM', 'NEG'],
    369 => ['003_CAM', 'ROJ'],
    375 => ['003_CAM', 'AZU'],
    389 => ['003_CAM', 'BLA'],

    400 => ['002_TOP', 'NEG'],
    410 => ['002_TOP', 'CEL'],
    420 => ['002_TOP', 'ROS'],
    429 => ['002_SHO', 'NEG'],
    438 => ['002_SHO', 'CEL'],
    448 => ['002_SHO', 'ROS'],
    454 => ['002_CAL', 'NEG'],
    463 => ['002_CAL', 'CEL'],
    477 => ['002_CAL', 'ROS'],

    536 => ['004_TOP', 'BOR'],
    544 => ['004_TOP', 'AZU'],
    548 => ['004_TOP', 'NEG'],
    552 => ['004_FAL', 'BOR'],
    560 => ['004_FAL', 'AZU'],
    568 => ['004_FAL', 'NEG'],

    487 => ['005_TOP', 'NEG'],
    496 => ['005_TOP', 'BLA'],
    506 => ['005_SHO', 'NEG'],
    518 => ['005_SHO', 'BLA'],
    510 => ['005_CAL', 'NEG'],
    527 => ['005_CAL', 'BLA'],
];

echo $dry_run ? "DRY RUN: no se escriben descripciones.\n" : "IMPORT REAL: se escriben descripciones.\n";

$updated = 0;

foreach ($map as $product_id => [$template_key, $color_key]) {
    $product = wc_get_product($product_id);
    if (!$product) {
        echo "NO EXISTE {$product_id}\n";
        continue;
    }

    $description = str_replace('{color}', $color_notes[$color_key] ?? '', $templates[$template_key]);
    $excerpt = $short_templates[$template_key] ?? '';

    echo "{$product_id} | {$product->get_name()} | {$template_key} {$color_key}\n";

    if (!$dry_run) {
        wp_update_post([
            'ID' => $product_id,
            'post_content' => $description,
            'post_excerpt' => $excerpt,
        ]);
        $updated++;
    }
}

if (!$dry_run) {
    if (function_exists('hf_regenerate_featured_products_cache')) {
        hf_regenerate_featured_products_cache();
    }
    if (function_exists('hf_regenerate_featured_sets_cache')) {
        hf_regenerate_featured_sets_cache();
    }
    if (function_exists('hf_regenerate_sections_cache')) {
        hf_regenerate_sections_cache();
    }
    if (function_exists('hf_regenerate_menu_cache')) {
        hf_regenerate_menu_cache();
    }
}

echo "Productos actualizados: {$updated}\n";
echo "Listo.\n";

