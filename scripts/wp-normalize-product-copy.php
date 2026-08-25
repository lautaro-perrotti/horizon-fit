<?php
/**
 * Normaliza descripciones y lavado/cuidado de productos Horizon Fit.
 *
 * Uso:
 *   docker cp scripts/wp-normalize-product-copy.php horizon-fit-wpcli:/tmp/wp-normalize-product-copy.php
 *   docker exec -e HF_DRY_RUN=1 horizon-fit-wpcli wp eval-file /tmp/wp-normalize-product-copy.php
 *   docker exec -e HF_DRY_RUN=0 horizon-fit-wpcli wp eval-file /tmp/wp-normalize-product-copy.php
 */

$dry_run = getenv('HF_DRY_RUN') !== '0';

function hf_normalize_copy_plain_text($value) {
  $value = html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $value = wp_strip_all_tags($value);
  $value = preg_replace('/\s+/u', ' ', $value);
  return trim($value);
}

function hf_normalize_copy_sentences($value) {
  $text = hf_normalize_copy_plain_text($value);
  if ($text === '') {
    return [];
  }

  preg_match_all('/[^.!?]+[.!?]+|[^.!?]+$/u', $text, $matches);
  return array_values(array_filter(array_map('trim', $matches[0] ?? [])));
}

function hf_normalize_copy_paragraphs($value) {
  $value = trim((string) $value);
  if ($value === '') {
    return [];
  }

  if (preg_match_all('/<p\b[^>]*>(.*?)<\/p>/is', $value, $matches) && !empty($matches[1])) {
    $paragraphs = array_map('hf_normalize_copy_plain_text', $matches[1]);
    $paragraphs = array_values(array_filter($paragraphs));
    if (count($paragraphs) > 1) {
      return $paragraphs;
    }
  }

  $parts = preg_split('/\R{2,}/u', wp_strip_all_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $value)));
  $paragraphs = array_values(array_filter(array_map('hf_normalize_copy_plain_text', $parts ?: [])));
  if (count($paragraphs) > 1) {
    return $paragraphs;
  }

  $sentences = hf_normalize_copy_sentences($value);
  if (!$sentences) {
    return [];
  }

  if (count($sentences) < 3) {
    return [implode(' ', $sentences)];
  }

  $first_cut = max(1, (int) ceil(count($sentences) / 3));
  $second_cut = max($first_cut + 1, (int) ceil((count($sentences) * 2) / 3));

  return array_values(array_filter([
    implode(' ', array_slice($sentences, 0, $first_cut)),
    implode(' ', array_slice($sentences, $first_cut, $second_cut - $first_cut)),
    implode(' ', array_slice($sentences, $second_cut)),
  ]));
}

function hf_normalize_copy_html($paragraphs) {
  return implode("\n\n", array_map(static function($paragraph) {
    return '<p>' . esc_html($paragraph) . '</p>';
  }, $paragraphs));
}

$care_paragraphs = [
  'Para conservar el calce, el color y la suavidad, lavá la prenda con agua fría y jabón neutro, cuidando la tela para que mantenga su forma en cada uso.',
  'Su cuidado combina lavado delicado, separación de tonos y secado paciente para que puedas usarla tanto en entrenamiento como en momentos cotidianos sin afectar elasticidad, textura ni terminación.',
  'Evitá lavandina, remojos largos, secadora y calor directo; secala a la sombra, sin retorcer, y no planches logos, estampas o avíos para preservar el acabado.',
];

$products = wc_get_products([
  'status' => 'publish',
  'type' => ['simple', 'variable'],
  'limit' => -1,
  'return' => 'objects',
]);

echo 'Productos encontrados: ' . count($products) . "\n";
echo $dry_run ? "Modo prueba: no se escribe nada.\n" : "Modo escritura: se actualiza la base.\n";

foreach ($products as $product) {
  $product_id = $product->get_id();
  if (preg_match('/\bcopia\b/iu', $product->get_name() . ' ' . $product->get_slug())) {
    echo "Omitido copia: {$product_id} | " . $product->get_name() . "\n";
    continue;
  }

  $content = (string) get_post_field('post_content', $product_id, 'raw');
  $paragraphs = hf_normalize_copy_paragraphs($content);

  if (!$paragraphs) {
    echo "Sin descripción para normalizar: {$product_id} | " . $product->get_name() . "\n";
    continue;
  }

  $description_html = hf_normalize_copy_html($paragraphs);
  $care_json = wp_json_encode([
    'title' => 'Lavado y cuidado',
    'text' => implode("\n\n", $care_paragraphs),
    'bullets' => [],
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

  echo "Normalizado: {$product_id} | " . $product->get_name() . ' | párrafos descripción: ' . count($paragraphs) . "\n";

  if ($dry_run) {
    continue;
  }

  wp_update_post([
    'ID' => $product_id,
    'post_content' => $description_html,
  ]);
  update_post_meta($product_id, '_hf_care_json', $care_json);
}

if (!$dry_run) {
  if (function_exists('hf_regenerate_featured_products_cache')) {
    hf_regenerate_featured_products_cache();
  }
  if (function_exists('hf_regenerate_storefront_seo_cache')) {
    hf_regenerate_storefront_seo_cache();
  }
  echo "Caches regeneradas.\n";
}

echo "Listo.\n";
