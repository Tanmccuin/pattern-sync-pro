<?php
/**
 * Block Renderer — applies per-instance `pspOverrides` to synced pattern
 * inner blocks at render time.
 *
 * WP 7.0+ renders synced patterns (`core/block`) by fetching the source
 * pattern's content and rendering each inner block. This filter intercepts
 * that render, modifies the inner block data according to the stored
 * `pspOverrides`, and re-renders the result.
 *
 * Override storage format (on the `core/block` wrapper in post_content):
 *   pspOverrides: {
 *     "paragraph-0": { "content": "Per-instance text" },
 *     "heading-0":   { "content": "Per-instance heading" },
 *   }
 *
 * Block keys are position-based ("paragraph-0", "heading-0") matching the
 * JS `generateBlockKey` function in lock-utils.js. Keys are computed by
 * flattening the source pattern's block tree in depth-first order and
 * counting each block type independently.
 *
 * @package PatternSyncPro\Core
 */

namespace PatternSyncPro\Core;

defined( 'ABSPATH' ) || exit;

class PSP_Block_Renderer {

    /**
     * Register the render_block filter.
     */
    public function register(): void {
        add_filter( 'render_block', [ $this, 'apply_overrides' ], 10, 2 );
    }

    /**
     * Intercept core/block rendering when pspOverrides are present.
     *
     * @param string $block_content Rendered block HTML.
     * @param array  $block         Parsed block data.
     * @return string
     */
    public function apply_overrides( string $block_content, array $block ): string {
        if ( ( $block['blockName'] ?? '' ) !== 'core/block' ) {
            return $block_content;
        }

        // Phase 5: read from `content` (WP-native storage).
        // Fall back to legacy `pspOverrides` for data that hasn't been migrated
        // by the JS panel yet (e.g. sites updating from an older PSP version).
        $overrides = $block['attrs']['content'] ?? [];
        if ( empty( $overrides ) ) {
            $overrides = $block['attrs']['pspOverrides'] ?? [];
        }
        if ( empty( $overrides ) ) {
            return $block_content;
        }

        $ref = absint( $block['attrs']['ref'] ?? 0 );
        if ( ! $ref ) {
            return $block_content;
        }

        $pattern_post = get_post( $ref );
        if ( ! $pattern_post || $pattern_post->post_status !== 'publish' ) {
            return $block_content;
        }

        // Parse source pattern blocks.
        $source_blocks = parse_blocks( $pattern_post->post_content );

        // Apply overrides using the same key scheme as JS generateBlockKey.
        $type_counts  = [];
        $lock_handler = new PSP_Pattern_Lock();
        $modified     = $this->apply_overrides_recursive(
            $source_blocks,
            $overrides,
            $type_counts,
            $lock_handler
        );

        // Render the modified blocks. Each call to render_block() will
        // trigger this filter again, but since inner blocks are not
        // core/block wrappers with pspOverrides, they pass straight through.
        return implode( '', array_map( 'render_block', $modified ) );
    }

    /**
     * Recursively walk the block tree, assigning position keys and applying
     * overrides where found.
     *
     * @param array            $blocks       Block tree from parse_blocks().
     * @param array            $overrides    pspOverrides map from the core/block attr.
     * @param array            &$type_counts Running count per block type (shared across recursion).
     * @param PSP_Pattern_Lock $lock_handler For reading pspLock → free-key resolution.
     * @return array Modified block tree.
     */
    private function apply_overrides_recursive(
        array $blocks,
        array $overrides,
        array &$type_counts,
        PSP_Pattern_Lock $lock_handler
    ): array {
        $result = [];

        foreach ( $blocks as $block ) {
            if ( empty( $block['blockName'] ) ) {
                $result[] = $block;
                continue;
            }

            // Determine the override key — mirrors generateBlockKey() in JS.
            // Priority 1: metadata.name (stable, set by PspAuthorPanel).
            // Priority 2: positional fallback (legacy / unconfigured blocks).
            $short_type = str_replace( '/', '-', str_replace( 'core/', '', $block['blockName'] ) );
            $index      = $type_counts[ $short_type ] ?? 0;
            $type_counts[ $short_type ] = $index + 1; // Always increment for correct positional fallback on subsequent blocks.

            $key = $block['attrs']['metadata']['name'] ?? "{$short_type}-{$index}";

            // Apply override attrs if we have one for this key.
            if ( isset( $overrides[ $key ] ) ) {
                $block = $this->apply_block_override(
                    $block,
                    $overrides[ $key ],
                    $lock_handler,
                    $block['blockName']
                );
            }

            // Recurse — type_counts continues from the parent level.
            if ( ! empty( $block['innerBlocks'] ) ) {
                $block['innerBlocks'] = $this->apply_overrides_recursive(
                    $block['innerBlocks'],
                    $overrides,
                    $type_counts,
                    $lock_handler
                );
            }

            $result[] = $block;
        }

        return $result;
    }

