/**
 * usePspContext — resolves everything PSP needs to know about the
 * currently selected block in one place.
 *
 * Returns:
 *   - isInsideSyncedPattern   whether the block lives inside a synced pattern ref
 *   - isPatternSource         whether we're editing the source pattern itself (wp_block)
 *   - isPatternInstance       inside a pattern instance on a regular post/page
 *   - patternId               the wp_block post ID of the source pattern (if resolvable)
 *   - postId                  the current post being edited
 *   - lockMask                the resolved pspLock for this block
 *   - instanceId              the pspInstanceId (may be empty on first encounter)
 */

import { useSelect } from '@wordpress/data';
import { useEntityProp } from '@wordpress/core-data';
import { PSP_Pattern_Lock_JS } from '../utils/lock-utils';

export function usePspContext( clientId, attributes ) {
    const { pspLock, pspInstanceId } = attributes;

    const {
        postId,
        postType,
        parentBlocks,
        parentBlockTypes,
    } = useSelect( ( select ) => {
        const { getCurrentPostId, getCurrentPostType }     = select( 'core/editor' );
        const { getBlockParents, getBlock }                = select( 'core/block-editor' );

        const parents     = getBlockParents( clientId );
        const parentData  = parents.map( ( pid ) => getBlock( pid ) );

        return {
            postId:           getCurrentPostId(),
            postType:         getCurrentPostType(),
            parentBlocks:     parentData,
            parentBlockTypes: parentData.map( ( b ) => b?.name ),
        };
    }, [ clientId ] );

    // Are we editing the source pattern itself?
    const isPatternSource = postType === 'wp_block';

    // Is this block inside a synced pattern reference block?
    const syncedPatternParent = parentBlocks.find(
        ( b ) => b?.name === 'core/block' && b?.attributes?.ref
    );
    const isInsideSyncedPattern = Boolean( syncedPatternParent );
    const patternId             = syncedPatternParent?.attributes?.ref ?? null;

    // Instance editing = inside a synced pattern on a non-source post.
    const isPatternInstance = isInsideSyncedPattern && ! isPatternSource;

    const lockMask = PSP_Pattern_Lock_JS.getLockMask( pspLock );

    return {
        isPatternSource,
        isInsideSyncedPattern,
        isPatternInstance,
        patternId,
        postId,
        lockMask,
        instanceId: pspInstanceId ?? '',
    };
}
