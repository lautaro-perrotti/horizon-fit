<?php
/**
 * Admin page para Page Builder
 */

function hf_register_admin_page() {
    add_menu_page(
        'Horizon Fit - Page Builder',
        'Page Builder',
        'manage_options',
        'hf-page-builder',
        'hf_render_admin_page',
        'dashicons-layout',
        58
    );
}

function hf_render_admin_page() {
    if (!current_user_can('manage_options')) {
        wp_die('No tienes permiso para acceder a esta página');
    }

    $pages_config = get_option('hf_pages_config');
    $current_page = isset($_GET['page_slug']) ? sanitize_text_field($_GET['page_slug']) : 'home';
    $page_data = $pages_config[$current_page] ?? null;

    if (!$page_data) {
        echo '<div class="error"><p>Página no configurada</p></div>';
        return;
    }

    ?>
    <div class="wrap">
        <h1>Horizon Fit - Page Builder</h1>

        <div style="max-width: 900px;">
            <h2><?php echo esc_html($page_data['title']); ?></h2>

            <table class="wp-list-table striped">
                <thead>
                    <tr>
                        <th>Orden</th>
                        <th>Sección</th>
                        <th>Visible</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($page_data['sections'] as $idx => $section): ?>
                        <tr>
                            <td><?php echo esc_html($section['order']); ?></td>
                            <td><?php echo esc_html($section['type']); ?></td>
                            <td>
                                <?php if ($section['visible']): ?>
                                    <span class="badge" style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 3px;">Visible</span>
                                <?php else: ?>
                                    <span class="badge" style="background: #999; color: white; padding: 4px 8px; border-radius: 3px;">Oculta</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <button class="button" data-section="<?php echo esc_attr($idx); ?>">Editar</button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <hr>

            <button id="hf-regenerate-btn" class="button button-primary" style="margin-top: 20px; padding: 10px 20px; font-size: 16px;">
                Regenerar Página
            </button>

            <div id="hf-regenerate-status" style="margin-top: 20px; display: none; padding: 15px; border-radius: 4px;"></div>
        </div>
    </div>

    <script>
    document.getElementById('hf-regenerate-btn').addEventListener('click', function() {
        const btn = this;
        const status = document.getElementById('hf-regenerate-status');

        btn.disabled = true;
        btn.textContent = 'Regenerando...';
        status.style.display = 'block';
        status.style.background = '#e3f2fd';
        status.style.color = '#1976d2';
        status.textContent = 'Generando página...';

        fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=hf_generate_page&page_slug=<?php echo esc_attr($current_page); ?>&nonce=<?php echo wp_create_nonce('hf_generate_page'); ?>'
        })
        .then(r => r.json())
        .then(data => {
            btn.disabled = false;
            btn.textContent = 'Regenerar Página';

            if (data.success) {
                status.style.background = '#e8f5e9';
                status.style.color = '#388e3c';
                status.textContent = '✅ Página generada exitosamente. ' + data.data.message;
            } else {
                status.style.background = '#ffebee';
                status.style.color = '#c62828';
                status.textContent = '❌ Error: ' + (data.data?.message || 'Error desconocido');
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.textContent = 'Regenerar Página';
            status.style.background = '#ffebee';
            status.style.color = '#c62828';
            status.textContent = '❌ Error de conexión: ' + err.message;
        });
    });
    </script>
    <?php
}

function hf_ajax_generate_page() {
    check_ajax_referer('hf_generate_page', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'No tienes permiso']);
    }

    $page_slug = sanitize_text_field($_POST['page_slug'] ?? 'home');

    $result = hf_generate_page($page_slug);

    if (is_wp_error($result)) {
        wp_send_json_error(['message' => $result->get_error_message()]);
    }

    wp_send_json_success([
        'message' => "Página '{$page_slug}' generada con {$result['sections']} secciones"
    ]);
}

add_action('admin_menu', 'hf_register_admin_page');
add_action('wp_ajax_hf_generate_page', 'hf_ajax_generate_page');
