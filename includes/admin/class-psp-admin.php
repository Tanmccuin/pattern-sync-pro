<?php
/**
 * Admin
 * @package PatternSyncPro\Admin
 */

namespace PatternSyncPro\Admin;

defined( 'ABSPATH' ) || exit;

class PSP_Admin {

    public function init(): void {
        add_action( 'admin_notices',                        [ $this, 'maybe_show_uninstall_notice' ] );
        add_action( 'wp_ajax_psp_set_uninstall_preference', [ $this, 'ajax_set_uninstall_preference' ] );
        add_action( 'wp_ajax_psp_toggle_debug',             [ $this, 'ajax_toggle_debug' ] );
        add_action( 'enqueue_block_editor_assets',          [ $this, 'enqueue_editor_assets' ] );
        add_action( 'before_delete_post',                   [ $this, 'handle_post_deletion' ] );
        add_action( 'admin_menu',                           [ $this, 'register_settings_page' ] );
    }

    /**
     * Register a minimal Tools > PSP Debug settings page.
     */
    public function register_settings_page(): void {
        add_management_page(
            __( 'Pattern Sync Pro', 'pattern-sync-pro' ),
            __( 'PSP Debug', 'pattern-sync-pro' ),
            'manage_options',
            'psp-debug',
            [ $this, 'render_settings_page' ]
        );
    }

    /**
     * Render Tools > PSP Debug page.
     */
    public function render_settings_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;

        // Handle form submit.
        if ( isset( $_POST['psp_debug_submit'] ) ) {
            check_admin_referer( 'psp_debug_toggle' );
            $enabled = isset( $_POST['psp_debug'] ) ? 1 : 0;
            update_option( 'psp_debug', $enabled );
            echo '<div class="notice notice-success"><p>' . esc_html__( 'Setting saved.', 'pattern-sync-pro' ) . '</p></div>';
        }

        $debug_on = (bool) get_option( 'psp_debug', false );
        $summary  = ( new \PatternSyncPro\Uninstall\PSP_Cleanup() )->get_cleanup_summary();
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Pattern Sync Pro', 'pattern-sync-pro' ); ?></h1>

            <h2><?php esc_html_e( 'Status', 'pattern-sync-pro' ); ?></h2>
            <table class="widefat" style="max-width:500px">
                <tbody>
                    <tr>
                        <td><strong><?php esc_html_e( 'Version', 'pattern-sync-pro' ); ?></strong></td>
                        <td><?php echo esc_html( PSP_VERSION ); ?></td>
                    </tr>
                    <tr>
                        <td><strong><?php esc_html_e( 'Affected posts', 'pattern-sync-pro' ); ?></strong></td>
                        <td><?php echo esc_html( $summary['affected_posts'] ); ?></td>
                    </tr>
                    <tr>
                        <td><strong><?php esc_html_e( 'Override records', 'pattern-sync-pro' ); ?></strong></td>
                        <td><?php echo esc_html( $summary['override_records'] ); ?></td>
                    </tr>
                </tbody>
            </table>

            <h2 style="margin-top:24px"><?php esc_html_e( 'Debug Overlay', 'pattern-sync-pro' ); ?></h2>
            <p><?php esc_html_e( 'When enabled, every block in the editor shows a small overlay with PSP context data — useful for diagnosing why a panel is or is not appearing.', 'pattern-sync-pro' ); ?></p>

            <form method="post">
                <?php wp_nonce_field( 'psp_debug_toggle' ); ?>
                <label>
                    <input type="checkbox" name="psp_debug" value="1" <?php checked( $debug_on ); ?> />
                    <?php esc_html_e( 'Enable debug overlay in block editor', 'pattern-sync-pro' ); ?>
                </label>
                <p class="submit">
                    <input type="submit" name="psp_debug_submit" class="button button-primary" value="<?php esc_attr_e( 'Save', 'pattern-sync-pro' ); ?>" />
                </p>
            </form>
        </div>
        <?php
    }

    public function enqueue_editor_assets(): void {
        $asset_file = PSP_DIR . 'build/editor.asset.php';

        if ( ! file_exists( $asset_file ) ) {
            if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                error_log( '[PSP] build/editor.asset.php not found — run npm run build.' );
            }
            return;
        }

        $asset = require $asset_file;

        wp_enqueue_script(
            'psp-editor',
            PSP_URL . 'build/editor.js',
            $asset['dependencies'],
            $asset['version'],
            true
        );

        wp_enqueue_style(
            'psp-editor',
            PSP_URL . 'build/editor.css',
            [ 'wp-edit-blocks' ],
            $asset['version']
        );

        // Debug bundle — always enqueued, self-gates on pspData.debug flag.
        $debug_asset_file = PSP_DIR . 'build/debug.asset.php';
        if ( file_exists( $debug_asset_file ) ) {
            $debug_asset = require $debug_asset_file;
            wp_enqueue_script(
                'psp-editor-debug',
                PSP_URL . 'build/debug.js',
                array_merge( $debug_asset['dependencies'], [ 'psp-editor' ] ),
                $debug_asset['version'],
                true
            );
        }

        wp_localize_script( 'psp-editor', 'pspData', [
            'apiBase'         => rest_url( 'psp/v1/' ),
            'nonce'           => wp_create_nonce( 'wp_rest' ),
            // Core block baseline — JS uses this as the default for any block
            // not listed in blockLockGroups.
            'lockGroups'      => \PatternSyncPro\Core\PSP_Pattern_Lock::LOCK_GROUPS,
            // Per-block additions for active third-party libraries. JS merges
            // these on top of lockGroups when processing a specific block type.
            'blockLockGroups' => \PatternSyncPro\Core\PSP_Block_Compat::get_active_block_mappings(),
            'isPro'           => false,
            'version'         => PSP_VERSION,
            'debug'           => (bool) get_option( 'psp_debug', false ),
            'siteAdminUrl'    => admin_url(),
        ] );
    }

    public function ajax_toggle_debug(): void {
        check_ajax_referer( 'psp_debug_toggle', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized', 403 );
        }
        $enabled = (bool) ( $_POST['enabled'] ?? false );
        update_option( 'psp_debug', $enabled ? 1 : 0 );
        wp_send_json_success( [ 'debug' => $enabled ] );
    }

    public function maybe_show_uninstall_notice(): void {
        $screen = get_current_screen();
        if ( ! $screen || $screen->id !== 'plugins' ) return;
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if ( empty( $_GET['action'] ) || $_GET['action'] !== 'delete-selected' ) return;
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $plugins = (array) ( $_GET['checked'] ?? [] );
        if ( ! in_array( PSP_BASENAME, $plugins, true ) ) return;
        ( new PSP_Uninstall_Screen() )->render();
    }

    public function ajax_set_uninstall_preference(): void {
        check_ajax_referer( 'psp_uninstall', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized', 403 );
        }
        $preference = sanitize_key( $_POST['preference'] ?? 'minimal' );
        if ( ! in_array( $preference, [ 'full', 'minimal' ], true ) ) {
            $preference = 'minimal';
        }
        update_option( 'psp_uninstall_preference', $preference );
        wp_send_json_success();
    }

    public function handle_post_deletion( int $post_id ): void {
        if ( get_post_type( $post_id ) === PSP_CPT_OVERRIDE ) return;
        $store = new \PatternSyncPro\Core\PSP_Override_Store();
        $store->delete_overrides_for_post( $post_id );
        $store->delete_overrides_for_pattern( $post_id );
        \PatternSyncPro\Core\PSP_Instance_Registry::deregister_post( $post_id );
    }
}
