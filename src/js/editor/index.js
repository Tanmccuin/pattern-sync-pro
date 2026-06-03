/**
 * Pattern Sync Pro — Block Editor Entry Point
 */

import '../../scss/editor.scss';

import { addFilter }                  from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect }                  from '@wordpress/data';
import { useEffect }                  from '@wordpress/element';

import './components/PspPatternWrapper';
import { initLockEnforcement }  from './store/lock-enforcement';
import { PspAuthorPanel }       from './components/PspAuthorPanel';
import { PspInstancePanel }     from './components/PspInstancePanel';
import { PspPatternPanel }      from './components/PspPatternPanel';
import { withPspLockIndicator } from './components/PspLockIndicator';

// Store-level lock enforcement — must run after stores are registered.
initLockEnforcement();

const DEBUG = window.pspData?.debug ?? false;

// ── 1. Register attributes ────────────────────────────────────────────────────
//
// pspLock     — on every block; the author sets this in the source pattern.
// pspOverrides — on core/block only; stores per-instance attribute overrides
//                directly in the post's block comment so WP's native save
//                flow persists them without a separate REST round-trip.

addFilter(
    'blocks.registerBlockType',
    'pattern-sync-pro/register-attributes',
    ( settings, name ) => {
        const extra = {
            pspLock: { type: 'object', default: {} },
        };

        if ( name === 'core/block' ) {
            extra.pspOverrides = { type: 'object', default: {} };
        }

        return {
            ...settings,
            attributes: { ...settings.attributes, ...extra },
        };
    }
);

// ── 2. Main inspector HOC ─────────────────────────────────────────────────────

const withPspInspector = createHigherOrderComponent( ( BlockEdit ) => {
    return ( props ) => {
        const { clientId, name, attributes, setAttributes } = props;

        const context = useSelect( ( select ) => {
            const editorStore      = select( 'core/editor' );
            const blockEditorStore = select( 'core/block-editor' );

            if ( ! editorStore || ! blockEditorStore ) return null;

            const postType = editorStore.getCurrentPostType?.() ?? null;
            const postId   = editorStore.getCurrentPostId?.()   ?? null;
            if ( ! postType || ! postId ) return null;

            const parents      = blockEditorStore.getBlockParents?.( clientId ) ?? [];
            const parentBlocks = parents
                .map( pid => blockEditorStore.getBlock?.( pid ) )
                .filter( Boolean );

            const syncedParent = parentBlocks.find(
                b => b.name === 'core/block' && b.attributes?.ref
            );

            // Detect when THIS block is a synced pattern wrapper with PSP-managed inner blocks.
            // This enables the PspPatternPanel to mount on the core/block itself.
            let isPatternWrapper = false;
            if ( name === 'core/block' && attributes?.ref && postType !== 'wp_block' ) {
                const allIds = blockEditorStore.getClientIdsWithDescendants?.( clientId ) ?? [];
                isPatternWrapper = allIds.some( id => {
                    const b = blockEditorStore.getBlock( id );
                    return b?.attributes?.pspLock && Object.keys( b.attributes.pspLock ).length > 0;
                } );
            }

            return {
                postType,
                isPatternSource:       postType === 'wp_block',
                isInsideSyncedPattern: Boolean( syncedParent ),
                isPatternWrapper,
                patternId:             isPatternWrapper
                                           ? attributes?.ref
                                           : ( syncedParent?.attributes?.ref ?? null ),
                coreBlockClientId:     syncedParent?.clientId ?? null,
            };
        }, [ clientId, name ] );

        if ( ! context ) return <BlockEdit { ...props } />;

        const { isPatternSource, isInsideSyncedPattern, isPatternWrapper, patternId, coreBlockClientId } = context;
        const isPatternInstance = isInsideSyncedPattern && ! isPatternSource;

        // Warn in debug mode if we're inside a synced pattern but couldn't
        // find the core/block ancestor — shouldn't happen in normal use.
        useEffect( () => {
            if ( DEBUG && isPatternInstance && ! coreBlockClientId ) {
                console.warn( '[PSP] isPatternInstance=true but no coreBlockClientId found for', clientId.slice( 0, 8 ) );
            }
        }, [ isPatternInstance, coreBlockClientId ] );

        return (
            <>
                <BlockEdit { ...props } />

                { /* Author view — editing the source pattern */ }
                { isPatternSource && (
                    <PspAuthorPanel
                        attributes={ attributes }
                        setAttributes={ setAttributes }
                    />
                ) }

                { /* Pattern wrapper — shows chip nav for all blocks (primary UX) */ }
                { isPatternWrapper && (
                    <PspPatternPanel
                        coreBlockClientId={ clientId }
                        patternId={ patternId }
                    />
                ) }

                { /* Inner block fallback — shown when navigating into individual blocks */ }
                { isPatternInstance && coreBlockClientId && (
                    <PspInstancePanel
                        blockName={ name }
                        attributes={ attributes }
                        patternId={ patternId }
                        coreBlockClientId={ coreBlockClientId }
                        blockClientId={ clientId }
                    />
                ) }
            </>
        );
    };
}, 'withPspInspector' );

addFilter(
    'editor.BlockEdit',
    'pattern-sync-pro/with-psp-inspector',
    withPspInspector
);

// ── 3. Lock indicator ─────────────────────────────────────────────────────────

addFilter(
    'editor.BlockListBlock',
    'pattern-sync-pro/with-lock-indicator',
    withPspLockIndicator
);
