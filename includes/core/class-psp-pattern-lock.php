<?php
/**
 * Pattern Lock — handles reading and writing the pspLock attribute mask
 * on blocks within synced patterns.
 *
 * Lock groups map to logical attribute categories rather than individual
 * attributes (Free tier). Granular per-attribute control is Pro.
 *
 * @package PatternSyncPro\Core
 */

namespace PatternSyncPro\Core;

defined( 'ABSPATH' ) || exit;

class PSP_Pattern_Lock {

    /**
     * Attribute groups available for locking.
     * Each group key maps to the block attributes it governs.
     */
    public const LOCK_GROUPS = [
        'layout'     => [ 'layout', 'style', 'align', 'textAlign', 'verticalAlignment', 'justifyContent', 'orientation', 'flexWrap', 'columnCount' ],
        'design'     => [ 'backgroundColor', 'textColor', 'gradient', 'fontSize', 'fontFamily', 'style', 'borderColor', 'className' ],
        'content'    => [ 'content', 'value', 'caption', 'label', 'placeholder', 'url', 'href', 'src', 'alt', 'title' ],
        'visibility' => [ 'isHidden', 'hideOnMobile', 'hideOnTablet', 'hideOnDesktop' ],
        'classes'    => [ 'className', 'anchor' ],
    ];

    /**
     * Default lock state for new PSP-managed blocks.
     * Layout + design locked, content free — the most common agency need.
     */
    public const DEFAULT_LOCK = [
        'layout'     => true,
        'design'     => true,
        'content'    => false,
        'visibility' => true,
        'classes'    => true,
    ];

    /**
     * Return the effective lock groups for a given block type, applying the
     * `psp_lock_groups` filter so third-party library mappings are merged in.
     *
     * Built-in compat (PSP_Block_Compat) and external filter consumers both
     * hook here. Passing an empty string returns the core-block baseline.
     *
     * @param string $block_name e.g. 'kadence/advancedheading'. Optional.
     * @return array<string, string[]>
     */
    public static function get_lock_groups( string $block_name = '' ): array {
        /**
         * Filters the attribute lock group definitions for a specific block type.
         *
         * Use this to add support for third-party block libraries. The second
         * parameter is the block type name so you can scope changes precisely.
         *
         * @param array  $groups     Map of group → attribute keys.
         * @param string $block_name Block type, e.g. 'kadence/advancedheading'.
         *
         * @example
         *   add_filter( 'psp_lock_groups', function( $groups, $block_name ) {
         *       if ( $block_name === 'my-plugin/card' ) {
         *           $groups['content'][] = 'cardTitle';
         *           $groups['design'][]  = 'cardAccentColor';
         *       }
         *       return $groups;
         *   }, 10, 2 );
         */
        $groups = apply_filters( 'psp_lock_groups', self::LOCK_GROUPS, $block_name );

        // Deduplicate after any merges.
        return array_map( 'array_unique', (array) $groups );
    }

    /**
     * Parse the pspLock value from a block's attributes array.
     *
     * @param array $block_attrs Parsed block attributes.
     * @return array Lock mask, falling back to DEFAULT_LOCK.
     */
    public function get_lock_mask( array $block_attrs ): array {
        if ( empty( $block_attrs['pspLock'] ) || ! is_array( $block_attrs['pspLock'] ) ) {
            return self::DEFAULT_LOCK;
        }

        // Merge with defaults so new groups added in future versions don't break.
        return array_merge( self::DEFAULT_LOCK, $block_attrs['pspLock'] );
    }

    /**
     * Given a lock mask, return which top-level attribute keys are locked.
     *
     * @param array  $lock_mask  e.g. [ 'layout' => true, 'content' => false ]
     * @param string $block_name Optional block type for library-specific mappings.
     * @return string[] Flat list of locked attribute keys.
     */
    public function get_locked_attribute_keys( array $lock_mask, string $block_name = '' ): array {
        $groups = self::get_lock_groups( $block_name );
        $locked = [];

        foreach ( $lock_mask as $group => $is_locked ) {
            if ( $is_locked && isset( $groups[ $group ] ) ) {
                $locked = array_merge( $locked, $groups[ $group ] );
            }
        }

        return array_unique( $locked );
    }

    /**
     * Given a lock mask, return which attribute keys are overridable.
     *
     * @param array  $lock_mask
     * @param string $block_name Optional block type for library-specific mappings.
     * @return string[] Flat list of free attribute keys.
     */
    public function get_free_attribute_keys( array $lock_mask, string $block_name = '' ): array {
        $groups = self::get_lock_groups( $block_name );
        $free   = [];

        foreach ( $lock_mask as $group => $is_locked ) {
            if ( ! $is_locked && isset( $groups[ $group ] ) ) {
                $free = array_merge( $free, $groups[ $group ] );
            }
        }

        return array_unique( $free );
    }

    /**
     * Check whether a specific attribute key is locked under a given mask.
     *
     * @param string $attribute_key
     * @param array  $lock_mask
     * @param string $block_name Optional block type for library-specific mappings.
     * @return bool
     */
    public function is_attribute_locked( string $attribute_key, array $lock_mask, string $block_name = '' ): bool {
        return in_array( $attribute_key, $this->get_locked_attribute_keys( $lock_mask, $block_name ), true );
    }

    /**
     * Merge source block attributes with instance overrides, respecting the lock mask.
     * Locked attributes always come from source. Free attributes use the override if present.
     *
     * @param array $source_attrs   Attributes from the synced pattern source.
     * @param array $override_attrs Stored per-instance overrides.
     * @param array $lock_mask      The pspLock mask for this block.
     *
     * @return array Merged attributes for rendering.
     */
    public function merge_attributes( array $source_attrs, array $override_attrs, array $lock_mask ): array {
        $merged      = $source_attrs;
        $free_keys   = $this->get_free_attribute_keys( $lock_mask );

        foreach ( $free_keys as $key ) {
            if ( array_key_exists( $key, $override_attrs ) ) {
                $merged[ $key ] = $override_attrs[ $key ];
            }
        }

        return $merged;
    }

    /**
     * Strip all PSP attributes from serialised post content.
     *
     * Uses parse_blocks / serialize_blocks so nested JSON (pspOverrides) is
     * handled correctly — a regex cannot reliably match arbitrary nesting.
     *
     * Attributes removed:
     *   - pspLock       — on inner blocks inside source patterns
     *   - pspOverrides  — on core/block wrappers in posts
     *   - pspInstanceId — legacy; removed in v0.1.12 but stripped for safety
     *
     * @param string $post_content Raw post_content.
     * @return string Cleaned post_content.
     */
    public function strip_psp_attributes( string $post_content ): string {
        $blocks  = parse_blocks( $post_content );
        $cleaned = $this->strip_blocks_recursive( $blocks );
        return serialize_blocks( $cleaned );
    }

    /**
     * Recursively walk a block tree and remove PSP attributes.
     *
     * @param array $blocks
     * @return array
     */
    private function strip_blocks_recursive( array $blocks ): array {
        $psp_keys = [ 'pspLock', 'pspOverrides', 'pspInstanceId' ];

        foreach ( $blocks as &$block ) {
            if ( ! empty( $block['attrs'] ) ) {
                foreach ( $psp_keys as $key ) {
                    unset( $block['attrs'][ $key ] );
                }
            }

            if ( ! empty( $block['innerBlocks'] ) ) {
                $block['innerBlocks'] = $this->strip_blocks_recursive( $block['innerBlocks'] );
            }
        }

        return $blocks;
    }
}
