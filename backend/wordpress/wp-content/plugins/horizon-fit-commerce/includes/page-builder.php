<?php
/**
 * Page Builder - Config management
 * Almacena estructura de páginas en WordPress option como JSON
 */

function hf_get_default_home_config() {
    return [
        'home' => [
            'title' => 'Home',
            'output' => 'index.html',
            'sections' => [
                [
                    'id' => 'home-header',
                    'type' => 'header',
                    'order' => 1,
                    'visible' => true,
                    'config' => []
                ],
                [
                    'id' => 'home-marquee',
                    'type' => 'marquee',
                    'order' => 2,
                    'visible' => true,
                    'config' => [
                        'messages' => ['3 Y 6 CUOTAS SIN INTERÉS']
                    ]
                ],
                [
                    'id' => 'home-hero',
                    'type' => 'hero',
                    'order' => 3,
                    'visible' => true,
                    'config' => []
                ],
                [
                    'id' => 'home-featured-products',
                    'type' => 'featured-products',
                    'order' => 4,
                    'visible' => true,
                    'config' => [
                        'title' => 'Productos destacados',
                        'subtitle' => 'Favoritos',
                        'source' => 'manual',
                        'product_ids' => [560, 568, 575, 589, 590, 591, 592, 593],
                        'limit' => 8
                    ]
                ],
                [
                    'id' => 'home-conjuntos',
                    'type' => 'conjuntos',
                    'order' => 5,
                    'visible' => true,
                    'config' => []
                ],
                [
                    'id' => 'home-categorias',
                    'type' => 'categorias',
                    'order' => 6,
                    'visible' => true,
                    'config' => []
                ],
                [
                    'id' => 'home-trust',
                    'type' => 'trust',
                    'order' => 7,
                    'visible' => true,
                    'config' => []
                ],
                [
                    'id' => 'home-footer',
                    'type' => 'footer',
                    'order' => 99,
                    'visible' => true,
                    'config' => []
                ]
            ]
        ]
    ];
}

function hf_init_page_config() {
    $config = get_option('hf_pages_config');

    if (!$config) {
        $default = hf_get_default_home_config();
        update_option('hf_pages_config', $default);
    }
}

function hf_get_page_config($slug = 'home') {
    $config = get_option('hf_pages_config');
    return isset($config[$slug]) ? $config[$slug] : null;
}

function hf_update_page_config($slug, $page_data) {
    $config = get_option('hf_pages_config');
    $config[$slug] = $page_data;
    update_option('hf_pages_config', $config);
}

// Inicializar en plugin activation
register_activation_hook(
    HF_COMMERCE_FILE,
    'hf_init_page_config'
);

// También inicializar al cargar plugin
add_action('plugins_loaded', 'hf_init_page_config', 5);
