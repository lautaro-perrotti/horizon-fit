<?php
define('DB_NAME', 'horizon_fit');
define('DB_USER', 'horizon_fit');
define('DB_PASSWORD', 'horizon_fit');
define('DB_HOST', 'db:3306');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
$table_prefix = 'hf_';

define('AUTH_KEY',         '5[}x!,<.bSw8J?#X)L5y]3$&;eK{.+g2>h8+L2M7Q6^9:}A;@[K!V');
define('SECURE_AUTH_KEY',  '~`K}9/Z=9;R.0@U}%#Hk]g5^9[Pp,2^<9j>7:k&2M9q#N"K@c(U');
define('LOGGED_IN_KEY',    '5=+9I9|Pz-X7E{8/q)+6<}q-5#P5l*E&L.K/G+m>@{L`<`9C}X,');
define('NONCE_KEY',        '(kRQ:!$5g|Lk:Sn`};h+2u1){qI:?B&O.T<v/{mJ}6j:n9@y#(');
define('AUTH_SALT',        '6V~2}(c5X8-L>!F{d-D<;^"V&gT+F}5"9|;d`J-V<<E{!]8.8');
define('SECURE_AUTH_SALT', '~Z6DW,H;k&*lhI=9w<-K4}P*j<E6GR-S|2W$jN"hK:B)M}pY$&[');
define('LOGGED_IN_SALT',   '8|9@T5#$<Y1J[&9Aq;2*Y/7d,&kS.!G<#>8q^{Vt;RFJ^G@|Wp');
define('NONCE_SALT',       '#>|B2B+cFy5<5$M~4<}h#&d/|:+z,L!e(M%L7/k`5f5l^&M.z"g');

define('WP_HOME', 'http://localhost:8089');
define('WP_SITEURL', 'http://localhost:8089');
define('WP_REST_ALLOWED_HOSTS', array('localhost:8089', 'localhost:8088', '*'));
define('FS_METHOD', 'direct');
define('WP_MEMORY_LIMIT', '256M');

if ( ! defined( 'ABSPATH' ) ) {
  define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
