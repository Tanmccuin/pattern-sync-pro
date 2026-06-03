<?php
/**
 * Plugin Name:       Pattern Sync Pro
 * Plugin URI:        https://patternsyncpro.com
 * Description:       Field-level sync control for WordPress block patterns. Lock layout and design while freeing content — per block, per attribute group.
 * Version:           0.1.11-alpha
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            Tannermooredesign
 * Author URI:        https://tannermooredesign.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       pattern-sync-pro
 * Domain Path:       /languages
 *
 * @package PatternSyncPro
 */

defined( 'ABSPATH' ) || exit;

// Plugin constants.
define( 'PSP_VERSION',     '0.1.11-alpha' );
define( 'PSP_FILE',        __FILE__ );
define( 'PSP_DIR',         plugin_dir_path( __FILE__ ) );
define( 'PSP_URL',         plugin_dir_url( __FILE__ ) );
define( 'PSP_BASENAME',    plugin_basename( __FILE__ ) );

// Override CPT slug — prefixed with underscore to stay out of the way.
define( 'PSP_CPT_OVERRIDE', '_psp_override' );

// Option keys.
define( 'PSP_OPTION_AFFECTED_POSTS', 'psp_affected_posts' );
define( 'PSP_OPTION_VERSION',        'psp_version' );

/**
 * Autoloader — simple PSR-4-style loader for includes/.
 */
spl_autoload_register( function ( $class ) {
    $prefix   = 'PatternSyncPro\\';
    $base_dir = PSP_DIR . 'includes/';

    if ( strncmp( $prefix, $class, strlen( $prefix ) ) !== 0 ) {
        return;
    }

    $relative = substr( $class, strlen( $prefix ) );
    $parts    = explode( '\\', $relative );
    $class_name = array_pop( $parts );

    // Convert namespace segments to directory path (lowercase).
    $sub_dir  = implode( '/', array_map( 'strtolower', $parts ) );
    $file     = $base_dir . ( $sub_dir ? $sub_dir . '/' : '' ) . 'class-' . strtolower( str_replace( '_', '-', $class_name ) ) . '.php';

    if ( file_exists( $file ) ) {
        require $file;
    }
} );

/**
 * Bootstrap on plugins_loaded so everything is available.
 */
add_action( 'plugins_loaded', function () {
    // Register the shadow CPT (reserved for Pro versioning/history features).
    ( new \PatternSyncPro\Core\PSP_Override_Store() )->register();

    // Register block library compat mappings + extensibility filter.
    ( new \PatternSyncPro\Core\PSP_Block_Compat() )->register();

    // Register the front-end render filter — applies pspOverrides at output time.
    ( new \PatternSyncPro\Core\PSP_Block_Renderer() )->register();

    // Boot admin layer.
    if ( is_admin() ) {
        ( new \PatternSyncPro\Admin\PSP_Admin() )->init();
        ( new \PatternSyncPro\Admin\PSP_Settings() )->init();
    }

    // Boot REST API (Pro features).
    add_action( 'rest_api_init', function () {
        ( new \PatternSyncPro\Api\PSP_Rest_Overrides() )->register_routes();
    } );

    // Track affected posts on save.
    add_action( 'save_post', [ \PatternSyncPro\Core\PSP_Instance_Registry::class, 'track_post_on_save' ], 10, 2 );
} );

/**
 * Activation hook — store plugin version for future migration checks.
 */
register_activation_hook( __FILE__, function () {
    add_option( PSP_OPTION_VERSION, PSP_VERSION );
    add_option( PSP_OPTION_AFFECTED_POSTS, [] );
} );

/**
 * Deactivation — intentionally passive. Block attributes remain inert.
 * Override CPT records stay in place for clean reactivation.
 */
register_deactivation_hook( __FILE__, function () {
    // Nothing destructive. Intentional.
} );
