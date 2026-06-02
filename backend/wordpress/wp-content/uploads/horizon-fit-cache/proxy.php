<?php
header('Access-Control-Allow-Origin: http://localhost:8088');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json');
header('Cache-Control: public, max-age=3600');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

$json_file = __DIR__ . '/featured-products.json';
if (!file_exists($json_file)) {
  http_response_code(404);
  exit;
}

readfile($json_file);
