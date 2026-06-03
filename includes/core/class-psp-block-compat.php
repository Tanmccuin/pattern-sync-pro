<?php
/**
 * Block Compat — built-in attribute mappings for popular third-party block
 * libraries, plus the extensibility filter for anything not covered.
 *
 * Mappings are organised per block type. Only mappings whose block type is
 * actually registered in WP's block registry are merged in — installing a
 * compat entry for a library the site doesn't use has no effect.
 *
 * Adding support for a new library:
 *  1. Add entries to LIBRARY_MAPPINGS below (block_type → group → attr keys).
 *  2. The block types are checked against WP_Block_Type_Registry automatically.
 *
 * Third-party developers can extend further via the `psp_lock_groups` filter:
 *
 *   add_filter( 'psp_lock_groups', function( array $groups, string $block_name ): array {
 *       if ( $block_name === 'my-plugin/custom-block' ) {
 *           $groups['content'][] = 'myCustomText';
 *           $groups['design'][]  = 'myCustomColor';
 *       }
 *       return $groups;
 *   }, 10, 2 );
 *
 * @package PatternSyncPro\Core
 */

namespace PatternSyncPro\Core;

defined( 'ABSPATH' ) || exit;

class PSP_Block_Compat {

    /**
     * Built-in attribute mappings keyed by block type name.
     *
     * Only attributes we are CONFIDENT about are listed — incorrect entries
     * are worse than gaps. Coverage is intentionally conservative; the filter
     * handles edge cases.
     *
     * Groups: layout | design | content | visibility | classes
     */
    private const LIBRARY_MAPPINGS = [

        // ── Kadence Blocks ────────────────────────────────────────────────────
        // https://www.kadenceblocks.com/

        'kadence/advancedheading' => [
            'content' => [ 'content' ],
            'design'  => [ 'color', 'colorClass', 'fontSize', 'fontWeight', 'fontFamily',
                           'lineHeight', 'letterSpacing', 'textTransform', 'fontStyle' ],
            'layout'  => [ 'align', 'textAlign' ],
        ],
        'kadence/advancedbutton' => [
            'content' => [ 'text', 'link' ],
            'design'  => [ 'color', 'background', 'borderColor', 'colorHover',
                           'backgroundHover', 'fontSize', 'fontWeight', 'fontFamily' ],
        ],
        'kadence/image' => [
            'content' => [ 'url', 'alt', 'caption', 'link' ],
            'design'  => [ 'width', 'height', 'maxWidth', 'borderRadius' ],
            'layout'  => [ 'align', 'hAlign' ],
        ],
        'kadence/spacer' => [
            'layout'  => [ 'spacerHeight', 'spacerHeightTablet', 'spacerHeightMobile',
                           'spacerWidth', 'spacerWidthTablet', 'spacerWidthMobile' ],
        ],
        'kadence/column' => [
            'layout'  => [ 'width', 'maxWidth', 'paddingType', 'topPadding', 'rightPadding',
                           'bottomPadding', 'leftPadding' ],
            'design'  => [ 'background', 'border', 'borderRadius', 'textColor' ],
        ],
        'kadence/rowlayout' => [
            'layout'  => [ 'columns', 'columnLayout', 'colLayout', 'gutterType', 'firstColumnWidth' ],
            'design'  => [ 'background', 'textColor' ],
        ],

        // ── GenerateBlocks ────────────────────────────────────────────────────
        // https://generateblocks.com/

        'generateblocks/text' => [
            'content' => [ 'content' ],
            'design'  => [ 'backgroundColor', 'textColor', 'linkColor', 'fontSize',
                           'fontWeight', 'fontFamily', 'textTransform', 'letterSpacing' ],
            'layout'  => [ 'textAlign', 'width', 'paddingTop', 'paddingRight',
                           'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom' ],
        ],
        'generateblocks/image' => [
            'content' => [ 'mediaUrl', 'altText', 'caption' ],
            'design'  => [ 'borderRadius', 'opacity', 'objectFit' ],
            'layout'  => [ 'width', 'height', 'align' ],
        ],
        'generateblocks/button' => [
            'content' => [ 'text', 'url', 'ariaLabel' ],
            'design'  => [ 'backgroundColor', 'textColor', 'borderColor', 'hoverBackgroundColor',
                           'hoverTextColor', 'fontSize', 'fontWeight', 'fontFamily' ],
        ],
        'generateblocks/container' => [
            'layout'  => [ 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                           'marginTop', 'marginBottom', 'width', 'isGrid' ],
            'design'  => [ 'backgroundColor', 'textColor', 'gradient', 'borderRadius',
                           'borderSize', 'borderColor' ],
        ],

        // ── Stackable ─────────────────────────────────────────────────────────
        // https://wpstackable.com/

        'stackable/heading' => [
            'content' => [ 'text' ],
            'design'  => [ 'textColor1', 'fontSize', 'fontWeight', 'fontFamily',
                           'letterSpacing', 'textTransform' ],
            'layout'  => [ 'textAlign', 'blockAlign' ],
        ],
        'stackable/text' => [
            'content' => [ 'text' ],
            'design'  => [ 'textColor1', 'fontSize', 'fontWeight', 'fontFamily' ],
            'layout'  => [ 'textAlign', 'columnCount' ],
        ],
        'stackable/image' => [
            'content' => [ 'imageUrl', 'imageAlt', 'imageTitle' ],
            'design'  => [ 'imageWidth', 'imageHeight', 'imageBorderRadius', 'imageOpacity' ],
            'layout'  => [ 'imageAlign' ],
        ],
        'stackable/button' => [
            'content' => [ 'text', 'href', 'ariaLabel' ],
            'design'  => [ 'textColor1', 'buttonBackgroundColor', 'fontSize', 'fontWeight' ],
        ],
        'stackable/column' => [
            'layout'  => [ 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                           'marginTop', 'marginBottom', 'columnWidth' ],
            'design'  => [ 'backgroundColor', 'textColor1', 'borderRadius' ],
        ],

        // ── Spectra / Ultimate Addons for Gutenberg ───────────────────────────
        // https://wpspectra.com/

        'uagb/heading' => [
            'content' => [ 'headingTitle', 'subheadingTitle' ],
            'design'  => [ 'headFontSize', 'headFontWeight', 'headFontFamily',
                           'subHeadFontSize', 'headColor', 'subHeadingColor',
                           'headLetterSpacing', 'headTextTransform' ],
            'layout'  => [ 'align' ],
        ],
        'uagb/paragraph' => [
            'content' => [ 'content' ],
            'design'  => [ 'fontFamily', 'fontWeight', 'fontSizeDesktop', 'fontSizeTablet',
                           'fontSizeMobile', 'textColor', 'letterSpacing', 'textTransform' ],
            'layout'  => [ 'textAlign' ],
        ],
        'uagb/image' => [
            'content' => [ 'mediaURL', 'mediaAlt', 'captionText' ],
            'design'  => [ 'imageWidth', 'imageWidthTablet', 'imageWidthMobile',
                           'imageBorderRadius', 'opacity' ],
            'layout'  => [ 'align' ],
        ],
        'uagb/buttons-child' => [
            'content' => [ 'label', 'link' ],
            'design'  => [ 'textColor', 'textHColor', 'btnColor', 'btnHColor',
                           'fontSize', 'fontWeight', 'fontFamily' ],
        ],

        // ── Cwicly ────────────────────────────────────────────────────────────
        // https://cwicly.com/

        'cwicly/paragraph' => [
            'content' => [ 'content' ],
            'design'  => [ 'color', 'font', 'fontSize', 'fontWeight', 'letterSpacing',
                           'textTransform', 'lineHeight' ],
            'layout'  => [ 'textAlign' ],
        ],
        'cwicly/heading' => [
            'content' => [ 'content' ],
            'design'  => [ 'color', 'font', 'fontSize', 'fontWeight' ],
            'layout'  => [ 'textAlign' ],
        ],

        // ── Greenshift ────────────────────────────────────────────────────────
        // https://greenshiftwp.com/

        'greenshift-query/heading' => [
            'content' => [ 'content' ],
            'design'  => [ 'textcolor', 'fontsize', 'fontfamily', 'fontweight' ],
            'layout'  => [ 'textalign' ],
        ],
        'greenshift-query/text' => [
            'content' => [ 'content' ],
            'design'  => [ 'textcolor', 'fontsize' ],
        ],
    ];

