<?php
/** Horizon commerce runtime: per-store identity, connectors and cache lifecycle. */
if (!defined('ABSPATH')) exit;
require_once __DIR__ . '/horizon-framework/events.php';
require_once __DIR__ . '/horizon-framework/capabilities.php';
require_once __DIR__ . '/horizon-framework/idempotency.php';
function hf_framework_config() {
    static $config = null;
    if ($config !== null) return $config;
    $file = getenv('HF_FRAMEWORK_CONFIG_FILE');
    $config = $file && is_readable($file) ? json_decode(file_get_contents($file), true) : array();
    if (!is_array($config)) $config = array();
    return $config;
}
function hf_framework_configured() {
    return (bool) hf_framework_config();
}
function hf_framework_name() {
    $config = hf_framework_config();
    if ($config) return (string) ($config['name'] ?? '');
    return 'Horizon Fit';
}
function hf_framework_origin() {
    $config = hf_framework_config();
    if ($config) return rtrim((string) ($config['storefrontUrl'] ?? ''), '/');
    return 'https://horizonfit.com.ar';
}
function hf_framework_email() {
    $config = hf_framework_config();
    if ($config) return trim((string) ($config['email'] ?? ''));
    return 'hola@horizonfit.com.ar';
}
function hf_framework_whatsapp_url() {
    $config = hf_framework_config();
    if ($config) return trim((string) ($config['whatsappUrl'] ?? ''));
    return 'https://wa.me/541131150999';
}
function hf_framework_social_map() {
    $config = hf_framework_config();
    if (!$config) {
        return array(
            'instagram' => 'https://www.instagram.com/horizonfit.oficial/',
            'tiktok' => 'https://www.tiktok.com/@horizon.fit',
            'facebook' => 'https://www.facebook.com/profile.php?id=61582311777195',
            'spotify' => 'https://open.spotify.com/playlist/6SM4GvEnXAoI3wfHlHh8aC?si=369b9c02bb474760',
        );
    }
    $social = $config['social'] ?? array();
    return is_array($social) ? $social : array();
}
function hf_framework_social_urls() {
    $config = hf_framework_config();
    if (!$config) {
        return array_values(hf_framework_social_map());
    }
    if (!empty($config['socialUrls']) && is_array($config['socialUrls'])) {
        return array_values(array_filter(array_map('strval', $config['socialUrls'])));
    }
    return array_values(array_filter(array_map('strval', hf_framework_social_map()), static function ($url) {
        return $url !== '' && $url !== '#';
    }));
}
function hf_framework_atomic_write($file,$content) {
    $temporary=$file.'.tmp-'.bin2hex(random_bytes(8));
    if (file_put_contents($temporary,$content,LOCK_EX)===false) return false;
    @chmod($temporary,0644);
    if (!rename($temporary,$file)) { @unlink($temporary); return false; }
    return true;
}
function hf_framework_tracking_options($saved) {
    $config=hf_framework_config(); if (!$config) return $saved;
    $tracking=$config['tracking'] ?? array(); $saved=is_array($saved)?$saved:array();
    $saved['meta_pixel_id']=(string)($tracking['metaPixelId'] ?? '');
    // Access tokens exist only in the private runtime environment.
    $saved['meta_capi_access_token']=getenv('HF_META_CAPI_ACCESS_TOKEN') ?: '';
    $saved['meta_capi_test_event_code']=getenv('HF_META_TEST_EVENT_CODE') ?: '';
    return $saved;
}
add_filter('option_hf_tracking_settings','hf_framework_tracking_options');
add_filter('default_option_hf_tracking_settings','hf_framework_tracking_options');
add_filter('pre_option_hf_home_seo',function($value){$c=hf_framework_config();return $c?array('title'=>$c['seo']['title'] ?? $c['name'],'description'=>$c['seo']['description'] ?? ''):$value;});
add_filter('hf_merchant_category_map',function($value){$c=hf_framework_config();return $c?($c['merchant']['categoryMap'] ?? array()):$value;});
add_filter('hf_merchant_default_gender',function($value){$c=hf_framework_config();return $c?($c['merchant']['gender'] ?? ''):$value;});
add_filter('hf_merchant_default_age_group',function($value){$c=hf_framework_config();return $c?($c['merchant']['ageGroup'] ?? ''):$value;});
add_filter('hf_merchant_use_sku_as_mpn',function($value){$c=hf_framework_config();return $c?(bool)($c['merchant']['ownBrandManufacturer'] ?? false):$value;});

