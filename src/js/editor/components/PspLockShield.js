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

// CSS class injected on document.body when locked groups are active.
// Injecting on body is more reliable than targeting the inspector element
// since block libraries (Stackable, Kadence) may replace or wrap the
// standard .block-editor-block-inspector container.
const LOCKED_CLASS = 'psp-has-locked-controls';

export function PspLockShield( { attributes } ) {
    const lockMask     = PSP_Pattern_Lock_JS.getLockMask( attributes.pspLock );
    const lockedGroups = Object.entries( lockMask )
        .filter( ( [ , v ] ) => v )
        .map( ( [ g ] ) => g.charAt( 0 ).toUpperCase() + g.slice( 1 ) );
    const hasLocks = lockedGroups.length > 0;

    // Inject / remove a CSS class on document.body.
    // CSS then targets block library panel elements as descendants.
    useEffect( () => {
        if ( hasLocks ) {
            document.body.classList.add( LOCKED_CLASS );
        } else {
            document.body.classList.remove( LOCKED_CLASS );
        }
        return () => document.body.classList.remove( LOCKED_CLASS );
    }, [ hasLocks ] );

    if ( ! hasLocks ) return null;

    const shieldContent = (
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
    );

    return (
        <>
            { /* Default slot — shows on Settings tab */ }
            <InspectorControls>
                <PanelBody
                    title={ __( 'Pattern Sync Pro', 'pattern-sync-pro' ) }
                    icon={ lock }
                    initialOpen={ true }
                    className="psp-panel psp-lock-shield-panel"
                >
                    { shieldContent }
                </PanelBody>
            </InspectorControls>

            { /* Styles slot — shows on Styles tab (WP typography/design controls) */ }
            <InspectorControls group="styles">
                <PanelBody
                    title={ __( 'Pattern Sync Pro', 'pattern-sync-pro' ) }
                    icon={ lock }
                    initialOpen={ true }
                    className="psp-panel psp-lock-shield-panel"
                >
                    { shieldContent }
                </PanelBody>
            </InspectorControls>
        </>
    );
}
