<?php
declare(strict_types=1);
define('ABSPATH',__DIR__.'/');
function add_action() {}
function add_filter() {}
function current_user_can(){return false;}
function check($condition,$message){if(!$condition){fwrite(STDERR,'FAIL '.$message."\n");exit(1);}}
$dir=sys_get_temp_dir().'/hf-framework-'.bin2hex(random_bytes(5));mkdir($dir);
$config=array('name'=>'Marca Independiente','storefrontUrl'=>'https://tienda.example','tracking'=>array('metaPixelId'=>'123456789'),'merchant'=>array());
file_put_contents($dir.'/store.json',json_encode($config));putenv('HF_FRAMEWORK_CONFIG_FILE='.$dir.'/store.json');putenv('HF_META_CAPI_ACCESS_TOKEN=test-server-secret');
require __DIR__.'/../backend/wordpress/wp-content/mu-plugins/00-horizon-framework.php';
check(hf_framework_name()==='Marca Independiente','store-specific brand');
check(hf_framework_origin()==='https://tienda.example','store-specific origin');
$tracking=hf_framework_tracking_options(array());check($tracking['meta_pixel_id']==='123456789','store-specific pixel');check($tracking['meta_capi_access_token']==='test-server-secret','server credential loaded');
check(!array_key_exists('meta_capi_access_token',hf_framework_config()['tracking']),'private credential absent from public config');
check(hf_framework_atomic_write($dir.'/cache.json','{"version":1}'),'first atomic write');check(hf_framework_atomic_write($dir.'/cache.json','{"version":2}'),'replacement atomic write');check(json_decode(file_get_contents($dir.'/cache.json'),true)['version']===2,'complete cache content');check(!glob($dir.'/*.tmp-*'),'no leftover temporary artifacts');
unlink($dir.'/cache.json');unlink($dir.'/store.json');rmdir($dir);echo "OK framework identity, private tracking credentials, atomic cache\n";

$secret='shhh-this-is-the-webhook-secret';
$body='{"event":"product.updated","resource":"product","id":"101"}';
$timestamp='1770000000';
check(hf_framework_sign($secret,$timestamp,$body)==='14bc01629ea1dc0d5a96273250b14234823d50ff6c5de2fbe9839878af7e7f65','shared signature vector');
check(!hf_framework_signature_matches(hf_framework_sign($secret,$timestamp,$body),hf_framework_sign($secret,'1770000001',$body)),'timestamp is inside the signature');
$payload=hf_framework_event_payload('product.updated','product','101','mate');
check(!array_key_exists('price',$payload)&&!array_key_exists('email',$payload)&&!array_key_exists('sku',$payload),'event payload is identity only');
$now=1770000000;
$event='{"event":"product.updated","resource":"product","id":"101","slug":"mate","changedAt":"2026-01-01T00:00:00Z","deliveryId":"delivery-1"}';
$signed=hf_framework_sign($secret,(string)$now,$event);
$first=hf_framework_receive_event($secret,(string)$now,$event,$signed,$now,array());
check($first['ok']===true&&empty($first['duplicate']),'signed event accepted');
$replay=hf_framework_receive_event($secret,(string)$now,$event,$signed,$now,$first['claimed']);
check($replay['ok']===true&&!empty($replay['duplicate']),'replay is acknowledged not reprocessed');
$stale=hf_framework_receive_event($secret,(string)$now,$event,$signed,$now+400,array());
check($stale['ok']===false&&$stale['reason']==='stale','future and past timestamps are rejected');
$future=hf_framework_receive_event($secret,(string)($now+400),$event,hf_framework_sign($secret,(string)($now+400),$event),$now,array());
check($future['ok']===false&&$future['reason']==='stale','far-future timestamp rejected');
$leaked_body=json_encode(array('event'=>'product.updated','resource'=>'product','id'=>'1','deliveryId'=>'d1','price'=>'10'));
$leaked=hf_framework_receive_event($secret,(string)$now,$leaked_body,hf_framework_sign($secret,(string)$now,$leaked_body),$now,array());
check($leaked['ok']===false&&$leaked['reason']==='leaked_data','catalog data cannot ride the webhook');
$forged=hf_framework_receive_event($secret,(string)$now,$event,'00'.substr($signed,2),$now,array());
check($forged['ok']===false&&$forged['reason']==='invalid_signature','forged signature rejected');
echo "OK signed cache events, freshness, replay and identity-only payloads\n";

