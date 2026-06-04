<?php
/**
 * Block Renderer — applies per-instance content overrides to synced pattern
 * inner blocks at front-end render time.
 *
 * Storage model (v0.2.0-alpha, Phase 5):
 *   Overrides live in the `core/block` wrapper's `content` attribute — the
 *   same location and format that WP's own `core/pattern-overrides` system
 *   uses. PSP and WP native share the same storage.
 *
 *   <!-- wp:block {
 *     "ref": 14,
 *     "content": {
 *       "paragraph-mpy30vc9": { "content": "Per-instance text" },
 *       "stackable-text-abc": { "text":    "Third-party override" }
 *     }
 *   } /-->
 *
 * Block keys are `metadata.name` values (set by PspAuthorPanel) with a
 * positional fallback ("paragraph-0") for unconfigured/legacy blocks.
 * This mirrors the JS `generateBlockKey()` function in lock-utils.js.
 *
 * Two rendering tiers:
 *   Tier 1 — WP-natively supported blocks (core/paragraph, core/heading,
 *     core/image, core/button) with `core/pattern-overrides` bindings:
 *     PSP applies the override via the same attr/innerHTML mechanism it
 *     uses for all blocks. WP's own binding system would also handle these
 *     but PSP intercepts `core/block` before WP's context chain runs.
 *
 *   Tier 2 — Third-party blocks (Stackable, Kadence, etc.) with
 *     `psp/overrides` bindings: PSP is the only rendering layer. Attrs are
 *     updated and, for blocks without a PHP render_callback, innerHTML is
 *     also patched via regex so static blocks output the correct content.
 *
 * Graceful degradation: if PSP is deactivated, `core/block.content` data
 * remains. WP's native `core/pattern-overrides` will apply overrides for
 * Tier 1 blocks automatically. Tier 2 overrides are inert without PSP.
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
     * Intercept core/block rendering when per-instance overrides are stored.
     *
     * Reads from `content` attribute (WP-native format, Phase 5).
     * Falls back to legacy `pspOverrides` for unmigrared data.
     *
     * @param string $block_content Rendered block HTML.
     * @param array  $block         Parsed block data.
     * @return string
     */
    public function apply_overrides( string $block_content, array $block ): string {
        if ( ( $block['blockName'] ?? '' ) !== 'core/block' ) {
            return $block_content;
        }

        // Overrides stored in `content` — WP-native format shared with
        // core/pattern-overrides. Legacy pspOverrides removed (Phase 8).
        $overrides = $block['attrs']['content'] ?? [];
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

        $source_blocks = parse_blocks( $pattern_post->post_content );
        $type_counts   = [];
        $lock_handler  = new PSP_Pattern_Lock();

        $modified = $this->apply_overrides_recursive(
            $source_blocks,
            $overrides,
            $type_counts,
            $lock_handler
        );

        // Render modified blocks. Inner blocks won't re-trigger this filter
        // because they are not `core/block` wrappers with override data.
        return implode( '', array_map( 'render_block', $modified ) );
    }

    /**
     * Recursively walk the source pattern block tree, look up each block's
     * override key, and apply any stored overrides.
     *
     * Key resolution mirrors JS generateBlockKey():
     *   1. metadata.name when set by PspAuthorPanel (stable).
     *   2. Positional fallback {shortType}-{index} for legacy/unconfigured blocks.
     *   Type counter always increments so subsequent blocks get correct indices.
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

            $short_type = str_replace( '/', '-', str_replace( 'core/', '', $block['blockName'] ) );
            $index      = $type_counts[ $short_type ] ?? 0;
            $type_counts[ $short_type ] = $index + 1;

            $key = $block['attrs']['metadata']['name'] ?? "{$short_type}-{$index}";

            if ( isset( $overrides[ $key ] ) ) {
                $block = $this->apply_block_override(
                    $block,
                    $overrides[ $key ],
                    $lock_handler,
                    $block['blockName']
                );
            }

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
     *
     * Two rendering paths based on WP block registration:
     *
     *   Dynamic (has PHP render_callback): update attrs only. The render
     *   callback receives the new attr value and produces the correct output.
     *   Works for Stackable, Kadence, GenerateBlocks, and other third-party
     *   blocks that have server-side rendering.
     *
     *   Static (no PHP render_callback): attrs AND innerHTML/innerContent must
     *   be updated because WP renders the stored innerHTML directly. Uses
     *   tag-pattern regex for known block types.
     *
     * @param array            $block
     * @param array            $override     e.g. ['content' => 'New text', 'text' => 'Other']
     * @param PSP_Pattern_Lock $lock_handler
     * @param string           $block_name
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

        // Determine rendering path: dynamic blocks use attrs only.
        $registered      = \WP_Block_Type_Registry::get_instance()->get_registered( $block_name );
        $has_render_cb   = $registered && ! empty( $registered->render_callback );

        foreach ( $override as $attr_key => $attr_value ) {
            if ( ! in_array( $attr_key, $free_keys, true ) ) {
                continue; // Locked attribute — skip.
            }

            // Always update the attr (used by dynamic blocks and block serialiser).
            $block['attrs'][ $attr_key ] = $attr_value;

            // For static blocks: also patch innerHTML/innerContent so WP
            // renders the overridden value from the stored markup.
            if ( ! $has_render_cb ) {
                $block = $this->update_block_content_html( $block, $attr_key, $attr_value );
            }
        }

        return $block;
    }

    /**
     * Patch a static block's innerHTML/innerContent for a given attribute key.
     *
     * Static blocks (no PHP render_callback) output their stored innerHTML
     * directly. PSP must update that markup to reflect the override value.
     *
     * Supports both `content` (core WP blocks) and `text` (Stackable-style
     * blocks that store their main text in a different attribute key but
     * render it as the same innerHTML structure).
     *
     * @param array  $block     Parsed block.
     * @param string $attr_key  Attribute key being overridden.
     * @param string $new_value New attribute value (may contain HTML).
     */
    private function update_block_content_html( array $block, string $attr_key, string $new_value ): array {
        $safe_value = wp_kses_post( $new_value );
        $block_name = $block['blockName'] ?? '';

        // Tag patterns for known static-render block types.
        // Both `content` and `text` attrs map to the same inner-HTML structure
        // for blocks that use the former as their canonical text attribute.
        $tag_patterns = [
            'core/paragraph' => [ '/<p(\b[^>]*)>.*?<\/p>/s',                      '<p$1>' . $safe_value . '</p>' ],
            'core/heading'   => [ '/<h([1-6])(\b[^>]*)>.*?<\/h\1>/s',             '<h$1$2>' . $safe_value . '</h$1>' ],
            'core/button'    => [ '/<a(\b[^>]*)>.*?<\/a>/s',                      '<a$1>' . $safe_value . '</a>' ],
            'core/list-item' => [ '/<li(\b[^>]*)>.*?<\/li>/s',                    '<li$1>' . $safe_value . '</li>' ],
            'core/quote'     => [ '/<blockquote(\b[^>]*)>.*?<\/blockquote>/s',     '<blockquote$1>' . $safe_value . '</blockquote>' ],
            'core/verse'     => [ '/<pre(\b[^>]*)>.*?<\/pre>/s',                  '<pre$1>' . $safe_value . '</pre>' ],
        ];

        // Attributes that carry the primary text content in their block's HTML.
        $text_attr_keys = [ 'content', 'text', 'value', 'caption', 'headingTitle' ];

        if ( ! in_array( $attr_key, $text_attr_keys, true ) ) {
            return $block; // Not a text-content attr; no innerHTML update needed.
        }

        if ( ! isset( $tag_patterns[ $block_name ] ) ) {
            return $block; // No pattern for this block type.
        }

        [ $pattern, $replacement ] = $tag_patterns[ $block_name ];
        $new_html = preg_replace( $pattern, $replacement, $block['innerHTML'] ?? '', 1 );

        if ( $new_html !== null ) {
            $block['innerHTML']    = $new_html;
            $block['innerContent'] = array_map(
                fn( $part ) => is_string( $part )
                    ? preg_replace( $pattern, $replacement, $part, 1 )
                    : $part,
                $block['innerContent'] ?? []
            );
        }

        return $block;
    }
}