    /**
     * Apply a single override entry to a block, respecting its pspLock mask.
     * Also updates the block's innerHTML/innerContent so static-render blocks
     * (like core/paragraph) output the overridden content.
     *
     * @param array            $block        Parsed block.
     * @param array            $override     Override attrs, e.g. ['content' => 'New text'].
     * @param PSP_Pattern_Lock $lock_handler
     * @return array Modified block.
     */
    private function apply_block_override(
        array $block,
        array $override,
        PSP_Pattern_Lock $lock_handler,
        string $block_name = ''
    ): array {
        $psp_lock  = $block['attrs']['pspLock'] ?? [];
        $lock_mask = $lock_handler->get_lock_mask( [ 'pspLock' => $psp_lock ] );
        $free_keys = $lock_handler->get_free_attribute_keys( $lock_mask, $block_name );

        foreach ( $override as $attr_key => $attr_value ) {
            if ( ! in_array( $attr_key, $free_keys, true ) ) {
                continue; // Locked — skip.
            }

            // Update the block's attrs.
            $block['attrs'][ $attr_key ] = $attr_value;

            // For static (non-dynamic) blocks, also update innerHTML/innerContent
            // so WP renders the overridden value. Dynamic blocks (with a PHP
            // render_callback) will pick up the change from attrs automatically.
            if ( $attr_key === 'content' ) {
                $block = $this->update_block_content_html( $block, $attr_value );
            }
        }

        return $block;
    }

    /**
     * Replace the text content inside a block's innerHTML for known static
     * block types. Called when the `content` attribute is overridden.
     *
     * Uses a targeted regex per block type rather than attempting to
     * reserialise (which would require the JS block serialiser).
     *
     * @param array  $block      Parsed block.
     * @param string $new_value  The new content value (may contain HTML).
     * @return array
     */
    private function update_block_content_html( array $block, string $new_value ): array {
        $safe_value = wp_kses_post( $new_value );

        $tag_patterns = [
            'core/paragraph' => [ '/<p(\b[^>]*)>.*?<\/p>/s', '<p$1>' . $safe_value . '</p>' ],
            'core/heading'   => [ '/<h([1-6])(\b[^>]*)>.*?<\/h\1>/s', '<h$1$2>' . $safe_value . '</h$1>' ],
            'core/button'    => [ '/<a(\b[^>]*)>.*?<\/a>/s', '<a$1>' . $safe_value . '</a>' ],
            'core/list-item' => [ '/<li(\b[^>]*)>.*?<\/li>/s', '<li$1>' . $safe_value . '</li>' ],
        ];

        $block_name = $block['blockName'] ?? '';

        if ( isset( $tag_patterns[ $block_name ] ) ) {
            [ $pattern, $replacement ] = $tag_patterns[ $block_name ];
            $new_html = preg_replace( $pattern, $replacement, $block['innerHTML'] ?? '', 1 );

            if ( $new_html !== null ) {
                $block['innerHTML']    = $new_html;
                $block['innerContent'] = array_map(
                    fn( $part ) => is_string( $part ) ? preg_replace( $pattern, $replacement, $part, 1 ) : $part,
                    $block['innerContent'] ?? []
                );
            }
        }

        return $block;
    }
}
