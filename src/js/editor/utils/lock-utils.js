/**
 * PSP lock utilities — JS mirror of PSP_Pattern_Lock PHP class.
 * Keeps lock group definitions and merge logic in one place on the JS side.
 */

const {
    lockGroups:      LOCK_GROUPS_FROM_PHP,
    blockLockGroups: BLOCK_LOCK_GROUPS_FROM_PHP,
} = window.pspData ?? {};

// Core block baseline — attribute keys for each lock group.
export const LOCK_GROUPS = LOCK_GROUPS_FROM_PHP ?? {
    layout:     [ 'layout', 'style', 'align', 'textAlign', 'verticalAlignment', 'justifyContent', 'orientation', 'flexWrap', 'columnCount' ],
    design:     [ 'backgroundColor', 'textColor', 'gradient', 'fontSize', 'fontFamily', 'style', 'borderColor', 'className' ],
    content:    [ 'content', 'value', 'caption', 'label', 'placeholder', 'url', 'href', 'src', 'alt', 'title' ],
    visibility: [ 'isHidden', 'hideOnMobile', 'hideOnTablet', 'hideOnDesktop' ],
    classes:    [ 'className', 'anchor' ],
};

// Per-block additions from active third-party libraries.
// Shape: { 'kadence/advancedheading': { design: ['color', ...], ... }, ... }
const BLOCK_LOCK_GROUPS = BLOCK_LOCK_GROUPS_FROM_PHP ?? {};

/**
 * Return the effective lock groups for a given block type.
 * Merges the core baseline with any block-specific additions from active
 * third-party library mappings.
 *
 * @param {string} [blockName] e.g. 'kadence/advancedheading'
 * @return {Object} group → string[] map
 */
export function getLockGroupsForBlock( blockName = '' ) {
    const extra = blockName ? ( BLOCK_LOCK_GROUPS[ blockName ] ?? {} ) : {};
    if ( Object.keys( extra ).length === 0 ) return LOCK_GROUPS;

    const merged = {};
    for ( const group of Object.keys( LOCK_GROUPS ) ) {
        const base      = LOCK_GROUPS[ group ] ?? [];
        const additions = extra[ group ]       ?? [];
        merged[ group ] = [ ...new Set( [ ...base, ...additions ] ) ];
    }
    return merged;
}

export const DEFAULT_LOCK = {
    layout:     true,
    design:     true,
    content:    false,
    visibility: true,
    classes:    true,
};

export const PSP_Pattern_Lock_JS = {
    getLockMask( pspLock ) {
        return { ...DEFAULT_LOCK, ...( pspLock ?? {} ) };
    },

    /**
     * @param {Object} lockMask
     * @param {string} [blockName] Block type for library-specific mappings.
     */
    getLockedKeys( lockMask, blockName = '' ) {
        const groups = getLockGroupsForBlock( blockName );
        const keys   = [];
        for ( const [ group, isLocked ] of Object.entries( lockMask ) ) {
            if ( isLocked && groups[ group ] ) {
                keys.push( ...groups[ group ] );
            }
        }
        return [ ...new Set( keys ) ];
    },

    /**
     * @param {Object} lockMask
     * @param {string} [blockName] Block type for library-specific mappings.
     */
    getFreeKeys( lockMask, blockName = '' ) {
        const groups = getLockGroupsForBlock( blockName );
        const keys   = [];
        for ( const [ group, isLocked ] of Object.entries( lockMask ) ) {
            if ( ! isLocked && groups[ group ] ) {
                keys.push( ...groups[ group ] );
            }
        }
        return [ ...new Set( keys ) ];
    },

    isLocked( key, lockMask, blockName = '' ) {
        return this.getLockedKeys( lockMask, blockName ).includes( key );
    },

    /**
     * Given source attributes + stored overrides + lock mask,
     * return what the editor should display.
     */
    mergeForDisplay( sourceAttrs, overrides, lockMask ) {
        const freeKeys = this.getFreeKeys( lockMask );
        const merged   = { ...sourceAttrs };
        for ( const key of freeKeys ) {
            if ( key in overrides ) {
                merged[ key ] = overrides[ key ];
            }
        }
        return merged;
    },
};

/**
 * Generate the stable key for a block within a synced pattern.
 *
 * Phase 2 of the v0.2.0-alpha refactor introduces `metadata.name` as the
 * canonical, author-assigned override key. When present it takes priority
 * over the legacy positional key so PSP keys are compatible with WP's own
 * `core/pattern-overrides` storage format (which also uses metadata.name).
 *
 * Priority:
 *   1. block.attributes.metadata.name — set by PspAuthorPanel when PSP is
 *      enabled on the block; stable across page loads and pattern edits.
 *   2. Positional fallback — "{shortBlockType}-{indexWithinType}" for blocks
 *      that haven't been through the Author Panel yet. Works the same as
 *      before; used during the transition while old data still exists.
 *
 * Only includes blocks that are genuine descendants of the specified wrapper
 * (parent-chain verified) to prevent cross-pattern contamination when multiple
 * synced patterns are on the same page.
 *
 * @param {Object} blockStore        wp.data.select('core/block-editor')
 * @param {string} coreBlockClientId ClientId of the core/block wrapper.
 * @param {string} targetClientId    ClientId of the block to key.
 * @return {string|null}
 */
