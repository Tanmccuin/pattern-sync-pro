<?php
/**
 * Override Store — registers and manages the shadow CPT used to store
 * per-instance block attribute overrides.
 *
 * This CPT is deliberately invisible: not public, not in menus, not in REST,
 * not in search, not in sitemaps. It exists solely as a structured data store.
 *
 * @package PatternSyncPro\Core
 */

namespace PatternSyncPro\Core;

defined( 'ABSPATH' ) || exit;

class PSP_Override_Store {

    /**
     * Register the shadow CPT. Called early on plugins_loaded.
     */
    public function register(): void {
        add_action( 'init', [ $this, 'register_cpt' ], 0 );
    }

    /**
     * CPT registration — locked down on every axis.
     */
    public function register_cpt(): void {
        register_post_type( PSP_CPT_OVERRIDE, [
            'public'              => false,
            'publicly_queryable'  => false,
            'show_ui'             => false,
            'show_in_menu'        => false,
            'show_in_nav_menus'   => false,
            'show_in_admin_bar'   => false,
            'show_in_rest'        => false,   // We expose our own secured endpoint.
            'rewrite'             => false,
            'query_var'           => false,
            'has_archive'         => false,
            'exclude_from_search' => true,
            'map_meta_cap'        => false,
            'capabilities'        => [
                // Only our plugin code can touch these — no UI capability mapping.
                'edit_post'              => 'do_not_allow',
                'read_post'              => 'do_not_allow',
                'delete_post'            => 'do_not_allow',
                'edit_posts'             => 'manage_options',
                'edit_others_posts'      => 'manage_options',
                'publish_posts'          => 'manage_options',
                'read_private_posts'     => 'manage_options',
            ],
            'supports'            => [ 'title', 'editor' ],
            'labels'              => [
                'name' => 'PSP Overrides', // Only ever visible in debug tools.
            ],
        ] );
    }

    /**
     * Save an override record for a specific block instance on a specific post.
     *
     * @param int    $post_id     The post containing the pattern instance.
     * @param int    $pattern_id  The source synced pattern post ID.
     * @param string $instance_id The pspInstanceId value from the block comment.
     * @param array  $overrides   Key/value attribute overrides to store.
     *
     * @return int|WP_Error Override post ID on success.
     */
    public function save_override( int $post_id, int $pattern_id, string $instance_id, array $overrides ) {
        $existing = $this->get_override_post( $post_id, $instance_id );

        $data = [
            'post_type'    => PSP_CPT_OVERRIDE,
            'post_status'  => 'publish',
            'post_title'   => "psp|{$post_id}|{$pattern_id}|{$instance_id}",
            'post_parent'  => $pattern_id,
            'post_content' => wp_json_encode( $overrides ),
        ];

        if ( $existing ) {
            $data['ID'] = $existing->ID;
            return wp_update_post( $data, true );
        }

        return wp_insert_post( $data, true );
    }

    /**
     * Retrieve override attributes for a block instance.
     *
     * @param int    $post_id     The post containing the pattern instance.
     * @param string $instance_id The pspInstanceId value.
     *
     * @return array Decoded overrides, or empty array if none exist.
     */
    public function get_overrides( int $post_id, string $instance_id ): array {
        $post = $this->get_override_post( $post_id, $instance_id );

        if ( ! $post || empty( $post->post_content ) ) {
            return [];
        }

        $decoded = json_decode( $post->post_content, true );
        return is_array( $decoded ) ? $decoded : [];
    }

    /**
     * Delete the override record for a single block instance.
     * Used when the editor reverts a block to its pattern defaults.
     *
     * @param int    $post_id
     * @param string $instance_id
     */
    public function delete_overrides_for_instance( int $post_id, string $instance_id ): void {
        $post = $this->get_override_post( $post_id, $instance_id );
        if ( $post ) {
            wp_delete_post( $post->ID, true );
        }
    }

    /**
     * Delete all overrides associated with a given post.
     * Called on before_delete_post to prevent orphans.
     *
     * @param int $post_id
     */
    public function delete_overrides_for_post( int $post_id ): void {
        $overrides = $this->query_overrides_for_post( $post_id );

        foreach ( $overrides as $override ) {
            wp_delete_post( $override->ID, true ); // Force delete, bypass trash.
        }
    }

    /**
     * Delete all overrides for a given source pattern.
     * Called when a synced pattern post is deleted.
     *
     * @param int $pattern_id
     */
    public function delete_overrides_for_pattern( int $pattern_id ): void {
        $args = [
            'post_type'      => PSP_CPT_OVERRIDE,
            'post_parent'    => $pattern_id,
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ];

        $ids = get_posts( $args );

        foreach ( $ids as $id ) {
            wp_delete_post( $id, true );
        }
    }

    /**
     * Fetch all override CPT posts tied to a given host post ID.
     * Filters in PHP after fetching all records to ensure exact post_id match.
     *
     * @param int $post_id
     * @return WP_Post[]
     */
    private function query_overrides_for_post( int $post_id ): array {
        $all = get_posts( [
            'post_type'      => PSP_CPT_OVERRIDE,
            'posts_per_page' => -1,
            'post_status'    => 'publish',
        ] );

        return array_filter( $all, function ( \WP_Post $post ) use ( $post_id ) {
            $parts = explode( '|', $post->post_title );
            return count( $parts ) === 4 && $parts[0] === 'psp' && (int) $parts[1] === $post_id;
        } );
    }

    /**
     * Find an existing override post by post ID + instance ID using an exact
     * title prefix scan. Avoids full-text search ('s') which is slow and may
     * return false positives. The title format is:
     *   psp|{post_id}|{pattern_id}|{instance_id}
     * so we fetch all records for this post_id and match the instance suffix.
     *
     * @param int    $post_id
     * @param string $instance_id
     * @return WP_Post|null
     */
    private function get_override_post( int $post_id, string $instance_id ): ?\WP_Post {
        $candidates = get_posts( [
            'post_type'      => PSP_CPT_OVERRIDE,
            'posts_per_page' => -1,
            'post_status'    => 'publish',
        ] );

        foreach ( $candidates as $post ) {
            $parts = explode( '|', $post->post_title );
            // Title format: psp|post_id|pattern_id|instance_id
            if (
                count( $parts ) === 4 &&
                $parts[0] === 'psp' &&
                (int) $parts[1] === $post_id &&
                $parts[3] === $instance_id
            ) {
                return $post;
            }
        }

        return null;
    }
}
