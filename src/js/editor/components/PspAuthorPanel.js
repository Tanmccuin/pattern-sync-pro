/**
 * PspAuthorPanel — shown when editing the SOURCE pattern (wp_block CPT).
 *
 * Lets the pattern author configure which attribute groups editors can
 * override on instances. Two things happen when the lock state changes:
 *
 * 1. `pspLock` is updated — drives PSP's lock enforcement and UI.
 * 2. `__experimentalBindings` is updated — adds WP native `core/pattern-overrides`
 *    bindings for every free-group attribute that exists on this block type.
 *    This is what actually makes RichText fields editable per-instance in WP 7.0+.
 *    Without bindings, WP renders synced pattern blocks as static HTML regardless
 *    of Redux editing-mode state.
 * 3. `metadata.name` is set to a stable identifier the first time any group is
 *    unlocked — WP uses this as the key for per-instance override storage.
 */

import { PanelBody, ToggleControl, Button } from '@wordpress/components';
import { InspectorControls }               from '@wordpress/block-editor';
import { __, sprintf }                     from '@wordpress/i18n';

const { isPro } = window.pspData ?? {};

const LOCK_GROUP_META = {
    layout: {
        label: __( 'Layout', 'pattern-sync-pro' ),
        help:  __( 'Alignment, padding, margin, flex/grid settings.', 'pattern-sync-pro' ),
        icon:  '⊞',
    },
    design: {
        label: __( 'Design', 'pattern-sync-pro' ),
        help:  __( 'Colors, typography, borders, shadows.', 'pattern-sync-pro' ),
        icon:  '◑',
    },
    content: {
        label: __( 'Content', 'pattern-sync-pro' ),
        help:  __( 'Text, images, links, captions.', 'pattern-sync-pro' ),
        icon:  '¶',
    },
    visibility: {
        label: __( 'Visibility', 'pattern-sync-pro' ),
        help:  __( 'Responsive show/hide settings.', 'pattern-sync-pro' ),
        icon:  '◎',
    },
    classes: {
        label: __( 'CSS Classes', 'pattern-sync-pro' ),
        help:  __( 'Custom class names and anchor IDs.', 'pattern-sync-pro' ),
        icon:  '#',
    },
};

// Matches PHP PSP_Pattern_Lock::DEFAULT_LOCK
const DEFAULT_LOCK = { layout: true, design: true, content: false, visibility: true, classes: true };
const ALL_LOCKED   = { layout: true, design: true, content: true,  visibility: true, classes: true };
const CONTENT_FREE = { layout: true, design: true, content: false, visibility: true, classes: true };

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Generate a stable metadata.name for a block if one isn't already set.
 * Format: {shortBlockType}-{base36timestamp}, e.g. "paragraph-1ax2z3".
 * Once set, never regenerated — this is the universal override key for
 * both WP native and PSP storage in Phases 3+.
 */