export function generateBlockKey( blockStore, coreBlockClientId, targetClientId ) {
    const allIds = blockStore.getClientIdsWithDescendants?.( coreBlockClientId ) ?? [];

    // Verify parent chain — prevents blocks from other patterns bleeding in.
    const ownIds = allIds.filter( id =>
        ( blockStore.getBlockParents?.( id ) ?? [] ).includes( coreBlockClientId )
    );
    const allBlocks = ownIds.map( id => blockStore.getBlock( id ) ).filter( Boolean );

    const target = allBlocks.find( b => b.clientId === targetClientId );
    if ( ! target ) return null;

    // ── Priority 1: metadata.name (stable, author-assigned) ──────────────────
    if ( target.attributes?.metadata?.name ) {
        return target.attributes.metadata.name;
    }

    // ── Priority 2: positional fallback ──────────────────────────────────────
    const shortName = target.name.replace( /^core\//, '' ).replace( /\//g, '-' );
    const sameType  = allBlocks.filter( b => b.name === target.name );
    const index     = sameType.findIndex( b => b.clientId === targetClientId );

    return `${ shortName }-${ index }`;
}

// ── Content field utilities ───────────────────────────────────────────────────
// Shared by PspPatternPanel and PspInstancePanel.

/**
 * Label/control overrides for known attribute keys.
 * Optional — only needed to customise auto-derived labels or control types.
 */
export const CONTENT_FIELD_OVERRIDES = {
    content:         { label: 'Content' },
    caption:         { label: 'Caption' },
    alt:             { label: 'Alt text',       control: 'text' },
    placeholder:     { label: 'Placeholder',    control: 'text' },
    headingTitle:    { label: 'Heading' },
    subheadingTitle: { label: 'Subheading' },
    imageAlt:        { label: 'Image alt text', control: 'text' },
    altText:         { label: 'Alt text',       control: 'text' },
    mediaAlt:        { label: 'Image alt text', control: 'text' },
    ariaLabel:       { label: 'Aria label',     control: 'text' },
};

const URL_ATTR_PATTERN = /url|src|href|link/i;

/** camelCase → Title Case: "headingTitle" → "Heading Title" */
export function deriveFieldLabel( attrKey ) {
    return attrKey
        .replace( /([A-Z]+)/g, ' $1' )
        .replace( /^./, s => s.toUpperCase() )
        .trim();
}

/** Derive textarea vs text input from schema + name heuristics. */
export function deriveFieldControl( attrKey, attrSchema ) {
    if ( CONTENT_FIELD_OVERRIDES[ attrKey ]?.control ) {
        return CONTENT_FIELD_OVERRIDES[ attrKey ].control;
    }
    if ( attrSchema?.source === 'html' )      return 'textarea';
    if ( attrSchema?.source === 'text' )      return 'text';
    if ( attrSchema?.source === 'attribute' ) return 'text';
    return URL_ATTR_PATTERN.test( attrKey ) ? 'text' : 'textarea';
}

/**
 * Resolve editable content fields for a block's content group.
 *
 * Derives fields dynamically from WP's block registry — no static whitelist
 * needed. Works automatically for any block library.
 *
 * @param {string}   blockName   e.g. 'stackable/text'
 * @param {string[]} groupAttrs  Content-group attribute keys for this block.
 * @param {Object}   sourceAttrs Current block attributes (to check existence).
 * @return {Array<{attrKey, label, control}>}
 */
export function getContentFields( blockName, groupAttrs, sourceAttrs ) {
    const blockType       = wp.blocks?.getBlockType?.( blockName );
    const registeredAttrs = blockType?.attributes ?? {};

    return groupAttrs
        .filter( attrKey => {
            if ( ! ( attrKey in sourceAttrs ) ) return false;
            const schema = registeredAttrs[ attrKey ];
            if ( schema ) {
                return schema.type === 'string'
                    || [ 'html', 'text', 'attribute' ].includes( schema.source );
            }
            return typeof sourceAttrs[ attrKey ] === 'string';
        } )
        .map( attrKey => {
            const schema   = registeredAttrs[ attrKey ];
            const override = CONTENT_FIELD_OVERRIDES[ attrKey ] ?? {};
            return {
                attrKey,
                label:   override.label   ?? deriveFieldLabel( attrKey ),
                control: deriveFieldControl( attrKey, schema ),
            };
        } );
}
