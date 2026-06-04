/**
 * PSP Lock Enforcement — two-subscriber model.
 *
 * SUBSCRIBER 1 — fast, synchronous: reverts locked-group attribute writes.
 * Runs on every store change, keeps locked attrs from being modified.
 *
 * SUBSCRIBER 2 — debounced, idle-guarded: captures free-group overrides
 * to core/block.content so Design/Layout/Visibility changes made via any
 * block library's own controls (Stackable Style tab, Kadence Design panel)
 * are persisted and applied by PSP's PHP renderer at front-end render time.
 *
 * The idle guard (`getSelectedBlockClientId` truthy) prevents Subscriber 2
 * from running during initial page load / pattern hydration — when WP is
 * making rapid store updates as synced pattern inner blocks are populated.
 * Once the user selects something, the guard passes and captures begin.
 * The 500ms debounce ensures we capture after activity settles, not during
 * every intermediate change (e.g. dragging a colour picker).
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

    // ── Subscriber 1: locked-attr reverts (fast, no debounce) ────────────────

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

    // ── Subscriber 2: free-attr capture (debounced, idle-guarded) ────────────

    let captureTimer = null;

    subscribe( () => {
        if ( revertInProgress ) return;

        const editorStore = select( 'core/editor' );
        const blockStore  = select( 'core/block-editor' );
        if ( ! editorStore || ! blockStore ) return;

        const postType = editorStore.getCurrentPostType?.();
        if ( postType === 'wp_block' || ! postType ) return;

        // Idle guard: only capture after the user has selected a block.
        // This skips the rapid store updates during initial page hydration
        // when WP is populating synced pattern inner blocks.
        if ( ! blockStore.getSelectedBlockClientId?.() ) return;

        // Debounce: schedule capture 500ms after the last store change.
        // By the time the user clicks Save, this will have already fired.
        if ( captureTimer ) clearTimeout( captureTimer );
        captureTimer = setTimeout( () => {
            captureTimer = null;
            captureFreeAttrOverrides( blockStore );
        }, 500 );
    } );

    if ( DEBUG ) console.log( '[PSP] lock enforcement active' );
}

/**
 * Scan all PSP-managed inner blocks and write any free-group attribute
 * changes to their ancestor core/block's `content` attribute.
 *
 * Called 500ms after the last store change when a block is selected —
 * captures Design/Layout/Visibility overrides made via block library
 * controls so PSP's PHP renderer can apply them on the front end.
 *
 * @param {Object} blockStore wp.data.select('core/block-editor')
 */
function captureFreeAttrOverrides( blockStore ) {
    const allBlocks = getAllBlocks( blockStore );
    const byWrapper = new Map(); // coreBlockClientId → { blockKey → { attrKey → value } }

    for ( const block of allBlocks ) {
        const { pspLock } = block.attributes ?? {};
        if ( ! pspLock || Object.keys( pspLock ).length === 0 ) continue;

        const coreAncestor = findCoreBlockAncestor( blockStore, block.clientId );
        if ( ! coreAncestor ) continue;

        const lockMask = PSP_Pattern_Lock_JS.getLockMask( pspLock );
        const freeKeys = PSP_Pattern_Lock_JS.getFreeKeys( lockMask, block.name );
        if ( freeKeys.length === 0 ) continue;

        // Get the stable key for this block.
        const blockKey = generateBlockKey( blockStore, coreAncestor.clientId, block.clientId );
        if ( ! blockKey ) continue;

        // Read what's currently stored for this block.
        const existingContent = coreAncestor.attributes.content ?? {};
        const existingEntry   = existingContent[ blockKey ] ?? {};

        // Collect free-group attrs whose current value differs from stored.
        const updates = {};
        for ( const key of freeKeys ) {
            const current = block.attributes[ key ];
            // Skip undefined values (attr not set on this block).
            if ( current === undefined ) continue;
            // Only write if the value differs from what's stored.
            if ( current !== existingEntry[ key ] ) {
                updates[ key ] = current;
            }
        }

        if ( Object.keys( updates ).length === 0 ) continue;

        if ( ! byWrapper.has( coreAncestor.clientId ) ) {
            byWrapper.set( coreAncestor.clientId, {} );
        }
        const wrapperEntries = byWrapper.get( coreAncestor.clientId );
        wrapperEntries[ blockKey ] = { ...( wrapperEntries[ blockKey ] ?? {} ), ...updates };
    }

    if ( byWrapper.size === 0 ) return;

    // Batch writes per core/block wrapper.
    const d = dispatch( 'core/block-editor' );
    for ( const [ coreId, newEntries ] of byWrapper ) {
        const coreBlock  = blockStore.getBlock( coreId );
        const existing   = coreBlock?.attributes?.content ?? {};
        const updated    = { ...existing };

        for ( const [ blockKey, attrs ] of Object.entries( newEntries ) ) {
            updated[ blockKey ] = { ...( existing[ blockKey ] ?? {} ), ...attrs };
        }

        if ( DEBUG ) console.log( '[PSP] capturing free-attr overrides for', coreId.slice( 0, 8 ), updated );
        d.updateBlockAttributes( coreId, { content: updated } );
    }
}
