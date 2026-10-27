<?php
/**
 * Add the approved selective emphasis to the current WooCommerce product copy.
 *
 * Dry run:
 *   wp eval-file scripts/wp-apply-product-description-emphasis.php
 * Apply:
 *   HF_APPLY=1 wp eval-file scripts/wp-apply-product-description-emphasis.php
 *
 * The script is intentionally idempotent: descriptions that already contain
 * <strong> are left untouched.
 */

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run this file through WP-CLI.\n");
    exit(1);
}

$apply = getenv('HF_APPLY') === '1';

$rules = [
    'Top Dynamic' => [
        'El top Dynamic', 'Top liso negro', 'la base de tus looks más versátiles',
        'prendas que se adapten a su día a día', 'outfits que reflejen tu estilo personal',
        'practicidad sin renunciar a verse bien', 'del entrenamiento a un encuentro casual',
        'ese básico que usás una y otra vez', 'activewear diseñada para acompañarte en movimiento',
        'calce, suavidad y una estética cuidada', 'sostiene sin comprimir de más',
        'estética limpia, versátil y atemporal', 'sostener el ritmo del día',
    ],
    'Calza Dynamic' => [
        'La calza Dynamic', 'la aliada perfecta para quienes viven en movimiento',
        'desde la primera hora del día', 'en el entrenamiento y después salir a la calle',
        'la libertad de vestirte como quieras, cuando quieras',
        'una clase, una caminata o un día completo de actividades', 'se adapta a tu ritmo',
    ],
    'Short Dynamic' => [
        'libertad de movimiento', 'entrenamientos', 'actividades más relajadas',
        'looks frescos según la ocasión', 'conjuntos deportivos', 'propuestas más casuales',
        'Un short versátil', 'expresar tu estilo', 'acompañe el día a día',
    ],
    'Campera Dynamic' => [
        'La campera Dynamic', 'tanto en el gimnasio como en tu día a día',
        'para tu entrenamiento o todas tus actividades', 'un café, un paseo por la ciudad o una reunión informal',
        'la libertad de moverte con estilo', 'las posibilidades son infinitas',
        'se adaptan a tus planes',
    ],
    'Top Vanguard' => [
        'mucho más allá del gym', 'una pieza clave en tu estilo diario',
        'de una sesión de entrenamiento a un brunch', 'El top Vanguard',
        'comodidad y estilo al mismo tiempo', 'seguridad y frescura',
        'prendas versátiles', 'salidas espontáneas y looks simples con personalidad',
    ],
    'Short Vanguard' => [
        'activewear diseñada para acompañarte en movimiento',
        'calce, suavidad y una estética cuidada',
        'comodidad, frescura y libertad de movimiento', 'El modelo rústico',
        'una textura con más presencia visual', 'un carácter más urbano',
        'La podés combinar con otras prendas Horizon Fit',
        'sostener el ritmo del día',
    ],
    'Campera Vanguard' => [
        'La campera Vanguard', 'la aliada perfecta',
        'del entrenamiento a cualquier plan del día', 'la mañana activa', 'la tarde relajada',
        'salir a caminar, encontrarte con amigas o tomar un café después del gym',
        'practicidad y estilo', 'cómoda y con buena presencia',
    ],
    'Top Heaven' => [
        'El top Heaven', 'detalles en contraste blanco', 'ese comodín infaltable de tu día a día',
        'comodidad y estilo', 'encuentros informales o momentos de relax',
        'los entrenamientos más demandantes', 'del movimiento a la calle',
        'una tarde de salidas espontáneas',
    ],
    'Short Heaven' => [
        'El short Heaven', 'un diseño moderno con líneas de contraste',
        'un básico de tu día a día', 'comodidad y diseño',
        'salidas informales o momentos de descanso', 'los entrenamientos más exigentes',
        'moverte con libertad y lucir segura', 'una tarde de planes espontáneos',
    ],
    'Calza Heaven' => [
        'La calza Heaven', 'caída fluida y las líneas de contraste',
        'un esencial de tu rutina', 'comodidad y estilo', 'Su silueta flare',
        'salidas casuales o ratos de descanso', 'sesiones de entrenamiento intensas',
        'pasar de un plan a otro sin necesidad de cambiarte',
    ],
    'Top Destiny' => [
        'El top Destiny', 'une el entrenamiento con tu estilo diario',
        'detalles que marcan la diferencia', 'una sesión intensa',
        'encontrarte con amigas', 'del movimiento a cualquier plan',
        'una tarde de planes espontáneos',
    ],
    'Calza Destiny' => [
        'La calza Destiny', 'su corte moderno', 'fluye con cada uno de tus movimientos',
        'un básico infaltable de tu rutina diaria', 'confort y mucha onda',
        'una salida relajada con amigas', 'tus rutinas físicas más intensas',
        'cambiar de un plan a otro manteniendo el mismo estilo',
    ],
    'Short Destiny' => [
        'El short Destiny', 'un diseño fresco', 'un básico de tu día a día',
        'comodidad y frescura', 'salidas informales o momentos de descanso',
        'los entrenamientos más exigentes', 'moverte con total libertad y lucir natural',
        'una tarde de planes espontáneos',
    ],
    'Top Zenith' => [
        'La falda Zenith', 'esa prenda clave que conecta tu entrenamiento con el resto del día',
        'una clase intensa', 'compartir un café con amigas', 'disfrutar un rato libre',
        'Su gran versatilidad', 'una mañana activa', 'una tarde improvisada por la ciudad',
    ],
    'Falda Zenith' => [
        'La falda Zenith', 'esa prenda que conecta tu entrenamiento con el resto del día',
        'Su diseño versátil fluye con vos', 'un entrenamiento intenso',
        'un café con amigas', 'disfrutar un rato libre', 'la pieza clave',
        'lista para entrenar', 'dispuesta a disfrutar del resto de tu día',
    ],
];