$caps=hf_framework_public_capabilities(array('tracking'=>array('enabled'=>true,'ga4Id'=>'G-EXAMPLE','metaPixelId'=>'123'),'metaCapiToken'=>'server-secret','storeApi'=>true,'wordpress'=>true,'woocommerce'=>true));
check($caps['tracking']['ga4']===true&&$caps['tracking']['metaCapi']===true&&$caps['tracking']['googleAds']===false,'configured connectors are booleans');
check(!str_contains(json_encode($caps),'G-EXAMPLE')&&!str_contains(json_encode($caps),'server-secret'),'public capabilities never include IDs or tokens');
$off=hf_framework_public_capabilities(array('tracking'=>array('enabled'=>false,'ga4Id'=>'G-EXAMPLE'),'storeApi'=>true,'wordpress'=>true,'woocommerce'=>true));
check($off['tracking']['ga4']===false,'disabled tracking is not advertised');
$diag=hf_framework_diagnostics_from(array('name'=>'Marca','origin'=>'https://tienda.example','tracking'=>array('enabled'=>true,'ga4Id'=>'G-EXAMPLE'),'storeApi'=>true,'wordpress'=>true,'woocommerce'=>true,'webhookSecret'=>'present','metaCapiToken'=>''));
check($diag['integrations']['ga4']['configured']===true&&$diag['integrations']['ga4']['verified']===false,'configured is not verified');
check($diag['secrets']['webhook']===true&&$diag['secrets']['metaCapi']===false&&!str_contains(json_encode($diag),'present'),'diagnostics report secret presence only');
echo "OK capabilities vs diagnostics; tracking is not marked connected\n";

$memory=array();
$store=array(
    'get'=>function($key)use(&$memory){return $memory[$key]??null;},
    'setIfAbsent'=>function($key,$value)use(&$memory){if(isset($memory[$key]))return false;$memory[$key]=$value;return true;},
    'set'=>function($key,$value)use(&$memory){$memory[$key]=$value;return true;},
    'delete'=>function($key)use(&$memory){unset($memory[$key]);return true;},
);
$token_a='x.'.rtrim(strtr(base64_encode(json_encode(array('user_id'=>'7','exp'=>1))),'+/','-_'),'=').'.sig';
$token_b='x.'.rtrim(strtr(base64_encode(json_encode(array('user_id'=>'7','exp'=>2))),'+/','-_'),'=').'.sig';
check(hf_framework_cart_user_id($token_a)==='7'&&hf_framework_cart_user_id($token_a)===hf_framework_cart_user_id($token_b),'cart identity ignores token rotation');
$body_json='{"billing_address":{"email":"a@b.c"},"payment_data":[{"key":"token","value":"tok_secret"}]}';
$key=hf_framework_checkout_key('7',$body_json);
$first_claim=hf_framework_idempotency_claim($store,$key,100);
$second_claim=hf_framework_idempotency_claim($store,$key,101);
check(($first_claim['claimed']??false)===true&&($second_claim['state']??'')==='pending'&&empty($second_claim['claimed']),'double submit claims once');
$done=hf_framework_idempotency_complete($store,$key,array('order_id'=>44,'order_key'=>'wc_order_x','order_number'=>'44','status'=>'processing','customer_id'=>3,'payment_data'=>'tok_secret'),110);
check($done['order_id']===44&&!array_key_exists('payment_data',$done),'completed checkout stores order identity only');
$replay_claim=hf_framework_idempotency_claim($store,$key,120);
check(($replay_claim['state']??'')==='done'&&hf_framework_checkout_replay_body($replay_claim)['order_id']===44,'replay returns the first order');
$fail_key=hf_framework_checkout_key('7','{"attempt":2}');
hf_framework_idempotency_claim($store,$fail_key,130);
hf_framework_idempotency_fail($store,$fail_key);
$retry=hf_framework_idempotency_claim($store,$fail_key,131);
check(!empty($retry['claimed']),'failed checkout can be retried');
echo "OK checkout idempotency and cart session identity\n";
