/**
 * PSP Lock Enforcement — store-level locked-attribute guard.
 *
 * Subscribes to core/block-editor. On each change, reverts any attribute
 * write that belongs to a locked group.
 *
 * Loop guard: `revertInProgress` blocks re-entrant calls during our own
 * revert dispatches. Released via microtask.
 */

import { subscribe, select, dispatch } from '@wordpress/data';
import { PSP_Pattern_Lock_JS }         from '../utils/lock-utils';

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

        const postType = editorStore.getCurrentPostType?.();
        if ( postType === 'wp_block' || ! postType ) return;

        const allBlocks = getAllBlocks( blockStore );
        const reverts   = [];

        for ( const block of allBlocks ) {
            const { pspLock } = block.attributes ?? {};

            if ( ! pspLock || Object.keys( pspLock ).length === 0 ) {
                attrSnapshots.set( block.clientId, { ...block.attributes } );
                continue;
            }

            if ( ! findCoreBlockAncestor( blockStore, block.clientId ) ) {
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

            attrSnapshots.set( block.clientId, { ...block.attributes, ...revert } );
        }

        if ( reverts.length === 0 ) return;

        revertInProgress = true;
        const d = dispatch( 'core/block-editor' );
        for ( const { clientId, revert } of reverts ) {
            d.updateBlockAttributes( clientId, revert );
        }
        Promise.resolve().then( () => { revertInProgress = false; } );
    } );

    if ( DEBUG ) console.log( '[PSP] lock enforcement active' );
}
