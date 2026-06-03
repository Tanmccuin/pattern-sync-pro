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
 * Generate a stable, deterministic key for a block within a synced pattern.
 *
 * The key is "{shortBlockType}-{indexWithinType}", e.g. "paragraph-0",
 * "heading-0", "paragraph-1". It is computed from the block's position in
 * the flat descendant list of the core/block wrapper, making it stable
 * across page loads as long as the pattern structure doesn't change.
 *
 * This replaces the old random pspInstanceId approach. Because the key is
 * derived from position rather than stored in an attribute, it works even
 * when the post only serialises <!-- wp:block {"ref":14} /-->.
 *
 * @param {Object} blockStore        wp.data.select('core/block-editor')
 * @param {string} coreBlockClientId ClientId of the core/block wrapper.
 * @param {string} targetClientId    ClientId of the block to key.
 * @return {string|null} e.g. "paragraph-0", or null if not found.
 */
export function generateBlockKey( blockStore, coreBlockClientId, targetClientId ) {
    const allIds    = blockStore.getClientIdsWithDescendants?.( coreBlockClientId ) ?? [];
    const allBlocks = allIds.map( id => blockStore.getBlock( id ) ).filter( Boolean );

    const target = allBlocks.find( b => b.clientId === targetClientId );
    if ( ! target ) return null;

    const shortName   = target.name.replace( /^core\//, '' );
    const sameType    = allBlocks.filter( b => b.name === target.name );
    const index       = sameType.findIndex( b => b.clientId === targetClientId );

    return `${ shortName }-${ index }`;
}
