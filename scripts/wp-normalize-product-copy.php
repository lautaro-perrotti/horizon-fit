<?php
/**
 * Normaliza descripciones y lavado/cuidado de productos Horizon Fit.
 *
 * Deja SIEMPRE un único párrafo en descripción y un único párrafo en lavado.
 *
 * Uso:
 *   docker cp scripts/wp-normalize-product-copy.php horizon-fit-wpcli:/tmp/wp-normalize-product-copy.php
 *   docker exec -e HF_DRY_RUN=1 horizon-fit-wpcli wp eval-file /tmp/wp-normalize-product-copy.php
 *   docker exec -e HF_DRY_RUN=0 horizon-fit-wpcli wp eval-file /tmp/wp-normalize-product-copy.php
 */

$dry_run = getenv('HF_DRY_RUN') !== '0';

function hf_normalize_copy_plain_text($value) {
  $value = html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $value = str_replace(['<br>', '<br/>', '<br />', "\r", "\n", '\\n'], ' ', $value);
  $value = preg_replace('/([.!?])n{2,}(?=[A-ZÁÉÍÓÚÑ])/u', '$1 ', $value);
  $value = preg_replace('/<\/?(p|div|li|ul|ol)[^>]*>/i', ' ', $value);
  $value = wp_strip_all_tags($value);
  $value = preg_replace('/\s+/u', ' ', $value);
  return trim($value);
}

function hf_normalize_copy_html($paragraph) {
  return '<p>' . esc_html($paragraph) . '</p>';
}

function hf_normalize_copy_sentences($value) {
  preg_match_all('/[^.!?]+[.!?]+|[^.!?]+$/u', $value, $matches);
  return array_values(array_filter(array_map('trim', $matches[0] ?? [])));
}

function hf_normalize_copy_html_with_breaks($paragraph, $sentences_per_block = 3) {
  $sentences = hf_normalize_copy_sentences($paragraph);
  if (count($sentences) <= $sentences_per_block) {
    return hf_normalize_copy_html($paragraph);
  }

  $blocks = [];
  for ($index = 0; $index < count($sentences); $index += $sentences_per_block) {
    $blocks[] = implode(' ', array_slice($sentences, $index, $sentences_per_block));
  }

  return '<p>' . implode("\n\n", array_map('esc_html', $blocks)) . '</p>';
}

$care_text = implode(' ', [
  'Para conservar el calce, el color y la suavidad, lavá la prenda con agua fría y jabón neutro, cuidando la tela para que mantenga su forma en cada uso.',
  'Su cuidado combina lavado delicado, separación de tonos y secado paciente para que puedas usarla tanto en entrenamiento como en momentos cotidianos sin afectar elasticidad, textura ni terminación.',
  'Evitá lavandina, remojos largos, secadora y calor directo; secala a la sombra, sin retorcer, y no planches logos, estampas o avíos para preservar el acabado.',
]);

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
  $description = hf_normalize_copy_plain_text($content);

  if ($description === '') {
    echo "Sin descripción para normalizar: {$product_id} | " . $product->get_name() . "\n";
    continue;
  }

  $description_html = hf_normalize_copy_html_with_breaks($description, 3);
  $care_json = wp_json_encode([
    'title' => 'Lavado y cuidado',
    'text' => $care_text,
    'bullets' => [],
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

  echo "Normalizado: {$product_id} | " . $product->get_name() . " | párrafos descripción: 1 | párrafos lavado: 1\n";

  if ($dry_run) {
    continue;
  }

  wp_update_post([
    'ID' => $product_id,
    'post_content' => $description_html,
  ]);
  update_post_meta($product_id, '_hf_care_json', wp_slash($care_json));
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
