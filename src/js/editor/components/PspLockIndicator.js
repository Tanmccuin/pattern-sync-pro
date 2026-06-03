/**
 * PspLockIndicator — visual overlays for PSP-managed blocks in the canvas.
 *
 * Two types of indicators:
 *
 * 1. Inner-block lock stripe — a subtle left-border colour on inner blocks
 *    inside a synced pattern indicating their lock state (fully locked,
 *    partially locked, fully free).
 *
 * 2. Pattern wrapper override badge — when the core/block wrapper has active
 *    pspOverrides, shows a small "Overridden" badge on the block in the
 *    canvas so editors know overrides are in effect even before opening the
 *    sidebar. Addresses the canvas-vs-frontend preview gap.
 */

import { useSelect }           from '@wordpress/data';
import { __ }                  from '@wordpress/i18n';
import { PSP_Pattern_Lock_JS } from '../utils/lock-utils';

export function withPspLockIndicator( BlockListBlock ) {
    return ( props ) => {
        const { clientId, name, attributes } = props;

        const { isInsideSyncedPattern, hasOverrides } = useSelect( ( select ) => {
            const { getBlockParents, getBlock } = select( 'core/block-editor' );

            const parents    = getBlockParents( clientId );
            const inPattern  = parents.some( pid => getBlock( pid )?.name === 'core/block' );

            // For core/block wrappers — check if pspOverrides has any entries.
            const overrides  = name === 'core/block'
                ? ( attributes?.pspOverrides ?? {} )
                : {};

            return {
                isInsideSyncedPattern: inPattern,
                hasOverrides:          Object.keys( overrides ).length > 0,
            };
        }, [ clientId, name ] );

        // ── core/block wrapper with active overrides ──────────────────────────
        if ( name === 'core/block' && hasOverrides ) {
            return (
                <BlockListBlock
                    { ...props }
                    className={ `${ props.className ?? '' } psp-pattern--has-overrides`.trim() }
                    wrapperProps={ {
                        ...( props.wrapperProps ?? {} ),
                        'data-psp-overrides': 'true',
                    } }
                />
            );
        }

        // ── Inner block lock stripe ───────────────────────────────────────────
        if ( ! isInsideSyncedPattern || ! attributes?.pspLock ) {
            return <BlockListBlock { ...props } />;
        }

        const lockMask    = PSP_Pattern_Lock_JS.getLockMask( attributes.pspLock );
        const allLocked   = Object.values( lockMask ).every( Boolean );
        const allFree     = Object.values( lockMask ).every( v => ! v );
        const partialLock = ! allLocked && ! allFree;

        const lockClass = allLocked
            ? 'psp-block--fully-locked'
            : partialLock
            ? 'psp-block--partially-locked'
            : 'psp-block--fully-free';

        return (
            <BlockListBlock
                { ...props }
                className={ `${ props.className ?? '' } psp-block ${ lockClass }`.trim() }
                wrapperProps={ {
                    ...( props.wrapperProps ?? {} ),
                    'data-psp-lock': JSON.stringify( lockMask ),
                } }
            />
        );
    };
}