    /**
     * Register the psp_lock_groups filter.
     */
    public function register(): void {
        add_filter( 'psp_lock_groups', [ $this, 'merge_library_mappings' ], 10, 2 );
    }

    /**
     * Merge built-in library attribute mappings for the given block type.
     * Only merges if the block type is actually registered in WP.
     *
     * @param array  $groups     Current lock group → attribute key map.
     * @param string $block_name Block type name, e.g. 'kadence/advancedheading'.
     * @return array
     */
    public function merge_library_mappings( array $groups, string $block_name ): array {
        if ( ! isset( self::LIBRARY_MAPPINGS[ $block_name ] ) ) {
            return $groups;
        }

        // Only apply if the block type is actually installed.
        if ( ! \WP_Block_Type_Registry::get_instance()->is_registered( $block_name ) ) {
            return $groups;
        }

        foreach ( self::LIBRARY_MAPPINGS[ $block_name ] as $group => $attrs ) {
            if ( isset( $groups[ $group ] ) ) {
                $groups[ $group ] = array_merge( $groups[ $group ], $attrs );
            }
        }

        return $groups;
    }

    /**
     * Return all block-specific attribute additions as a flat map.
     * Used by wp_localize_script to pass per-block overrides to JS.
     *
     * Only includes entries for blocks that are actually registered.
     *
     * @return array<string, array<string, string[]>>
     */
    public static function get_active_block_mappings(): array {
        $registry = \WP_Block_Type_Registry::get_instance();
        $active   = [];

        foreach ( self::LIBRARY_MAPPINGS as $block_name => $groups ) {
            if ( $registry->is_registered( $block_name ) ) {
                $active[ $block_name ] = $groups;
            }
        }

        return $active;
    }
}
