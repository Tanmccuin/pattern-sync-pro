/**
 * PspLockShield — compact lock status shown on inner blocks of PSP patterns.
 *
 * Replaces the full PspInstancePanel on inner blocks to avoid Stackable
 * (and other block libraries) rendering duplicate panels — they call
 * BlockEdit once per tab internally, causing InspectorControls fills to
 * stack. PspLockShield renders a single, compact panel that only shows
 * the lock shield warning and a link to the full override UI on the wrapper.
 *
 * Full override editing (textarea, group status, chip nav) is in
 * PspPatternPanel, mounted on the core/block wrapper.
 */

import { PanelBody }          from '@wordpress/components';
import { InspectorControls }  from '@wordpress/block-editor';
import { useEffect }          from '@wordpress/element';
import { __, sprintf }        from '@wordpress/i18n';
import { lock }               from '@wordpress/icons';
import { PSP_Pattern_Lock_JS } from '../utils/lock-utils';

// CSS class injected on the inspector element when locked groups are active.
// Used by editor.scss to overlay a lock shield over the block library's controls.
const LOCKED_CLASS = 'psp-inspector--has-locks';

export function PspLockShield( { attributes } ) {
    const lockMask     = PSP_Pattern_Lock_JS.getLockMask( attributes.pspLock );
    const lockedGroups = Object.entries( lockMask )
        .filter( ( [ , v ] ) => v )
        .map( ( [ g ] ) => g.charAt( 0 ).toUpperCase() + g.slice( 1 ) );
    const hasLocks = lockedGroups.length > 0;

    // Inject / remove a CSS class on the block inspector wrapper so that
    // our CSS can overlay the block library controls that follow.
    useEffect( () => {
        const inspector = document.querySelector( '.block-editor-block-inspector' );
        if ( ! inspector ) return;

        if ( hasLocks ) {
            inspector.classList.add( LOCKED_CLASS );
        } else {
            inspector.classList.remove( LOCKED_CLASS );
        }

        return () => inspector.classList.remove( LOCKED_CLASS );
    }, [ hasLocks ] );

    if ( ! hasLocks ) return null;

    return (
        <InspectorControls>
            <PanelBody
                title={ __( 'Pattern Sync Pro', 'pattern-sync-pro' ) }
                icon={ lock }
                initialOpen={ true }
                className="psp-panel psp-lock-shield-panel"
            >
                <div className="psp-lock-shield">
                    <span className="psp-lock-shield__icon" aria-hidden="true">🔒</span>
                    <div className="psp-lock-shield__body">
                        <strong>{ __( 'Controls are locked', 'pattern-sync-pro' ) }</strong>
                        <p>
                            { sprintf(
                                /* translators: comma-separated group names */
                                __( '%s — changes will be reverted. Select the pattern block to manage overrides.', 'pattern-sync-pro' ),
                                lockedGroups.join( ', ' )
                            ) }
                        </p>
                    </div>
                </div>
            </PanelBody>
        </InspectorControls>
    );
}