function hf_framework_rebuild() {
    if (!hf_framework_config()) return array('enabled'=>false);
    $uploads=wp_upload_dir();$directory=trailingslashit($uploads['basedir']).'horizon-fit-cache';wp_mkdir_p($directory);
    $lock=fopen($directory.'/.regenerate.lock','c');
    if (!$lock || !flock($lock,LOCK_EX|LOCK_NB)) return array('busy'=>true);
    $started=microtime(true);
    $GLOBALS['hf_framework_rebuilding']=true;
    try {
        foreach(array('hf_regenerate_featured_products_cache','hf_regenerate_sections_cache','hf_regenerate_menu_cache','hf_regenerate_info_pages_cache','hf_regenerate_tracking_settings_cache','hf_regenerate_storefront_seo_cache','hf_search_regenerate_commerce_artifacts') as $fn) if(function_exists($fn))call_user_func($fn);
        $status=array('version'=>1,'updatedAt'=>gmdate('c'),'durationMs'=>(int)((microtime(true)-$started)*1000),'store'=>hf_framework_name());
        hf_framework_atomic_write($directory.'/framework-status.json',wp_json_encode($status));return $status;
    } finally {$GLOBALS['hf_framework_rebuilding']=false;flock($lock,LOCK_UN);fclose($lock);}
}
add_action('hf_framework_rebuild','hf_framework_rebuild');
function hf_framework_schedule_rebuild() {
    if(!empty($GLOBALS['hf_framework_rebuilding']))return;
    if(hf_framework_config() && !wp_next_scheduled('hf_framework_rebuild'))wp_schedule_single_event(time()+2,'hf_framework_rebuild');
}
add_action('plugins_loaded',function(){if(hf_framework_config())remove_action('save_post_product','hf_regenerate_featured_products_cache');},100);
function hf_framework_hook_product($event,$product) {
    $id=is_object($product)&&method_exists($product,'get_id')?(int)$product->get_id():(int)$product;
    $slug=null;if(function_exists('get_post')){$post=get_post($id);$slug=$post?$post->post_name:null;}
    hf_framework_dispatch_event($event,'product',$id,$slug);
}
function hf_framework_hook_category($event,$term_id) {
    $slug=null;if(function_exists('get_term')){$term=get_term((int)$term_id,'product_cat');$slug=($term&&!is_wp_error($term))?$term->slug:null;}
    hf_framework_dispatch_event($event,'product-category',(int)$term_id,$slug);
}
add_action('woocommerce_new_product',function($id){hf_framework_hook_product('product.created',$id);},100);
add_action('woocommerce_update_product',function($id){hf_framework_hook_product('product.updated',$id);},100);
add_action('woocommerce_delete_product',function($id){hf_framework_hook_product('product.deleted',$id);},100);
foreach(array('woocommerce_product_set_stock','woocommerce_variation_set_stock','woocommerce_product_set_stock_status','woocommerce_variation_set_stock_status') as $hook)add_action($hook,function($product){hf_framework_hook_product('product.updated',$product);},100);
add_action('created_product_cat',function($term_id){hf_framework_hook_category('product-category.created',$term_id);},100);
add_action('edited_product_cat',function($term_id){hf_framework_hook_category('product-category.updated',$term_id);},100);
add_action('save_post_hf_page_section',function(){hf_framework_dispatch_event('settings.updated','settings');},100);

