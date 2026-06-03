<?php
/**
 * Uninstall handler.
 *
 * WordPress calls this file directly when the plugin is deleted via the UI.
 * We check for the user's stored preference (set in the pre-delete admin screen)
 * and run the appropriate cleanup path.
 *
 * If no preference is stored (e.g. manual deletion), we default to minimal
 * cleanup — never destructively scrub markup without explicit user consent.
 *
 * @package PatternSyncPro
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

// Bootstrap just enough to run cleanup.
define( 'PSP_DIR',              plugin_dir_path( __FILE__ ) );
define( 'PSP_CPT_OVERRIDE',     '_psp_override' );
define( 'PSP_OPTION_AFFECTED_POSTS', 'psp_affected_posts' );
define( 'PSP_OPTION_VERSION',   'psp_version' );

require_once PSP_DIR . 'includes/core/class-psp-pattern-lock.php';
require_once PSP_DIR . 'includes/core/class-psp-instance-registry.php';
require_once PSP_DIR . 'includes/uninstall/class-psp-cleanup.php';

$preference = get_option( 'psp_uninstall_preference', 'minimal' );
$cleanup    = new \PatternSyncPro\Uninstall\PSP_Cleanup();

if ( $preference === 'full' ) {
    $cleanup->run_full_cleanup();
} else {
    $cleanup->run_minimal_cleanup();
}
