<?php
require_once('../../wp-load.php');

$admin = get_users(['role' => 'administrator'])[0];
wp_set_current_user($admin->ID);

$post_id = 37;
$post = get_post($post_id);

if (empty($post->ID)) {
    echo "Empty post ID\n";
} else {
    echo "Post found\n";
}

if (!current_user_can('edit_post', $post_id)) {
    echo "Cannot edit\n";
} else {
    echo "Can edit\n";
}

if ($post->post_status === 'trash') {
    echo "Is in trash\n";
}

$post_type_object = get_post_type_object($post->post_type);
if (!$post_type_object) {
    echo "Invalid post type\n";
}