function hf_framework_runtime_input() {
    $c=hf_framework_config();$uploads=function_exists('wp_upload_dir')?wp_upload_dir():array('basedir'=>'');
    $base=isset($uploads['basedir'])?rtrim((string)$uploads['basedir'],'/\\').'/':'';
    $artifacts=array();
    foreach(array('horizon-fit-cache/featured-products.json','horizon-fit-cache/home-sections.json','horizon-fit-cache/tracking-settings.json','horizon-fit-seo/sitemap.xml','horizon-fit-merchant/merchant-products.tsv') as $file) {
        $path=$base.$file;$artifacts[$file]=array('exists'=>is_file($path),'updatedAt'=>is_file($path)?gmdate('c',filemtime($path)):null);
    }
    return array(
        'name'=>hf_framework_name(),'origin'=>hf_framework_origin(),'tracking'=>$c['tracking']??array(),
        'wordpress'=>true,'woocommerce'=>class_exists('WooCommerce')||defined('WC_VERSION'),
        'storeApi'=>class_exists('Automattic\\WooCommerce\\StoreApi\\StoreApi')||defined('WC_VERSION'),
        'metaCapiToken'=>getenv('HF_META_CAPI_ACCESS_TOKEN')?:'','webhookSecret'=>getenv('HF_CACHE_WEBHOOK_SECRET')?:'',
        'merchantFeed'=>is_file($base.'horizon-fit-merchant/merchant-products.tsv'),'cache'=>$artifacts,
    );
}

function hf_framework_webhook_secret() { return (string) (getenv('HF_CACHE_WEBHOOK_SECRET') ?: ''); }

function hf_framework_claimed_deliveries() {
    $claimed=get_option('hf_framework_deliveries',array());
    return is_array($claimed)?$claimed:array();
}

function hf_framework_dispatch_event($event,$resource,$id=null,$slug=null) {
    if(!hf_framework_config())return;
    $secret=hf_framework_webhook_secret();
    $payload=hf_framework_event_payload($event,$resource,$id,$slug);
    $body=hf_framework_encode_event($payload);
    if($secret){
        $now=time();
        $received=hf_framework_receive_event($secret,(string)$now,$body,hf_framework_sign($secret,(string)$now,$body),$now,hf_framework_claimed_deliveries());
        if(!$received['ok'])return;
        update_option('hf_framework_deliveries',$received['claimed'],false);
        if(!empty($received['duplicate']))return;
    }
    hf_framework_schedule_rebuild();
}

function hf_framework_option_store() {
    return array(
        'get'=>function($key){$value=get_option('hf_idem_'.$key,null);return ($value===null||$value===false)?null:$value;},
        'setIfAbsent'=>function($key,$value){return add_option('hf_idem_'.$key,$value,'',false);},
        'set'=>function($key,$value){return update_option('hf_idem_'.$key,$value,false);},
        'delete'=>function($key){return delete_option('hf_idem_'.$key);},
    );
}

add_action('rest_api_init',function(){
    if(!hf_framework_config())return;
    register_rest_route('horizon-framework/v1','/capabilities',array('methods'=>'GET','permission_callback'=>'__return_true','callback'=>function(){
        return rest_ensure_response(hf_framework_public_capabilities(hf_framework_runtime_input()));
    }));
    register_rest_route('horizon-framework/v1','/diagnostics',array('methods'=>'GET','permission_callback'=>function(){return current_user_can('manage_woocommerce');},'callback'=>function(){
        return rest_ensure_response(hf_framework_diagnostics_from(hf_framework_runtime_input()));
    }));
    register_rest_route('horizon-framework/v1','/health',array('methods'=>'GET','permission_callback'=>function(){return current_user_can('manage_woocommerce');},'callback'=>function(){
        return rest_ensure_response(hf_framework_diagnostics_from(hf_framework_runtime_input()));
    }));
    register_rest_route('horizon-framework/v1','/cache/rebuild',array('methods'=>'POST','permission_callback'=>function(){return current_user_can('manage_woocommerce');},'callback'=>function(){return rest_ensure_response(hf_framework_rebuild());}));
    register_rest_route('horizon-framework/v1','/cache/events',array('methods'=>'POST','permission_callback'=>'__return_true','callback'=>function($request){
        $secret=hf_framework_webhook_secret();
        if($secret==='')return new WP_Error('hf_webhook_disabled','Cache webhook is not configured',array('status'=>503));
        $raw=$request->get_body();
        $received=hf_framework_receive_event($secret,(string)$request->get_header('x-hf-timestamp'),$raw,(string)$request->get_header('x-hf-signature'),time(),hf_framework_claimed_deliveries());
        if(!$received['ok'])return new WP_Error('hf_webhook_rejected','Rejected',array('status'=>$received['reason']==='invalid_shape'||$received['reason']==='unknown_event'||$received['reason']==='leaked_data'?422:401));
        update_option('hf_framework_deliveries',$received['claimed'],false);
        if(empty($received['duplicate']))hf_framework_schedule_rebuild();
        return rest_ensure_response(array('accepted'=>true,'duplicate'=>!empty($received['duplicate'])));
    }));
});

