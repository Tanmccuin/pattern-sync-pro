/**
 * PspInstancePanel — shown when an inner block of a PSP-managed pattern
 * instance is selected in the post editor.
 *
 * Fallback panel for when the user navigates into individual inner blocks
 * (e.g. via Outline view). The primary UX is PspPatternPanel on the
 * core/block wrapper.
 *
 * Storage: reads and writes the ancestor core/block's `content` attribute —
 * the same WP-native format used by core/pattern-overrides (v0.2.0-alpha).
 */

import {
    PanelBody,
    Button,
    Icon,
    TextareaControl,
    TextControl,
} from '@wordpress/components';
import { InspectorControls }              from '@wordpress/block-editor';
import { useSelect, useDispatch, select } from '@wordpress/data';
import { useState }                       from '@wordpress/element';
import { __, sprintf }                    from '@wordpress/i18n';
import { lock, external }                 from '@wordpress/icons';
import {
    PSP_Pattern_Lock_JS,
    LOCK_GROUPS,
    getLockGroupsForBlock,
    generateBlockKey,
    getContentFields,
} from '../utils/lock-utils';

const { isPro, siteAdminUrl } = window.pspData ?? {};

const LOCK_GROUP_LABELS = {
    layout:     __( 'Layout',      'pattern-sync-pro' ),
    design:     __( 'Design',      'pattern-sync-pro' ),
    content:    __( 'Content',     'pattern-sync-pro' ),
    visibility: __( 'Visibility',  'pattern-sync-pro' ),
    classes:    __( 'CSS Classes', 'pattern-sync-pro' ),
};

