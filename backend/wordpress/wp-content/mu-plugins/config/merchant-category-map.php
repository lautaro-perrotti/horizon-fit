<?php
/**
 * Horizon Fit Merchant category map.
 *
 * Values use Google's public product taxonomy with IDs:
 * https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 *
 * Production catalog uses SKUs like 001-TOP-AZU / 001-TOP-AZU-S. The garment
 * type in the SKU is the source of truth when Woo categories are merchandising
 * groups (Básicos, Diseño) or when a garment is filed under the wrong slug
 * (Faldas currently live under Shorts).
 *
 * If a category cannot be confidently mapped, leave google_product_category
 * empty and the Merchant auditor will report it as unmapped instead of
 * inventing an ID.
 */

$garments = array(
    'calzas' => array(
        'product_type' => 'Ropa deportiva mujer > Calzas',
        'google_product_category' => '5322',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Activewear',
    ),
    'tops' => array(
        'product_type' => 'Ropa deportiva mujer > Tops',
        'google_product_category' => '212',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Shirts & Tops',
    ),
    'shorts' => array(
        'product_type' => 'Ropa deportiva mujer > Shorts',
        'google_product_category' => '207',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Shorts',
    ),
    'conjuntos' => array(
        'product_type' => 'Ropa deportiva mujer > Conjuntos',
        'google_product_category' => '7313',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Outfit Sets',
    ),
    'camperas' => array(
        'product_type' => 'Ropa deportiva mujer > Camperas',
        'google_product_category' => '5598',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
    ),
    'remeras' => array(
        'product_type' => 'Ropa deportiva mujer > Remeras',
        'google_product_category' => '212',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Shirts & Tops',
    ),
    'musculosas' => array(
        'product_type' => 'Ropa deportiva mujer > Musculosas',
        'google_product_category' => '212',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Shirts & Tops',
    ),
    'pantalones' => array(
        'product_type' => 'Ropa deportiva mujer > Pantalones',
        'google_product_category' => '204',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Pants',
    ),
    'faldas' => array(
        'product_type' => 'Ropa deportiva mujer > Faldas',
        'google_product_category' => '1581',
        'google_product_category_label' => 'Apparel & Accessories > Clothing > Skirts',
    ),
    'accesorios' => array(
        'product_type' => 'Accesorios deportivos',
        'google_product_category' => '167',
        'google_product_category_label' => 'Apparel & Accessories > Clothing Accessories',
    ),
);

return array(
    'categories' => $garments,
    'merchandising_slugs' => array('basicos', 'diseno', 'ofertas', 'uncategorized', 'sin-categorizar'),
    'sku_types' => array(
        'CAL' => $garments['calzas'],
        'TOP' => $garments['tops'],
        'SHO' => $garments['shorts'],
        'CAM' => $garments['camperas'],
        'FAL' => $garments['faldas'],
        'REM' => $garments['remeras'],
        'MUS' => $garments['musculosas'],
        'PAN' => $garments['pantalones'],
        'ACC' => $garments['accesorios'],
    ),
);