function ensureMetadataName( attributes, blockName ) {
    if ( attributes?.metadata?.name ) return attributes.metadata.name;
    const short = blockName.replace( /^core\//, '' ).replace( /\//g, '-' );
    return `${ short }-${ Date.now().toString( 36 ) }`;
}

export function PspAuthorPanel( { name, attributes, setAttributes } ) {
    // A block is "enabled" in PSP when its pspLock has been explicitly set.
    // Blocks with empty pspLock {} haven't been configured yet — show the
    // enable prompt rather than the full lock UI.
    const isEnabled = Object.keys( attributes.pspLock ?? {} ).length > 0;

    // ── Not yet enabled — show a lightweight opt-in prompt ───────────────────
    if ( ! isEnabled ) {
        return (
            <InspectorControls>
                <PanelBody
                    title={ __( 'Sync Controls', 'pattern-sync-pro' ) }
                    initialOpen={ true }
                    className="psp-panel psp-author-panel"
                >
                    <div className="psp-enable-prompt">
                        <p className="psp-muted">
                            { __( 'This block isn\'t managed by Pattern Sync Pro yet. Enable it to control which attribute groups editors can override on instances.', 'pattern-sync-pro' ) }
                        </p>
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={ () => setAttributes( {
                                pspLock:  DEFAULT_LOCK,
                                metadata: {
                                    ...( attributes.metadata ?? {} ),
                                    name: ensureMetadataName( attributes, name ),
                                },
                            } ) }
                        >
                            { __( 'Enable PSP for this block', 'pattern-sync-pro' ) }
                        </Button>
                    </div>
                </PanelBody>
            </InspectorControls>
        );
    }

    const pspLock = { ...DEFAULT_LOCK, ...( attributes.pspLock ?? {} ) };

    const lockedCount = Object.values( pspLock ).filter( Boolean ).length;
    const totalCount  = Object.keys( LOCK_GROUP_META ).length;
    const openCount   = totalCount - lockedCount;
    const allLocked   = openCount === 0;
    const allOpen     = lockedCount === 0;

    const applyLock = ( newLock ) => {
        const updates = { pspLock: newLock };

        if ( Object.keys( newLock ).length > 0 ) {
            // Ensure metadata.name is set — the stable override key for
            // both WP native (Phase 4) and PSP storage (Phase 5).
            updates.metadata = {
                ...( attributes.metadata ?? {} ),
                name: ensureMetadataName( attributes, name ),
            };
        } else {
            // PSP removed — clear metadata.name so WP doesn't interpret
            // this block as having outstanding bindings.
            const { name: _n, ...restMeta } = attributes.metadata ?? {};
            updates.metadata = Object.keys( restMeta ).length > 0 ? restMeta : undefined;
        }

        setAttributes( updates );
    };

    const updateLock  = ( group, value ) => applyLock( { ...pspLock, [ group ]: value } );

    const pillClass = allLocked ? 'is-all-locked' : allOpen ? 'is-all-open' : 'is-mixed';
    const pillLabel = allLocked
        ? __( 'All locked', 'pattern-sync-pro' )
        : allOpen
        ? __( 'All open', 'pattern-sync-pro' )
        /* translators: 1: locked count, 2: open count */
        : sprintf( __( '%1$d locked · %2$d open', 'pattern-sync-pro' ), lockedCount, openCount );

    return (
        <InspectorControls>
            <PanelBody
                title={ __( 'Sync Controls', 'pattern-sync-pro' ) }
                initialOpen={ true }
                className="psp-panel psp-author-panel"
            >
                { /* Status + presets in one compact row */ }
                <div className="psp-header-row">
                    <span className={ `psp-status-pill ${ pillClass }` }>
                        { pillLabel }
                    </span>
                    <div className="psp-presets">
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={ () => applyLock( ALL_LOCKED ) }
                            aria-pressed={ allLocked }
                        >
                            { __( 'Lock all', 'pattern-sync-pro' ) }
                        </Button>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={ () => applyLock( CONTENT_FREE ) }
                            aria-pressed={ JSON.stringify( pspLock ) === JSON.stringify( CONTENT_FREE ) }
                        >
                            { __( 'Content only', 'pattern-sync-pro' ) }
                        </Button>
                    </div>
                </div>

                { Object.entries( LOCK_GROUP_META ).map( ( [ group, meta ] ) => {
                    const isLocked = pspLock[ group ] ?? true;
                    return (
                        <div
                            key={ group }
                            className={ `psp-toggle-row ${ isLocked ? 'is-locked' : 'is-open' }` }
                        >
                            <span className="psp-group-icon" aria-hidden="true">
                                { meta.icon }
                            </span>
                            <ToggleControl
                                __nextHasNoMarginBottom
                                label={ meta.label }
                                help={ meta.help }
                                checked={ isLocked }
                                onChange={ ( val ) => updateLock( group, val ) }
                            />
                        </div>
                    );
                } ) }

                { /* Disable option — lets authors remove a block from PSP */ }
                <div className="psp-disable-row">
                    <Button
                        variant="tertiary"
                        size="small"
                        isDestructive
                        onClick={ () => setAttributes( { pspLock: {} } ) }
                    >
                        { __( 'Remove from PSP', 'pattern-sync-pro' ) }
                    </Button>
                </div>

                { ! isPro && (
                    <div className="psp-pro-upsell">
                        <span className="psp-pro-badge">{ __( 'Pro', 'pattern-sync-pro' ) }</span>
                        <div className="psp-pro-body">
                            <p>
                                { __( 'Lock just', 'pattern-sync-pro' ) }{ ' ' }
                                <em>{ __( 'font size', 'pattern-sync-pro' ) }</em>
                                { ', ' }
                                { __( 'not all of Design. Per-attribute control, role-based permissions, override history.', 'pattern-sync-pro' ) }
                            </p>
                            <a href="https://patternsyncpro.com/upgrade" target="_blank" rel="noopener noreferrer">
                                { __( 'Upgrade to Pro →', 'pattern-sync-pro' ) }
                            </a>
                        </div>
                    </div>
                ) }
            </PanelBody>
        </InspectorControls>
    );
}
