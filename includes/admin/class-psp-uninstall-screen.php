<?php
/**
 * Uninstall Screen — renders the pre-delete choice UI as an admin notice.
 *
 * @package PatternSyncPro\Admin
 */

namespace PatternSyncPro\Admin;

defined( 'ABSPATH' ) || exit;

class PSP_Uninstall_Screen {

    public function render(): void {
        $cleanup = new \PatternSyncPro\Uninstall\PSP_Cleanup();
        $summary = $cleanup->get_cleanup_summary();
        $nonce   = wp_create_nonce( 'psp_uninstall' );
        ?>
        <div class="notice notice-warning psp-uninstall-notice" style="padding: 16px 20px;">
            <h3 style="margin-top:0;">
                <?php esc_html_e( 'Before you remove Pattern Sync Pro', 'pattern-sync-pro' ); ?>
            </h3>
            <p>
                <?php
                printf(
                    /* translators: 1: post count, 2: override record count */
                    esc_html__( 'PSP has data on %1$s post(s) and %2$s override record(s). Choose what happens to it:', 'pattern-sync-pro' ),
                    '<strong>' . esc_html( $summary['affected_posts'] ) . '</strong>',
                    '<strong>' . esc_html( $summary['override_records'] ) . '</strong>'
                );
                ?>
            </p>

            <label style="display:block; margin-bottom:8px;">
                <input type="radio" name="psp_cleanup" value="full" checked />
                <strong><?php esc_html_e( 'Remove all PSP data and restore default sync behavior', 'pattern-sync-pro' ); ?></strong>
                &nbsp;<span style="color:#666;"><?php esc_html_e( '— Recommended. Strips PSP attributes from block markup and deletes override records.', 'pattern-sync-pro' ); ?></span>
            </label>

            <label style="display:block; margin-bottom:16px;">
                <input type="radio" name="psp_cleanup" value="minimal" />
                <strong><?php esc_html_e( 'Keep PSP attributes in block markup (safe, just inert)', 'pattern-sync-pro' ); ?></strong>
                &nbsp;<span style="color:#666;"><?php esc_html_e( '— Deletes override records and options only. Block markup is untouched.', 'pattern-sync-pro' ); ?></span>
            </label>

            <button
                id="psp-confirm-uninstall"
                class="button button-primary"
                data-nonce="<?php echo esc_attr( $nonce ); ?>"
                data-ajax="<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>"
            >
                <?php esc_html_e( 'Save preference and continue with deletion', 'pattern-sync-pro' ); ?>
            </button>
        </div>

        <script>
        document.getElementById('psp-confirm-uninstall').addEventListener('click', function(e) {
            e.preventDefault();
            const btn        = this;
            const preference = document.querySelector('input[name="psp_cleanup"]:checked').value;

            btn.disabled    = true;
            btn.textContent = '<?php echo esc_js( __( 'Saving…', 'pattern-sync-pro' ) ); ?>';

            fetch(btn.dataset.ajax, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action:     'psp_set_uninstall_preference',
                    nonce:      btn.dataset.nonce,
                    preference: preference,
                })
            })
            .then(r => r.json())
            .then(() => {
                btn.textContent = '<?php echo esc_js( __( 'Preference saved. You can now delete the plugin.', 'pattern-sync-pro' ) ); ?>';
            })
            .catch(() => {
                btn.disabled    = false;
                btn.textContent = '<?php echo esc_js( __( 'Error — please try again.', 'pattern-sync-pro' ) ); ?>';
            });
        });
        </script>
        <?php
    }
}
