<?php
require '/var/www/html/wp-load.php';
$settings=function_exists('hf_storefront_tracking_settings')?hf_storefront_tracking_settings():array();
$uploads=wp_upload_dir();$base=trailingslashit($uploads['basedir']);
$files=array();foreach(array('horizon-fit-cache/featured-products.json','horizon-fit-cache/home-sections.json','horizon-fit-seo/sitemap.xml','horizon-fit-merchant/merchant-products.tsv') as $file)$files[$file]=array('exists'=>file_exists($base.$file),'bytes'=>file_exists($base.$file)?filesize($base.$file):null);
echo wp_json_encode(array('store'=>get_option('blogname'),'metaPixelConfigured'=>!empty($settings['meta_pixel_id']),'metaCapiConfigured'=>!empty($settings['meta_capi_access_token']),'cache'=>$files),JSON_PRETTY_PRINT)."\n";
