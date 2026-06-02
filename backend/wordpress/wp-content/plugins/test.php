<?php
require_once('../../wp-load.php');
$post = get_post(37);
if (!$post) {
    echo "Post 37 not found by get_post()\n";
} else {
    echo "Post 37 found! Type: " . $post->post_type . "\n";
    $pto = get_post_type_object($post->post_type);
    if (!$pto) {
        echo "Post type " . $post->post_type . " is NOT registered!\n";
    } else {
        echo "Post type " . $post->post_type . " IS registered.\n";
    }
}
$can_edit = current_user_can('edit_post', 37);
echo "Can edit? " . ($can_edit ? 'Yes' : 'No') . "\n";