add_filter('rest_pre_dispatch',function($result,$server,$request){
    if($result!==null||!hf_framework_config()||!$request instanceof WP_REST_Request)return $result;
    if($request->get_method()!=='POST'||!preg_match('#^/wc/store(?:/v\d+)?/checkout$#',$request->get_route()))return $result;
    $key=hf_framework_checkout_key(hf_framework_cart_user_id($request->get_header('cart-token')?:$request->get_header('Cart-Token')),$request->get_body());
    $claim=hf_framework_idempotency_claim(hf_framework_option_store(),$key,time());
    if(($claim['state']??'')==='done')return rest_ensure_response(hf_framework_checkout_replay_body($claim));
    if(($claim['state']??'')==='pending' && empty($claim['claimed']))return new WP_Error('hf_checkout_in_progress','Checkout already in progress',array('status'=>409));
    $GLOBALS['hf_checkout_idempotency_key']=$key;
    return $result;
},10,3);

add_filter('rest_post_dispatch',function($response,$server,$request){
    $key=$GLOBALS['hf_checkout_idempotency_key']??null;
    if(!$key||!hf_framework_config())return $response;
    unset($GLOBALS['hf_checkout_idempotency_key']);
    $status=method_exists($response,'get_status')?(int)$response->get_status():500;
    $data=method_exists($response,'get_data')?$response->get_data():array();
    if($status>=200 && $status<300 && is_array($data) && !empty($data['order_id'])) {
        hf_framework_idempotency_complete(hf_framework_option_store(),$key,$data,time());
    } else {
        hf_framework_idempotency_fail(hf_framework_option_store(),$key);
    }
    return $response;
},10,3);

if(defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('horizon cache rebuild',function(){WP_CLI::line(wp_json_encode(hf_framework_rebuild(),JSON_PRETTY_PRINT));});
    WP_CLI::add_command('horizon framework init',function(){
        $c=hf_framework_config();if(!$c)WP_CLI::error('Missing framework config');
        update_option('blogname',$c['name']);update_option('woocommerce_currency','ARS');update_option('woocommerce_default_country','AR');
        if(class_exists('WC_Install'))WC_Install::create_pages();
        if(function_exists('hf_footer_section_id') && !hf_footer_section_id()) {
            $pages=get_posts(array('post_type'=>'hf_page','name'=>'home','numberposts'=>1));
            $page=$pages?$pages[0]->ID:wp_insert_post(array('post_type'=>'hf_page','post_name'=>'home','post_title'=>'Inicio','post_status'=>'publish'));
            wp_insert_post(array('post_type'=>'hf_page_section','post_title'=>'Footer','post_status'=>'publish','meta_input'=>array('_hf_page_id'=>$page,'_hf_section_type'=>'footer','_hf_section_order'=>100,'_hf_section_visible'=>1,'_hf_section_settings'=>wp_json_encode(hf_footer_defaults()))));
        }
        update_option('hf_home_seo',array('title'=>$c['seo']['title'] ?? $c['name'],'description'=>$c['seo']['description'] ?? ''));
        hf_framework_rebuild();WP_CLI::success('Framework initialized');
    });
}
