/**
 * PSP Custom Binding Source — `psp/overrides`
 *
 * Registers a WP Block Bindings API source that is storage-compatible with
 * WP's native `core/pattern-overrides` but works for ANY block type, not
 * just the four WP natively supports (Paragraph, Heading, Image, Button).
 *
 * Storage format: identical to `core/pattern-overrides`.
 * Data lives in the `core/block` wrapper's `content` attribute, keyed by
 * the block's `metadata.name`. Example:
 *
 *   <!-- wp:block {
 *     "ref": 49,
 *     "content": {
 *       "stackable-text-mpzibw29": { "text": "Per-instance override" }
 *     }
 *   } /-->
 *
 * Phase 3 note (v0.2.0-alpha):
 *   This source is registered and functional but not yet wired to blocks —
 *   that happens in Phase 4 (Author Panel bindings). PSP currently uses
 *   `pspOverrides` for storage (migrating to `content` in Phase 5). No
 *   existing behavior changes in this phase.
 *
 * TODO (Phase 8 cleanup): remove `pspOverrides` attribute and storage path
 *   once Phase 5 migration is complete.
 */

import { registerBlockBindingsSource } from '@wordpress/blocks';
import { select, dispatch }            from '@wordpress/data';
import { __ }                          from '@wordpress/i18n';

const DEBUG = window.pspData?.debug ?? false;

registerBlockBindingsSource( {
    name:       'psp/overrides',
    label:      __( 'Pattern Sync Pro', 'pattern-sync-pro' ),

    // Same context as core/pattern-overrides — core/block provides this
    // from its `content` attribute so our source receives the same data.
    usesContext: [ 'pattern/overrides' ],

    /**
     * Return current override values for the bound attributes.
     *
     * Called by WP's binding system when rendering a block that has
     * metadata.bindings entries pointing to this source.
     *
     * @param {Object} params
     * @param {string} params.clientId  The bound block's clientId.
     * @param {Object} params.context   Block context — includes pattern/overrides.
     * @param {Object} params.bindings  Map of attrKey → binding config.
     * @return {Object} attrKey → current value
     */
    getValues( { clientId, context, bindings } ) {
        const overrides = context?.[ 'pattern/overrides' ];
        if ( ! overrides ) return {};

        const blockStore = select( 'core/block-editor' );
        const block      = blockStore?.getBlock( clientId );
        const blockName  = block?.attributes?.metadata?.name;

        if ( ! blockName || ! overrides[ blockName ] ) return {};

        const blockOverrides = overrides[ blockName ];

        if ( DEBUG ) {
            console.log( '[PSP] psp/overrides getValues for', blockName, blockOverrides );
        }

        return Object.fromEntries(
            Object.keys( bindings ).map( attrKey => [
                attrKey,
                blockOverrides[ attrKey ],
            ] )
        );
    },

    /**
     * Write new override values back to the core/block wrapper's `content`
     * attribute — the WP-native storage location.
     *
     * Called when a bound attribute is changed in the editor (e.g. a core
     * block's content is edited via canvas or sidebar).
     *
     * @param {Object} params
     * @param {string} params.clientId  The bound block's clientId.
     * @param {Object} params.bindings  attrKey → { source, newValue? }
     */
    setValues( { clientId, bindings } ) {
        const blockStore = select( 'core/block-editor' );
        const block      = blockStore?.getBlock( clientId );
        const blockName  = block?.attributes?.metadata?.name;

        if ( ! blockName ) {
            if ( DEBUG ) console.warn( '[PSP] psp/overrides setValues: no metadata.name on', clientId?.slice( 0, 8 ) );
            return;
        }

        // Find the core/block ancestor to write the content attribute.
        const parents     = blockStore.getBlockParents?.( clientId ) ?? [];
        const coreBlockId = parents.find( pid => {
            const p = blockStore.getBlock( pid );
            return p?.name === 'core/block' && p?.attributes?.ref;
        } );

        if ( ! coreBlockId ) {
            if ( DEBUG ) console.warn( '[PSP] psp/overrides setValues: no core/block ancestor for', clientId?.slice( 0, 8 ) );
            return;
        }

        // Collect only changed values from the bindings map.
        const newValues = {};
        for ( const [ attrKey, binding ] of Object.entries( bindings ) ) {
            if ( binding?.newValue !== undefined ) {
                newValues[ attrKey ] = binding.newValue;
            }
        }

        if ( Object.keys( newValues ).length === 0 ) return;

        // Write to core/block's `content` attribute — WP-native format.
        const coreBlock  = blockStore.getBlock( coreBlockId );
        const existing   = coreBlock?.attributes?.content ?? {};

        if ( DEBUG ) {
            console.log( '[PSP] psp/overrides setValues for', blockName, newValues );
        }

        dispatch( 'core/block-editor' ).updateBlockAttributes( coreBlockId, {
            content: {
                ...existing,
                [ blockName ]: { ...( existing[ blockName ] ?? {} ), ...newValues },
            },
        } );
    },

    /**
     * Whether the current user can edit a bound value.
     * PSP's lock enforcement subscriber handles the actual attribute-level
     * enforcement — this just gates the WP binding UI itself.
     *
     * TODO (Phase 4): check pspLock mask here so WP's binding UI reflects
     *   whether the attribute group is actually free on this block.
     */
    canUserEditValue: () => true,
} );

if ( DEBUG ) {
    console.log( '[PSP] psp/overrides binding source registered' );
}
