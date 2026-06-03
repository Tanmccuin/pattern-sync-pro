<?php
/**
 * Cleanup — handles full plugin removal with two user-choice paths:
 *
 *   Path A (recommended): Strip all PSP block attributes from post_content
 *                         and delete all override CPT records.
 *   Path B (keep markup):  Only delete CPT records and plugin options.
 *                          PSP attributes remain inert in block comments.
 *
 * Scrubbing is batched to avoid memory exhaustion on large sites.
 *
 * @package PatternSyncPro\Uninstall
 */

namespace PatternSyncPro\Uninstall;

defined( 'ABSPATH' ) || exit;

class PSP_Cleanup {

    private const BATCH_SIZE = 50;

    /**
     * Run full cleanup (Path A).
     * Strips block markup attributes AND deletes CPT records + options.
     */
    public function run_full_cleanup(): void {
        $this->scrub_block_attributes();
        $this->delete_override_cpt_records();
        $this->delete_plugin_options();
    }

    /**
     * Run minimal cleanup (Path B).
     * Deletes CPT records and options only — leaves block markup intact.
     */
    public function run_minimal_cleanup(): void {
        $this->delete_override_cpt_records();
        $this->delete_plugin_options();
    }

    /**
     * Scrub pspLock and pspInstanceId from post_content in batches.
     * Only processes posts in the affected posts registry.
     */
    private function scrub_block_attributes(): void {
        $affected_ids = \PatternSyncPro\Core\PSP_Instance_Registry::get_affected_posts();

        if ( empty( $affected_ids ) ) {
            return;
        }

        $lock_handler = new \PatternSyncPro\Core\PSP_Pattern_Lock();
        $batches      = array_chunk( $affected_ids, self::BATCH_SIZE );

        foreach ( $batches as $batch ) {
            $posts = get_posts( [
                'post_type'      => 'any',
                'post__in'       => $batch,
                'posts_per_page' => self::BATCH_SIZE,
                'post_status'    => 'any',
            ] );

            foreach ( $posts as $post ) {
                if ( ! str_contains( $post->post_content, 'pspInstanceId' ) ) {
                    continue;
                }

                $clean_content = $lock_handler->strip_psp_attributes( $post->post_content );

                if ( $clean_content !== $post->post_content ) {
                    wp_update_post( [
                        'ID'           => $post->ID,
                        'post_content' => $clean_content,
                    ] );
                }
            }
        }
    }

    /**
     * Hard-delete all _psp_override CPT records, bypassing trash.
     */
    private function delete_override_cpt_records(): void {
        $ids = get_posts( [
            'post_type'      => PSP_CPT_OVERRIDE,
            'posts_per_page' => -1,
            'post_status'    => 'any',
            'fields'         => 'ids',
        ] );

        foreach ( $ids as $id ) {
            wp_delete_post( $id, true );
        }
    }

    /**
     * Remove all plugin options from wp_options.
     */
    private function delete_plugin_options(): void {
        delete_option( PSP_OPTION_AFFECTED_POSTS );
        delete_option( PSP_OPTION_VERSION );
        delete_option( 'psp_uninstall_preference' );
    }

    /**
     * Return a summary array for the uninstall confirmation UI.
     *
     * @return array{affected_posts: int, override_records: int}
     */
    public function get_cleanup_summary(): array {
        $override_count = (int) ( new \WP_Query( [
            'post_type'      => PSP_CPT_OVERRIDE,
            'post_status'    => 'any',
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ] ) )->found_posts;

        return [
            'affected_posts'  => \PatternSyncPro\Core\PSP_Instance_Registry::get_affected_post_count(),
            'override_records' => $override_count,
        ];
    }
}