// Content fields now derived dynamically via getContentFields() from lock-utils.

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupHasOverrides( blockOverrides, group, lockGroups ) {
    const keys = lockGroups?.[ group ] ?? LOCK_GROUPS[ group ];
    if ( ! blockOverrides || ! keys ) return false;
    return keys.some( k => k in blockOverrides );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PspInstancePanel( {
    blockName,
    attributes,
    patternId,
    coreBlockClientId,
    blockClientId,
} ) {
    // Use block-specific lock groups (merges third-party library mappings).
    const effectiveLockGroups = getLockGroupsForBlock( blockName );
    const lockMask     = PSP_Pattern_Lock_JS.getLockMask( attributes.pspLock );
    const freeGroups   = Object.entries( lockMask ).filter( ( [ , v ] ) => ! v ).map( ( [ g ] ) => g );
    const lockedGroups = Object.entries( lockMask ).filter( ( [ , v ] ) =>   v ).map( ( [ g ] ) => g );

    const { updateBlockAttributes } = useDispatch( 'core/block-editor' );
    const [ confirmingRevertAll, setConfirmingRevertAll ] = useState( false );

    // Read overrides + blockKey from the core/block ancestor's `content` attr.
    const { blockOverrides, blockKey } = useSelect( ( sel ) => {
        const blockStore = sel( 'core/block-editor' );
        const coreBlock  = blockStore.getBlock( coreBlockClientId );
        const content    = coreBlock?.attributes?.content ?? {};
        const key        = generateBlockKey( blockStore, coreBlockClientId, blockClientId );
        return {
            blockOverrides: key ? ( content[ key ] ?? {} ) : {},
            blockKey:       key,
        };
    }, [ coreBlockClientId, blockClientId ] );

    // Source attribute values for the current block (fallback when no override).
    const sourceAttrs = useSelect( ( sel ) => {
        return sel( 'core/block-editor' ).getBlock( blockClientId )?.attributes ?? {};
    }, [ blockClientId ] );

    // Pattern title.
    const patternTitle = useSelect( ( sel ) => {
        if ( ! patternId ) return '';
        const record = sel( 'core' ).getEntityRecord( 'postType', 'wp_block', patternId );
        return record?.title?.rendered ?? record?.title?.raw ?? '';
    }, [ patternId ] );

    const hasOverrides    = Object.keys( blockOverrides ).length > 0;
    const patternEditUrl  = patternId
        ? `${ siteAdminUrl ?? '/wp-admin/' }post.php?post=${ patternId }&action=edit`
        : null;

    // ── Override write helpers ────────────────────────────────────────────────

    const updateOverride = ( attrKey, value ) => {
        const blockStore = select( 'core/block-editor' );
        const coreBlock  = blockStore.getBlock( coreBlockClientId );
        if ( ! coreBlock || ! blockKey ) return;

        const existing   = coreBlock.attributes.content ?? {};
        const blockEntry = { ...( existing[ blockKey ] ?? {} ) };

        if ( value === ( sourceAttrs[ attrKey ] ?? '' ) ) {
            delete blockEntry[ attrKey ];
        } else {
            blockEntry[ attrKey ] = value;
        }

        const updated = { ...existing };
        if ( Object.keys( blockEntry ).length === 0 ) {
            delete updated[ blockKey ];
        } else {
            updated[ blockKey ] = blockEntry;
        }
        updateBlockAttributes( coreBlockClientId, { content: updated } );
    };

    const resetGroup = ( group ) => {
        const blockStore = select( 'core/block-editor' );
        const coreBlock  = blockStore.getBlock( coreBlockClientId );
        if ( ! coreBlock || ! blockKey ) return;

        const existing   = coreBlock.attributes.content ?? {};
        const groupKeys  = LOCK_GROUPS[ group ] ?? [];
        const blockEntry = Object.fromEntries(
            Object.entries( existing[ blockKey ] ?? {} ).filter( ( [ k ] ) => ! groupKeys.includes( k ) )
        );

        const updated = { ...existing };
        if ( Object.keys( blockEntry ).length === 0 ) {
            delete updated[ blockKey ];
        } else {
            updated[ blockKey ] = blockEntry;
        }
        updateBlockAttributes( coreBlockClientId, { content: updated } );
    };

    const resetAll = () => {
        const blockStore = select( 'core/block-editor' );
        const coreBlock  = blockStore.getBlock( coreBlockClientId );
        if ( ! coreBlock || ! blockKey ) return;

        const updated = { ...( coreBlock.attributes.content ?? {} ) };
        delete updated[ blockKey ];
        updateBlockAttributes( coreBlockClientId, { content: updated } );
        setConfirmingRevertAll( false );
    };

    // ── No-block-key guard ────────────────────────────────────────────────────

    if ( ! blockKey ) return null;

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <InspectorControls>
            <PanelBody
                title={ __( 'Pattern Sync Pro', 'pattern-sync-pro' ) }
                icon={ lock }
                initialOpen={ lockedGroups.length > 0 }
                className="psp-panel psp-instance-panel"
            >
                { /* ── Lock shield — shown when any group is locked ── */ }
                { lockedGroups.length > 0 && (
                    <div className="psp-lock-shield">
                        <span className="psp-lock-shield__icon" aria-hidden="true">🔒</span>
                        <div className="psp-lock-shield__body">
                            <strong>{ __( 'Some controls are locked', 'pattern-sync-pro' ) }</strong>
                            <p>
                                { sprintf(
                                    /* translators: comma-separated group names */
                                    __( '%s — changes will be reverted. Edit the source pattern to unlock.', 'pattern-sync-pro' ),
                                    lockedGroups.map( g => g.charAt( 0 ).toUpperCase() + g.slice( 1 ) ).join( ', ' )
                                ) }
                            </p>
                        </div>
                    </div>
                ) }

                { /* Pattern source link */ }
                { patternEditUrl && (
                    <a
                        href={ patternEditUrl }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="psp-pattern-link"
                    >
                        <span className="psp-pattern-link__eyebrow">
                            { __( 'Pattern:', 'pattern-sync-pro' ) }
                        </span>
                        <span className="psp-pattern-link__name">
                            { patternTitle || __( 'Source pattern', 'pattern-sync-pro' ) }
                        </span>
                        <Icon icon={ external } size={ 12 } />
                    </a>
                ) }

                { /* ── Free groups ── */ }
                { freeGroups.length > 0 && (
                    <div className="psp-section">
                        <div className="psp-section-divider is-free">
                            { __( 'Customizable', 'pattern-sync-pro' ) }
                        </div>

                        { freeGroups.map( group => {
                            const isChanged     = groupHasOverrides( blockOverrides, group, effectiveLockGroups );
                            const groupAttrs    = effectiveLockGroups[ group ] ?? LOCK_GROUPS[ group ] ?? [];
                            // Dynamic content fields — works for any block library.
                            const editableAttrs = group === 'content'
                                ? getContentFields( blockName, groupAttrs, sourceAttrs )
                                : [];

                            return (
                                <div key={ group }>
                                    <div className="psp-group-row psp-group-free">
                                        <span className="psp-group-name">
                                            { LOCK_GROUP_LABELS[ group ] }
                                        </span>
                                        { isChanged && (
                                            <>
                                                <span className="psp-changed-dot" aria-label={ __( 'Has overrides', 'pattern-sync-pro' ) } />
                                                <Button
                                                    className="psp-group-reset"
                                                    variant="tertiary"
                                                    size="small"
                                                    onClick={ () => resetGroup( group ) }
                                                    aria-label={ sprintf(
                                                        __( 'Reset %s to pattern default', 'pattern-sync-pro' ),
                                                        LOCK_GROUP_LABELS[ group ]
                                                    ) }
                                                >
                                                    { __( 'Reset', 'pattern-sync-pro' ) }
                                                </Button>
                                            </>
                                        ) }
                                    </div>

                                    { /* Inline editing fields for content group */ }
                                    { editableAttrs.map( ( { attrKey, label, control } ) => {
                                        const currentValue = blockOverrides[ attrKey ] ?? sourceAttrs[ attrKey ] ?? '';
                                        const isOverridden = attrKey in blockOverrides;

                                        return (
                                            <div key={ attrKey } className="psp-field-row">
                                                { control === 'textarea' ? (
                                                    <TextareaControl
                                                        __nextHasNoMarginBottom
                                                        label={ label }
                                                        value={ currentValue }
                                                        onChange={ ( val ) => updateOverride( attrKey, val ) }
                                                        className={ isOverridden ? 'psp-field--overridden' : '' }
                                                        rows={ 3 }
                                                    />
                                                ) : (
                                                    <TextControl
                                                        __nextHasNoMarginBottom
                                                        label={ label }
                                                        value={ currentValue }
                                                        onChange={ ( val ) => updateOverride( attrKey, val ) }
                                                        className={ isOverridden ? 'psp-field--overridden' : '' }
                                                    />
                                                ) }
                                            </div>
                                        );
                                    } ) }

                                    { /* For non-content groups: guide the editor to use the block's own controls */ }
                                    { group !== 'content' && editableAttrs.length === 0 && (
                                        <p className="psp-field-note">
                                            { __( 'Use this block\'s sidebar controls to override. PSP captures changes automatically.', 'pattern-sync-pro' ) }
                                        </p>
                                    ) }
                                </div>
                            );
                        } ) }
                    </div>
                ) }

                { /* ── Locked groups ── */ }
                { lockedGroups.length > 0 && (
                    <div className="psp-section">
                        <div className="psp-section-divider">
                            { __( 'Locked', 'pattern-sync-pro' ) }
                        </div>
                        { lockedGroups.map( group => (
                            <div key={ group } className="psp-group-row psp-group-locked">
                                <span className="psp-group-name">{ LOCK_GROUP_LABELS[ group ] }</span>
                            </div>
                        ) ) }
                    </div>
                ) }

                { /* ── All locked notice ── */ }
                { freeGroups.length === 0 && (
                    <div className="psp-all-locked-notice">
                        <Icon icon={ lock } size={ 16 } />
                        <span>
                            { __( 'All groups are locked. Edit the source pattern to allow customisation.', 'pattern-sync-pro' ) }
                        </span>
                    </div>
                ) }

                { /* ── Reset all ── */ }
                { hasOverrides && (
                    <div className="psp-revert-all">
                        { ! confirmingRevertAll ? (
                            <Button variant="tertiary" isDestructive size="small"
                                onClick={ () => setConfirmingRevertAll( true ) }
                            >
                                { __( 'Reset all changes', 'pattern-sync-pro' ) }
                            </Button>
                        ) : (
                            <div className="psp-revert-all__confirm">
                                <p>{ __( 'Reset all customisations on this block?', 'pattern-sync-pro' ) }</p>
                                <div className="psp-revert-all__actions">
                                    <Button variant="primary" isDestructive size="small" onClick={ resetAll }>
                                        { __( 'Yes, reset', 'pattern-sync-pro' ) }
                                    </Button>
                                    <Button variant="secondary" size="small"
                                        onClick={ () => setConfirmingRevertAll( false ) }
                                    >
                                        { __( 'Cancel', 'pattern-sync-pro' ) }
                                    </Button>
                                </div>
                            </div>
                        ) }
                    </div>
                ) }

                { /* ── Pro upsell ── */ }
                { ! isPro && (
                    <div className="psp-pro-upsell">
                        <span className="psp-pro-badge">{ __( 'Pro', 'pattern-sync-pro' ) }</span>
                        <div className="psp-pro-body">
                            <p>{ __( 'Override design, layout, and visibility. History, rollback, role-based permissions.', 'pattern-sync-pro' ) }</p>
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
