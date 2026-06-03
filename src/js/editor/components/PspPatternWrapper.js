/**
 * PspPatternWrapper
 *
 * Switches the sidebar context for PSP-managed synced patterns so inner
 * blocks' InspectorControls fills (including PspPatternPanel) are rendered
 * when the pattern block or any of its inner blocks is selected.
 *
 * Problem with the original one-shot approach:
 * We used `didActivate.current` (a useRef) to call
 * `__unstableSetTemporarilyEditingAsBlocks` once on mount. WP resets
 * `temporarilyEditingAs` when the user clicks away from the pattern, so
 * on re-selection the sidebar reverted to "Edit original" with no way to
 * recover without navigating to Outline view.
 *
 * Fix: track whether the pattern (or any inner block) is currently selected,
 * and whether `temporarilyEditingAs` is already pointing at this wrapper.
 * Re-call the activation whenever the pattern is selected but the sidebar
 * context has been cleared by WP.
 */

import { addFilter }                  from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect, useDispatch }     from '@wordpress/data';
import { useEffect }                  from '@wordpress/element';

const DEBUG = window.pspData?.debug ?? false;

const withPspPatternWrapper = createHigherOrderComponent( ( BlockEdit ) => {
    return ( props ) => {
        const { clientId, name } = props;

        const { isTargetPattern, needsActivation } = useSelect( ( select ) => {
            if ( name !== 'core/block' ) return { isTargetPattern: false, needsActivation: false };

            const editorStore      = select( 'core/editor' );
            const blockEditorStore = select( 'core/block-editor' );
            if ( ! editorStore || ! blockEditorStore ) return { isTargetPattern: false, needsActivation: false };

            const postType = editorStore.getCurrentPostType?.();
            if ( postType === 'wp_block' || ! postType ) return { isTargetPattern: false, needsActivation: false };

            // Use getClientIdsWithDescendants rather than getBlocks so we find
            // pspLock on blocks nested at any depth — third-party libraries like
            // Stackable/Kadence commonly put content blocks 2-4 levels deep.
            // This also handles async hydration: useSelect re-runs when the
            // store changes, so if blocks load after initial paint they're caught.
            // Verify parent chain so blocks from OTHER synced patterns on the
            // same page don't bleed in when this pattern's inner blocks haven't
            // hydrated yet (WP loads synced pattern inner blocks asynchronously).
            const allIds = blockEditorStore.getClientIdsWithDescendants?.( clientId ) ?? [];
            const ownIds = allIds.filter( id =>
                ( blockEditorStore.getBlockParents?.( id ) ?? [] ).includes( clientId )
            );
            const hasPspBlocks = ownIds.some( id => {
                const b = blockEditorStore.getBlock( id );
                return b?.attributes?.pspLock && Object.keys( b.attributes.pspLock ).length > 0;
            } );

            if ( ! hasPspBlocks ) return { isTargetPattern: false, needsActivation: false };

            // Is this pattern or any of its inner blocks currently selected?
            const isSelected =
                blockEditorStore.isBlockSelected?.( clientId ) ||
                blockEditorStore.hasSelectedInnerBlock?.( clientId, true );

            // Has WP already activated the sidebar context for this wrapper?
            const temporarilyEditingAs = blockEditorStore.__unstableGetTemporarilyEditingAsBlocks?.();
            const isActivated = temporarilyEditingAs === clientId;

            return {
                isTargetPattern: true,
                // Needs activation when: something is selected in/on this pattern
                // but WP has not yet (or has reset) the temporarily-editing state.
                needsActivation: Boolean( isSelected ) && ! isActivated,
            };
        }, [ clientId, name ] );

        const dispatch = useDispatch( 'core/block-editor' );

        useEffect( () => {
            if ( ! isTargetPattern || ! needsActivation ) return;

            if ( DEBUG ) console.log( '[PSP] activating sidebar context for', clientId.slice( 0, 8 ) );

            const timer = setTimeout( () => {
                dispatch.__unstableSetTemporarilyEditingAsBlocks?.( clientId );
            }, 50 );

            return () => clearTimeout( timer );

        }, [ isTargetPattern, needsActivation, clientId ] );

        return <BlockEdit { ...props } />;
    };
}, 'withPspPatternWrapper' );

addFilter(
    'editor.BlockEdit',
    'pattern-sync-pro/pattern-wrapper',
    withPspPatternWrapper,
    5
);
