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

// ── Naming-pattern classifiers for third-party block attribute discovery ─────
//
// Rather than maintaining an exhaustive per-attribute list for each block,
// these patterns match attribute names to PSP lock groups dynamically.
// Applied to ALL registered attributes of a block when no explicit compat
// entry exists — covers future blocks and library updates automatically.

const ATTR_PATTERNS = {
    // Design must come before layout — border*, background* are design not layout
    design: [
        /color/i, /colour/i, /background/i, /gradient/i, /shadow/i,
        /opacity/i, /blur/i, /border/i, /outline/i, /radius/i,
        /font/i, /typography/i, /letter/i, /lineHeight/i, /textSize/i,
        /textTransform/i, /textDecoration/i, /effect/i, /animation/i,
        /entrance/i, /transition/i, /tint/i, /overlay/i, /filter/i,
        /blockBackground/i, /blockBorder/i, /blockShadow/i,
        /zIndex/i, /^overflow$/i, /^clear$/i,
    ],
    layout: [
        /margin/i, /padding/i, /width/i, /height/i, /align/i, /gap/i,
        /column/i, /flex/i, /orientation/i, /vertical/i, /horizontal/i,
        /position/i, /offset/i, /order/i, /wrap/i, /shrink/i, /grow/i,
        /blockHeight/i, /blockWidth/i, /blockVertical/i, /contentAlign/i,
    ],
    content: [
        /^text$/, /^url$/, /^alt$/, /^caption$/, /^label$/, /^title$/,
        /^href$/, /^src$/, /^content$/, /^value$/, /imageUrl/i,
        /imageAlt/i, /mediaUrl/i, /mediaAlt/i, /headingTitle/i,
        /subheading/i, /description/i, /buttonText/i, /linkUrl/i,
    ],
    visibility: [
        /^hide/i, /hideMobile/i, /hideTablet/i, /hideDesktop/i,
        /^show(?!Text|Button|Icon)/i, /displayCondition/i, /^visible/i,
        /responsive.*hide/i, /^collapse/i,
    ],
    classes: [
        /^className$/, /^anchor$/, /^htmlTag$/i, /customCss/i,
        /customAttributes/i, /extraClass/i, /additionalClass/i,
    ],
};

/**
 * Derive lock group membership for all REGISTERED attributes of a block
 * using naming patterns. Used when no explicit compat entry exists.
 * Results are cached per block type to avoid repeated registry lookups.
 *
 * @param {string} blockName
 * @return {Object} group → string[] map (additions only, not merged with base)
 */
const _registryCache = new Map();

function getLockGroupsFromRegistry( blockName ) {
    if ( _registryCache.has( blockName ) ) return _registryCache.get( blockName );

    const blockType = typeof wp !== 'undefined' && wp.blocks?.getBlockType?.( blockName );
    if ( ! blockType ) return {};

    const additions = { layout: [], design: [], content: [], visibility: [], classes: [] };

    for ( const attrKey of Object.keys( blockType.attributes ?? {} ) ) {
        // Skip WP-internal and PSP attrs.
        if ( [ 'uniqueId', 'generateCss', 'pspLock', 'className', 'anchor' ].includes( attrKey ) ) continue;

        let matched = false;
        for ( const [ group, patterns ] of Object.entries( ATTR_PATTERNS ) ) {
            if ( patterns.some( p => p.test( attrKey ) ) ) {
                additions[ group ].push( attrKey );
                matched = true;
                break; // First match wins
            }
        }
    }

    // Remove empty groups
    for ( const g of Object.keys( additions ) ) {
        if ( additions[ g ].length === 0 ) delete additions[ g ];
    }

    _registryCache.set( blockName, additions );
    return additions;
}

/**
 * Return the effective lock groups for a given block type.
 *
 * Priority:
 * 1. Core LOCK_GROUPS baseline (always included)
 * 2. Explicit compat entries from PHP (blockLockGroups)
 * 3. Pattern-derived additions from WP block registry (for any unrecognised block)
 *
 * @param {string} [blockName] e.g. 'stackable/text'
 * @return {Object} group → string[] map
 */
export function getLockGroupsForBlock( blockName = '' ) {
    // Explicit compat entry from PHP (highest specificity)
    const explicit = blockName ? ( BLOCK_LOCK_GROUPS[ blockName ] ?? {} ) : {};

    // Pattern-derived additions from block registry (covers all third-party blocks)
    const derived = blockName ? getLockGroupsFromRegistry( blockName ) : {};

    // Merge: base + explicit + derived, deduplicating
    const merged = {};
    for ( const group of Object.keys( LOCK_GROUPS ) ) {
        merged[ group ] = [ ...new Set( [
            ...( LOCK_GROUPS[ group ]  ?? [] ),
            ...( explicit[ group ]     ?? [] ),
            ...( derived[ group ]      ?? [] ),
        ] ) ];
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