function hf_emphasis_replace_once($html, $phrase, $token)
{
    $position = strpos($html, $phrase);
    if ($position === false) {
        return [$html, false];
    }

    return [substr_replace($html, $token, $position, strlen($phrase)), true];
}

$product_ids = get_posts([
    'post_type'      => 'product',
    'post_status'    => 'publish',
    'posts_per_page' => -1,
    'fields'         => 'ids',
    'orderby'        => 'title',
    'order'          => 'ASC',
]);

$changed = 0;
$already_done = 0;
$unmatched = [];

foreach ($product_ids as $product_id) {
    $name = get_the_title($product_id);
    $html = (string) get_post_field('post_content', $product_id, 'raw');

    if (stripos($html, '<strong') !== false || stripos($html, '<b>') !== false) {
        $already_done++;
        continue;
    }

    $phrases = null;
    foreach ($rules as $prefix => $candidate_phrases) {
        if (stripos($name, $prefix) === 0) {
            $phrases = $candidate_phrases;
            break;
        }
    }

    if (!$phrases || trim(wp_strip_all_tags($html)) === '') {
        $unmatched[] = $name;
        continue;
    }

    usort($phrases, static function ($a, $b) {
        return strlen($b) <=> strlen($a);
    });

    $tokens = [];
    foreach ($phrases as $index => $phrase) {
        $token = '%%HF_EMPHASIS_' . $product_id . '_' . $index . '%%';
        [$html, $replaced] = hf_emphasis_replace_once($html, $phrase, $token);
        if ($replaced) {
            $tokens[$token] = '<strong>' . esc_html($phrase) . '</strong>';
        }
    }

    if (!$tokens) {
        $unmatched[] = $name;
        continue;
    }

    $html = strtr($html, $tokens);
    $changed++;
    WP_CLI::log(sprintf('%s: %d énfasis', $name, count($tokens)));

    if ($apply) {
        wp_update_post([
            'ID'           => $product_id,
            'post_content' => wp_kses_post($html),
        ]);
    }
}

if ($apply && function_exists('hf_regenerate_featured_products_cache')) {
    hf_regenerate_featured_products_cache();
}

WP_CLI::log(sprintf(
    'Modo: %s. Productos preparados: %d. Ya configurados: %d. Sin coincidencia: %d.',
    $apply ? 'APLICACIÓN' : 'SIMULACIÓN',
    $changed,
    $already_done,
    count($unmatched)
));

if ($unmatched) {
    WP_CLI::warning('Sin coincidencia: ' . implode(', ', $unmatched));
}

if (!$apply) {
    WP_CLI::success('Simulación terminada. Ejecutá con HF_APPLY=1 para guardar.');
} else {
    WP_CLI::success('Descripciones y caché de productos actualizadas.');
}
