<?php
/**
 * Instance Registry — tracks which posts contain PSP pattern instances.
 *
 * Maintains the psp_affected_posts option so uninstall cleanup is surgical
 * (we only scrub posts we know are affected, not the entire wp_posts table).
 *
 * @package PatternSyncPro\Core
 */

namespace PatternSyncPro\Core;

defined( 'ABSPATH' ) || exit;

class PSP_Instance_Registry {

    /**
     * Generate a stable, unique instance ID for a block.
     * Called once when a PSP-managed block is first saved without a pspInstanceId.
     *
     * @return string e.g. "psp-7f3a9c2b"
     */
    public static function generate_instance_id(): string {
        return 'psp-' . substr( bin2hex( random_bytes( 4 ) ), 0, 8 );
    }

    /**
     * On post save, inspect post_content for pspInstanceId attributes.
     * If found, register this post ID in the affected posts list.
     *
     * Hooked to save_post.
     *
     * @param int      $post_id
     * @param \WP_Post $post
     */
    public static function track_post_on_save( int $post_id, \WP_Post $post ): void {
        // Bail on autosaves, revisions, and our own shadow CPT.
        if (
            wp_is_post_autosave( $post_id ) ||
            wp_is_post_revision( $post_id ) ||
            $post->post_type === PSP_CPT_OVERRIDE
        ) {
            return;
        }

        // pspOverrides is stored in the core/block wrapper in post_content.
        // pspLock is stored on inner blocks inside the source pattern (wp_block),
        // so its presence in post_content indicates a pattern source being saved.
        $has_psp = str_contains( $post->post_content, '"pspOverrides"' )
                || str_contains( $post->post_content, '"pspLock"' );

        $affected = get_option( PSP_OPTION_AFFECTED_POSTS, [] );

        if ( $has_psp ) {
            if ( ! in_array( $post_id, $affected, true ) ) {
                $affected[] = $post_id;
                update_option( PSP_OPTION_AFFECTED_POSTS, $affected, false );
            }
        } else {
            // If PSP markup was removed (e.g. pattern detached), remove from registry.
            $key = array_search( $post_id, $affected, true );
            if ( $key !== false ) {
                unset( $affected[ $key ] );
                update_option( PSP_OPTION_AFFECTED_POSTS, array_values( $affected ), false );
            }
        }
    }

    /**
     * Retrieve the full list of affected post IDs.
     *
     * @return int[]
     */
    public static function get_affected_posts(): array {
        return (array) get_option( PSP_OPTION_AFFECTED_POSTS, [] );
    }

    /**
     * Return the count of affected posts (for uninstall confirmation UI).
     *
     * @return int
     */
    public static function get_affected_post_count(): int {
        return count( self::get_affected_posts() );
    }

    /**
     * Remove a post from the registry (called on post deletion).
     *
     * @param int $post_id
     */
    public static function deregister_post( int $post_id ): void {
        $affected = self::get_affected_posts();
        $key      = array_search( $post_id, $affected, true );

        if ( $key !== false ) {
            unset( $affected[ $key ] );
            update_option( PSP_OPTION_AFFECTED_POSTS, array_values( $affected ), false );
        }
    }
}
