/**
 * PSP Lock Enforcement — store-level attribute guard + free-attr capture.
 *
 * Two jobs per subscriber tick:
 *
 * 1. REVERT locked-group attribute writes — prevents editors from changing
 *    attributes that the pattern author has locked.
 *
 * 2. CAPTURE free-group attribute writes → core/block.content — when an
 *    editor changes an attribute that belongs to a free group (e.g. Design,
 *    Layout) using the block library's own sidebar controls, the change is
 *    captured here and written to the ancestor core/block's `content`
 *    attribute in WP-native format. PSP's PHP renderer applies it at
 *    front-end render time.
 *
 *    This makes ALL block library controls (Stackable Style tab, Kadence
 *    Design panel, etc.) work naturally for overrides — editors use the
 *    controls they already know, PSP captures the result silently.
 *
 * Loop guard: `revertInProgress` prevents re-entrant calls during our own
 * dispatches. Released via microtask after all writes complete.
 */

import { subscribe, select, dispatch } from '@wordpress/data';
import { PSP_Pattern_Lock_JS, generateBlockKey } from '../utils/lock-utils';

const DEBUG = window.pspData?.debug ?? false;

function getAllBlocks( blockStore ) {
    const allIds = blockStore.getClientIdsWithDescendants?.() ?? [];
    return allIds.map( id => blockStore.getBlock( id ) ).filter( Boolean );
}

function findCoreBlockAncestor( blockStore, clientId ) {
    const parents = blockStore.getBlockParents?.( clientId ) ?? [];
    for ( const pid of parents ) {
        const parent = blockStore.getBlock?.( pid );
        if ( parent?.name === 'core/block' && parent?.attributes?.ref ) return parent;
    }
    return null;
}

export function initLockEnforcement() {
    const attrSnapshots  = new Map();
    let revertInProgress = false;

    subscribe( () => {
        if ( revertInProgress ) return;

        const editorStore = select( 'core/editor' );
        const blockStore  = select( 'core/block-editor' );
        if ( ! editorStore || ! blockStore ) return;

        // Only run on pattern instances — never on the source pattern editor.
        const postType = editorStore.getCurrentPostType?.();
        if ( postType === 'wp_block' || ! postType ) return;

        const allBlocks      = getAllBlocks( blockStore );
        const reverts        = []; // Locked attr writes to revert.
        const overrideWrites = []; // Free attr writes to capture.

        for ( const block of allBlocks ) {
            const { pspLock } = block.attributes ?? {};

            if ( ! pspLock || Object.keys( pspLock ).length === 0 ) {
                attrSnapshots.set( block.clientId, { ...block.attributes } );
                continue;
            }

            const coreAncestor = findCoreBlockAncestor( blockStore, block.clientId );
            if ( ! coreAncestor ) {
                attrSnapshots.set( block.clientId, { ...block.attributes } );
                continue;
            }

            const prev = attrSnapshots.get( block.clientId );
            if ( ! prev ) {
                attrSnapshots.set( block.clientId, { ...block.attributes } );
                continue;
            }

            const lockMask   = PSP_Pattern_Lock_JS.getLockMask( pspLock );
            const lockedKeys = PSP_Pattern_Lock_JS.getLockedKeys( lockMask, block.name );
            const freeKeys   = PSP_Pattern_Lock_JS.getFreeKeys( lockMask, block.name );

            // ── 1. Revert locked attr writes ──────────────────────────────────
            const revert = {};
            for ( const key of lockedKeys ) {
                if ( block.attributes[ key ] !== prev[ key ] ) {
                    revert[ key ] = prev[ key ];
                }
            }
            if ( Object.keys( revert ).length > 0 ) {
                if ( DEBUG ) console.log( '[PSP] reverting locked attr write on', block.clientId.slice( 0, 8 ), ':', Object.keys( revert ) );
                reverts.push( { clientId: block.clientId, revert } );
            }

            // ── 2. Capture free attr writes → core/block.content ─────────────
            // When an editor uses any block library's own controls (Stackable
            // Style tab, Kadence Design panel, etc.) to change a FREE-group
            // attr, capture that change so PSP's PHP renderer can apply it.
            const changedFreeAttrs = {};
            for ( const key of freeKeys ) {
                if ( block.attributes[ key ] !== prev[ key ] ) {
                    changedFreeAttrs[ key ] = block.attributes[ key ];
                }
            }

            if ( Object.keys( changedFreeAttrs ).length > 0 ) {
                const blockKey = generateBlockKey( blockStore, coreAncestor.clientId, block.clientId );
                if ( blockKey ) {
                    // Only queue a write if values actually differ from what's
                    // already stored — prevents write loops.
                    const existing      = coreAncestor.attributes.content ?? {};
                    const existingEntry = existing[ blockKey ] ?? {};
                    const needsWrite    = Object.entries( changedFreeAttrs ).some(
                        ( [ k, v ] ) => existingEntry[ k ] !== v
                    );
                    if ( needsWrite ) {
                        if ( DEBUG ) console.log( '[PSP] capturing free attr change:', blockKey, Object.keys( changedFreeAttrs ) );
                        overrideWrites.push( {
                            coreBlockClientId: coreAncestor.clientId,
                            blockKey,
                            changedFreeAttrs,
                        } );
                    }
                }
            }

            // Snapshot with reverted values pegged so next tick sees no diff.
            attrSnapshots.set( block.clientId, { ...block.attributes, ...revert } );
        }

        if ( reverts.length === 0 && overrideWrites.length === 0 ) return;

        revertInProgress = true;
        const d = dispatch( 'core/block-editor' );

        // Apply reverts.
        for ( const { clientId, revert } of reverts ) {
            d.updateBlockAttributes( clientId, revert );
        }

        // Write captures — batched per core/block wrapper.
        if ( overrideWrites.length > 0 ) {
            const byWrapper = new Map();
            for ( const w of overrideWrites ) {
                if ( ! byWrapper.has( w.coreBlockClientId ) ) {
                    byWrapper.set( w.coreBlockClientId, {} );
                }
                const entry = byWrapper.get( w.coreBlockClientId );
                entry[ w.blockKey ] = { ...( entry[ w.blockKey ] ?? {} ), ...w.changedFreeAttrs };
            }

            for ( const [ coreId, newEntries ] of byWrapper ) {
                const coreBlock  = blockStore.getBlock( coreId );
                const existing   = coreBlock?.attributes?.content ?? {};
                const updated    = { ...existing };
                for ( const [ blockKey, attrs ] of Object.entries( newEntries ) ) {
                    updated[ blockKey ] = { ...( existing[ blockKey ] ?? {} ), ...attrs };
                }
                d.updateBlockAttributes( coreId, { content: updated } );
            }
        }

        Promise.resolve().then( () => { revertInProgress = false; } );
    } );

    if ( DEBUG ) console.log( '[PSP] lock enforcement active' );
}
