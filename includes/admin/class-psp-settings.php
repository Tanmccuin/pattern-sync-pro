<?php
/**
 * PSP Settings Page — Settings > Pattern Sync Pro
 *
 * Tabbed settings page covering License, General, Debug, and About.
 * The License tab is a placeholder for Freemius (or alternative) SDK
 * integration once a licensing provider is chosen.
 *
 * TODO (pre-launch): Integrate Freemius SDK.
 *   1. Create account at https://freemius.com and register the plugin.
 *   2. Download the Freemius SDK to /vendor/freemius/.
 *   3. Replace the license tab placeholder with Freemius's built-in
 *      account/upgrade page: $this->freemius->get_account_url()
 *   4. Remove the manual license key field — Freemius handles activation.
 *   Alternatively: Lemon Squeezy (https://lemonsqueezy.com) offers a
 *   simpler REST API with 5% flat fee and no SDK required.
 *
 * @package PatternSyncPro\Admin
 */

namespace PatternSyncPro\Admin;

defined( 'ABSPATH' ) || exit;

class PSP_Settings {

    private const MENU_SLUG = 'pattern-sync-pro';
    private const TABS      = [ 'license', 'general', 'debug', 'about' ];

    public function init(): void {
        add_action( 'admin_menu',            [ $this, 'register_menu' ] );
        add_action( 'admin_init',            [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_styles' ] );
    }

    // ── Menu registration ─────────────────────────────────────────────────────

    public function register_menu(): void {
        add_options_page(
            __( 'Pattern Sync Pro', 'pattern-sync-pro' ),
            __( 'Pattern Sync Pro', 'pattern-sync-pro' ),
            'manage_options',
            self::MENU_SLUG,
            [ $this, 'render_page' ]
        );
    }

    // ── Settings API ──────────────────────────────────────────────────────────

    public function register_settings(): void {
        // Debug toggle (existing, moved from Tools page).
        register_setting( 'psp_general', 'psp_debug', [
            'type'              => 'boolean',
            'default'           => false,
            'sanitize_callback' => 'rest_sanitize_boolean',
        ] );

        // TODO (pre-launch): Register license key option once provider chosen.
        // register_setting( 'psp_license', 'psp_license_key', [...] );
    }

    // ── Styles ────────────────────────────────────────────────────────────────

    public function enqueue_styles( string $hook ): void {
        if ( $hook !== 'settings_page_' . self::MENU_SLUG ) return;

        wp_enqueue_style(
            'psp-admin-settings',
            PSP_URL . 'build/settings.css',
            [],
            PSP_VERSION
        );
    }

    // ── Page render ───────────────────────────────────────────────────────────

    public function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $active_tab = isset( $_GET['tab'] ) && in_array( $_GET['tab'], self::TABS, true )
            ? sanitize_key( $_GET['tab'] )
            : 'license';

        ?>
        <div class="wrap psp-settings-wrap">

            <div class="psp-settings-header">
                <div class="psp-settings-header__title">
                    <span class="psp-settings-header__logo" aria-hidden="true">◈</span>
                    <h1><?php esc_html_e( 'Pattern Sync Pro', 'pattern-sync-pro' ); ?></h1>
                    <span class="psp-settings-header__version">
                        v<?php echo esc_html( PSP_VERSION ); ?>
                    </span>
                </div>
            </div>

            <nav class="nav-tab-wrapper psp-tabs" aria-label="<?php esc_attr_e( 'Settings tabs', 'pattern-sync-pro' ); ?>">
                <?php foreach ( self::TABS as $tab ) : ?>
                    <a
                        href="<?php echo esc_url( add_query_arg( 'tab', $tab, admin_url( 'options-general.php?page=' . self::MENU_SLUG ) ) ); ?>"
                        class="nav-tab<?php echo $active_tab === $tab ? ' nav-tab-active' : ''; ?>"
                    >
                        <?php echo esc_html( ucfirst( $tab ) ); ?>
                    </a>
                <?php endforeach; ?>
            </nav>

            <div class="psp-settings-content">
                <?php
                match ( $active_tab ) {
                    'license' => $this->render_license_tab(),
                    'general' => $this->render_general_tab(),
                    'debug'   => $this->render_debug_tab(),
                    'about'   => $this->render_about_tab(),
                    default   => $this->render_license_tab(),
                };
                ?>
            </div>

        </div>
        <?php
    }

    // ── License tab ───────────────────────────────────────────────────────────

    private function render_license_tab(): void {
        $is_pro = false; // TODO: replace with Freemius license check: $this->freemius->is_paying()
        ?>
        <div class="psp-settings-panel">

            <?php if ( $is_pro ) : ?>
                <div class="psp-license-status psp-license-status--pro">
                    <span class="psp-license-status__badge">Pro</span>
                    <div>
                        <strong><?php esc_html_e( 'Pro Plan active', 'pattern-sync-pro' ); ?></strong>
                        <p><?php esc_html_e( 'All Pro features are enabled on this site.', 'pattern-sync-pro' ); ?></p>
                    </div>
                </div>
            <?php else : ?>
                <div class="psp-license-status psp-license-status--free">
                    <span class="psp-license-status__badge psp-license-status__badge--free">
                        <?php esc_html_e( 'Free', 'pattern-sync-pro' ); ?>
                    </span>
                    <div>
                        <strong><?php esc_html_e( 'Free Plan', 'pattern-sync-pro' ); ?></strong>
                        <p>
                            <?php esc_html_e( 'You\'re using Pattern Sync Pro Free. Upgrade to unlock per-attribute control, override history, rollback, and role-based permissions.', 'pattern-sync-pro' ); ?>
                        </p>
                    </div>
                </div>

                <div class="psp-upgrade-cta">
                    <a
                        href="https://patternsyncpro.com/upgrade"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="button button-primary button-large"
                    >
                        <?php esc_html_e( 'Upgrade to Pro →', 'pattern-sync-pro' ); ?>
                    </a>
                    <a
                        href="https://patternsyncpro.com/#compare"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="psp-compare-link"
                    >
                        <?php esc_html_e( 'Compare plans', 'pattern-sync-pro' ); ?>
                    </a>
                </div>
            <?php endif; ?>

            <hr class="psp-divider" />

            <div class="psp-license-key-section">
                <h3><?php esc_html_e( 'License Key', 'pattern-sync-pro' ); ?></h3>
                <p class="description">
                    <?php esc_html_e( 'Enter your Pro license key to activate premium features on this site.', 'pattern-sync-pro' ); ?>
                </p>

                <?php
                /*
                 * TODO (pre-launch): Replace this placeholder with Freemius SDK
                 * activation flow or chosen provider's key activation UI.
                 *
                 * Freemius example:
                 *   $this->freemius->add_action( 'after_account_details', ... );
                 *
                 * Manual key validation example (EDD / LemonSqueezy):
                 *   $key = get_option( 'psp_license_key', '' );
                 *   // render key input + activate/deactivate buttons
                 */
                ?>

                <div class="psp-license-key-input">
                    <input
                        type="text"
                        class="regular-text"
                        placeholder="<?php esc_attr_e( 'XXXX-XXXX-XXXX-XXXX', 'pattern-sync-pro' ); ?>"
                        disabled
                        aria-describedby="psp-license-key-note"
                    />
                    <button type="button" class="button" disabled>
                        <?php esc_html_e( 'Activate', 'pattern-sync-pro' ); ?>
                    </button>
                </div>
                <p id="psp-license-key-note" class="description psp-muted-note">
                    <?php esc_html_e( 'License activation coming soon. Upgrade to Pro to receive your key.', 'pattern-sync-pro' ); ?>
                </p>
            </div>

        </div>
        <?php
    }

    // ── General tab ───────────────────────────────────────────────────────────

    private function render_general_tab(): void {
        ?>
        <div class="psp-settings-panel">
            <h3><?php esc_html_e( 'General Settings', 'pattern-sync-pro' ); ?></h3>
            <p class="description">
                <?php esc_html_e( 'General configuration options will appear here in a future release.', 'pattern-sync-pro' ); ?>
            </p>

            <?php
            /*
             * TODO (pre-launch): Add general settings here as the plugin matures.
             * Candidates:
             *   - Default lock preset for new pattern blocks
             *   - Override storage mode (post meta vs block attribute)
             *   - Disable PSP on specific post types
             *   - Role capabilities: which roles can configure locks
             */
            ?>

            <table class="form-table" role="presentation">
                <tbody>
                    <tr>
                        <th scope="row">
                            <label><?php esc_html_e( 'Data stored', 'pattern-sync-pro' ); ?></label>
                        </th>
                        <td>
                            <?php
                            $summary  = ( new \PatternSyncPro\Uninstall\PSP_Cleanup() )->get_cleanup_summary();
                            printf(
                                /* translators: 1: post count, 2: override record count */
                                esc_html__( '%1$s post(s) with overrides &nbsp;·&nbsp; %2$s override record(s)', 'pattern-sync-pro' ),
                                '<strong>' . esc_html( $summary['affected_posts'] ) . '</strong>',
                                '<strong>' . esc_html( $summary['override_records'] ) . '</strong>'
                            );
                            ?>
                        </td>
                    </tr>
                </tbody>
            </table>

        </div>
        <?php
    }

    // ── Debug tab ─────────────────────────────────────────────────────────────

    private function render_debug_tab(): void {
        // Handle form submission.
        if ( isset( $_POST['psp_debug_submit'] ) ) {
            check_admin_referer( 'psp_debug_toggle' );
            $enabled = isset( $_POST['psp_debug'] ) ? 1 : 0;
            update_option( 'psp_debug', $enabled );
            add_settings_error( 'psp_debug', 'saved', __( 'Setting saved.', 'pattern-sync-pro' ), 'success' );
        }

        settings_errors( 'psp_debug' );
        $debug_on = (bool) get_option( 'psp_debug', false );
        ?>
        <div class="psp-settings-panel">
            <h3><?php esc_html_e( 'Debug Settings', 'pattern-sync-pro' ); ?></h3>
            <p class="description">
                <?php esc_html_e( 'Developer tools for diagnosing PSP behaviour in the block editor.', 'pattern-sync-pro' ); ?>
            </p>

            <form method="post">
                <?php wp_nonce_field( 'psp_debug_toggle' ); ?>
                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row">
                                <?php esc_html_e( 'Debug Overlay', 'pattern-sync-pro' ); ?>
                            </th>
                            <td>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="psp_debug"
                                        value="1"
                                        <?php checked( $debug_on ); ?>
                                    />
                                    <?php esc_html_e( 'Enable debug overlay in the block editor', 'pattern-sync-pro' ); ?>
                                </label>
                                <p class="description">
                                    <?php esc_html_e( 'Shows a small overlay on each block with PSP context data: block editing mode, pattern ref, parent depth. Useful for diagnosing why a panel is or is not appearing.', 'pattern-sync-pro' ); ?>
                                </p>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p class="submit">
                    <input
                        type="submit"
                        name="psp_debug_submit"
                        class="button button-primary"
                        value="<?php esc_attr_e( 'Save', 'pattern-sync-pro' ); ?>"
                    />
                </p>
            </form>
        </div>
        <?php
    }

    // ── About tab ─────────────────────────────────────────────────────────────

    private function render_about_tab(): void {
        ?>
        <div class="psp-settings-panel">

            <div class="psp-about-header">
                <span class="psp-about-logo" aria-hidden="true">◈</span>
                <div>
                    <h2><?php esc_html_e( 'Pattern Sync Pro', 'pattern-sync-pro' ); ?></h2>
                    <p class="psp-about-tagline">
                        <?php esc_html_e( 'Field-level sync control for WordPress block patterns.', 'pattern-sync-pro' ); ?>
                    </p>
                </div>
            </div>

            <table class="form-table psp-about-table" role="presentation">
                <tbody>
                    <tr>
                        <th><?php esc_html_e( 'Version',       'pattern-sync-pro' ); ?></th>
                        <td><?php echo esc_html( PSP_VERSION ); ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Requires WP',   'pattern-sync-pro' ); ?></th>
                        <td>7.0+</td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Requires PHP',  'pattern-sync-pro' ); ?></th>
                        <td>8.1+</td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e( 'Plan',          'pattern-sync-pro' ); ?></th>
                        <td><?php esc_html_e( 'Free', 'pattern-sync-pro' ); ?></td>
                    </tr>
                </tbody>
            </table>

            <hr class="psp-divider" />

            <div class="psp-about-links">
                <h3><?php esc_html_e( 'Resources', 'pattern-sync-pro' ); ?></h3>
                <ul>
                    <li>
                        <a href="https://patternsyncpro.com/docs" target="_blank" rel="noopener noreferrer">
                            <?php esc_html_e( 'Documentation →', 'pattern-sync-pro' ); ?>
                        </a>
                    </li>
                    <li>
                        <a href="https://github.com/Tanmccuin/pattern-sync-pro/issues" target="_blank" rel="noopener noreferrer">
                            <?php esc_html_e( 'Report a bug on GitHub →', 'pattern-sync-pro' ); ?>
                        </a>
                    </li>
                    <li>
                        <a href="https://patternsyncpro.com/support" target="_blank" rel="noopener noreferrer">
                            <?php esc_html_e( 'Support →', 'pattern-sync-pro' ); ?>
                        </a>
                    </li>
                    <li>
                        <a href="https://patternsyncpro.com/upgrade" target="_blank" rel="noopener noreferrer">
                            <?php esc_html_e( 'Upgrade to Pro →', 'pattern-sync-pro' ); ?>
                        </a>
                    </li>
                </ul>
            </div>

        </div>
        <?php
    }
}
