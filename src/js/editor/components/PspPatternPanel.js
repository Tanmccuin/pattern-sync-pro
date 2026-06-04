/**
 * PspPatternPanel — mounted on the `core/block` (synced pattern) wrapper.
 *
 * Shows all PSP-managed blocks in the pattern as a chip navigator. The
 * editor clicks a chip to select a block, then sees that block's free/locked
 * groups and editing fields. Fully locked blocks appear in the chip row
 * greyed out — giving editors full context of what is and isn't overridable.
 *
 * This panel activates from the List View (select the pattern → see all blocks),
 * removing the need to navigate into individual inner blocks.
 */

import {
    PanelBody,
    Button,
    Icon,
    TextareaControl,
    TextControl,
} from '@wordpress/components';
import { InspectorControls }            from '@wordpress/block-editor';
import { useSelect, useDispatch, select } from '@wordpress/data';
import { useState, useEffect }          from '@wordpress/element';
import { __, sprintf }                  from '@wordpress/i18n';
import { lock, unlock }                 from '@wordpress/icons';
import {
    PSP_Pattern_Lock_JS,
    LOCK_GROUPS,
    getLockGroupsForBlock,
    generateBlockKey,
    getContentFields,
} from '../utils/lock-utils';

const { isPro, siteAdminUrl, debug: DEBUG } = window.pspData ?? {};

// ── Label helpers ─────────────────────────────────────────────────────────────

// Container/wrapper blocks — blocks that hold other blocks as children.
// These get "WRAP" as their base label to distinguish from content blocks.
const WRAPPER_BLOCK_TYPES = new Set( [
    'core/group', 'core/columns', 'core/cover', 'core/media-text',
    'stackable/columns', 'stackable/column', 'stackable/hero',
    'stackable/card', 'stackable/feature', 'stackable/feature-grid',
    'generateblocks/container', 'generateblocks/grid',
    'kadence/rowlayout', 'kadence/column',
    'uagb/section', 'uagb/columns', 'uagb/column',
] );

const CHIP_LABELS = {
    // Core content blocks
    'core/paragraph':     '¶',
    'core/image':         'IMG',
    'core/button':        'BTN',
    'core/list':          'LIST',
    'core/list-item':     'LI',
    'core/quote':         '"',
    'core/pullquote':     '❝',
    'core/video':         'VID',
    'core/audio':         'AUD',
    'core/file':          'FILE',
    'core/spacer':        '↕',
    'core/separator':     '—',
    'core/html':          'HTML',
    'core/code':          '</>',
    'core/preformatted':  'PRE',
    'core/table':         'TBL',
    'core/gallery':       'GAL',
    // Core containers — use WRAP
    'core/group':         'WRAP',
    'core/columns':       'WRAP',
    'core/column':        'COL',
    'core/cover':         'WRAP',
    'core/media-text':    'WRAP',
    // Stackable
    'stackable/columns':  'WRAP',
    'stackable/column':   'COL',
    'stackable/text':     'TXT',
    'stackable/heading':  'HDG',
    'stackable/image':    'IMG',
    'stackable/button':   'BTN',
    // GenerateBlocks
    'generateblocks/container': 'WRAP',
    'generateblocks/text':      'TXT',
    'generateblocks/image':     'IMG',
    'generateblocks/button':    'BTN',
    // Kadence
    'kadence/rowlayout':        'WRAP',
    'kadence/column':           'COL',
    'kadence/advancedheading':  'HDG',
    'kadence/advancedbutton':   'BTN',
    'kadence/image':            'IMG',
};

const FULL_NAMES = {
    'core/paragraph':    __( 'Paragraph',   'pattern-sync-pro' ),
    'core/heading':      __( 'Heading',     'pattern-sync-pro' ),
    'core/image':        __( 'Image',       'pattern-sync-pro' ),
    'core/button':       __( 'Button',      'pattern-sync-pro' ),
    'core/group':        __( 'Group',       'pattern-sync-pro' ),
    'core/columns':      __( 'Columns',     'pattern-sync-pro' ),
    'core/column':       __( 'Column',      'pattern-sync-pro' ),
    'core/list':         __( 'List',        'pattern-sync-pro' ),
    'core/list-item':    __( 'List item',   'pattern-sync-pro' ),
    'core/quote':        __( 'Quote',       'pattern-sync-pro' ),
    'core/cover':        __( 'Cover',       'pattern-sync-pro' ),
    'core/video':        __( 'Video',       'pattern-sync-pro' ),
    'core/audio':        __( 'Audio',       'pattern-sync-pro' ),
    'core/table':        __( 'Table',       'pattern-sync-pro' ),
    'core/gallery':      __( 'Gallery',     'pattern-sync-pro' ),
    'core/media-text':   __( 'Media & Text','pattern-sync-pro' ),
};

/**
 * Short chip label for a block — includes type counter if multiple of same type.
 * e.g. first paragraph = "¶", second = "¶2"; headings use level = "H3".
 */
function chipLabel( block, allPspBlocks ) {
    const { name, attributes } = block;

    // Headings: bake level into label — H1, H2, H3 etc.
    if ( name === 'core/heading' ) {
        const level     = attributes?.level ?? 2;
        const sameLevel = allPspBlocks.filter(
            b => b.name === name && ( b.attributes?.level ?? 2 ) === level
        );
        const idx = sameLevel.findIndex( b => b.clientId === block.clientId );
        // Always number headings of the same level: H3.1, H3.2
        return sameLevel.length > 1 ? `H${ level }.${ idx + 1 }` : `H${ level }`;
    }

    const short    = CHIP_LABELS[ name ] ?? name.split( '/' )[ 1 ]?.slice( 0, 3 ).toUpperCase() ?? '?';
    const sameType = allPspBlocks.filter( b => b.name === name );
    const idx      = sameType.findIndex( b => b.clientId === block.clientId );

    // Always number when there are 2+ of the same type to keep labels
    // consistent — WRAP1/WRAP2/WRAP3 rather than WRAP/WRAP1/WRAP2.
    return sameType.length > 1 ? `${ short }${ idx + 1 }` : short;
}

/** Human-readable block name for the active block header. */
function fullName( block ) {
    const { name, attributes } = block;
    if ( name === 'core/heading' ) {
        return sprintf(
            /* translators: %d: heading level number */
            __( 'Heading %d', 'pattern-sync-pro' ),
            attributes?.level ?? 2
        );
    }
    return FULL_NAMES[ name ] ?? name.split( '/' )[ 1 ] ?? name;
}

// ── Content field overrides ───────────────────────────────────────────────────
//
// Optional label / control-type overrides for known attribute keys.
// These are NO LONGER required for a field to render — fields are now derived
// Content field utilities moved to lock-utils.js (shared with PspInstancePanel).

// ── Component ─────────────────────────────────────────────────────────────────

export function PspPatternPanel( { coreBlockClientId, patternId } ) {
    const [ activeIndex, setActiveIndex ] = useState( 0 );
    const [ confirmReset, setConfirmReset ] = useState( false );

    const { updateBlockAttributes } = useDispatch( 'core/block-editor' );

    // All PSP-managed inner blocks + their computed block keys + current overrides.
    // Phase 5: reads from core/block `content` attribute (WP-native format)
    // instead of the legacy `pspOverrides` attribute.
    const { pspBlocks, overrides } = useSelect( ( sel ) => {
        const blockStore = sel( 'core/block-editor' );
        const allIds  = blockStore.getClientIdsWithDescendants?.( coreBlockClientId ) ?? [];
        // Verify parent chain — prevents blocks from OTHER synced patterns on
        // the same page bleeding in when this pattern hasn't hydrated yet.
        const ownIds  = allIds.filter( id =>
            ( blockStore.getBlockParents?.( id ) ?? [] ).includes( coreBlockClientId )
        );
        const allBlocks = ownIds.map( id => blockStore.getBlock( id ) ).filter( Boolean );

        // Only show blocks explicitly enabled by the author (non-empty pspLock).
        const pspBlocks = allBlocks
            .filter( b => b.name && b.name !== 'core/block'
                && b.attributes?.pspLock
                && Object.keys( b.attributes.pspLock ).length > 0 )
            .map( b => ( {
                ...b,
                blockKey: generateBlockKey( blockStore, coreBlockClientId, b.clientId ),
            } ) );

        const coreBlock = blockStore.getBlock( coreBlockClientId );

        // Read overrides from `content` — WP-native storage shared with
        // core/pattern-overrides. pspOverrides is no longer used (Phase 8).
        const overrides = coreBlock?.attributes?.content ?? {};

        return { pspBlocks, overrides };
    }, [ coreBlockClientId ] );

    // ── Phase 5 migration: pspOverrides → content ─────────────────────────────
    // Runs once when the panel mounts. If old pspOverrides data exists and
    // content is empty, migrates the data mapping positional keys to metadata.name.
    useEffect( () => {
        const blockStore = select( 'core/block-editor' );
        const coreBlock  = blockStore.getBlock( coreBlockClientId );
        if ( ! coreBlock ) return;

        const legacy  = coreBlock.attributes.pspOverrides ?? {};
        const current = coreBlock.attributes.content      ?? {};

        if ( Object.keys( legacy ).length === 0 ) return;  // Nothing to migrate.
        if ( Object.keys( current ).length > 0 )  return;  // Already migrated.

        // Build a map from positional key → metadata.name for this pattern.
        const allIds = blockStore.getClientIdsWithDescendants?.( coreBlockClientId ) ?? [];
        const ownIds = allIds.filter( id =>
            ( blockStore.getBlockParents?.( id ) ?? [] ).includes( coreBlockClientId )
        );
        const patternBlocks = ownIds.map( id => blockStore.getBlock( id ) ).filter( Boolean );

        const keyMap     = {};
        const typeCounts = {};
        for ( const block of patternBlocks ) {
            const short        = block.name.replace( /^core\//, '' ).replace( /\//g, '-' );
            const index        = typeCounts[ short ] ?? 0;
            typeCounts[ short ] = index + 1;
            const positional   = `${ short }-${ index }`;
            const named        = block.attributes?.metadata?.name;
            if ( named ) keyMap[ positional ] = named;
        }

        // Re-key legacy overrides using metadata.name where available.
        const migrated = {};
        for ( const [ key, value ] of Object.entries( legacy ) ) {
            migrated[ keyMap[ key ] ?? key ] = value;
        }

        if ( Object.keys( migrated ).length > 0 ) {
            if ( DEBUG ) console.log( '[PSP] migrating legacy pspOverrides → content', migrated );
            updateBlockAttributes( coreBlockClientId, { content: migrated } );
        }
    }, [ coreBlockClientId ] );

    if ( pspBlocks.length === 0 ) return null;

    const safeIndex   = Math.min( activeIndex, pspBlocks.length - 1 );
    const activeBlock = pspBlocks[ safeIndex ];
    const blockOverrides  = activeBlock?.blockKey ? ( overrides[ activeBlock.blockKey ] ?? {} ) : {};
    const hasAnyOverrides = Object.keys( overrides ).length > 0;

    // Lock state for the active block.
    const effectiveLockGroups = getLockGroupsForBlock( activeBlock?.name ?? '' );
    const lockMask     = PSP_Pattern_Lock_JS.getLockMask( activeBlock?.attributes?.pspLock );
    const freeGroups   = Object.entries( lockMask ).filter( ( [ , v ] ) => ! v ).map( ( [ g ] ) => g );
    const lockedGroups = Object.entries( lockMask ).filter( ( [ , v ] ) =>   v ).map( ( [ g ] ) => g );
    const isFullyLocked = freeGroups.length === 0;

    // ── Override write helpers ────────────────────────────────────────────────

    const updateOverride = ( attrKey, value ) => {
        if ( ! activeBlock?.blockKey ) return;
        const coreBlock = select( 'core/block-editor' ).getBlock( coreBlockClientId );
        if ( ! coreBlock ) return;

        // Phase 5: write to `content` (WP-native storage).
        const existing  = coreBlock.attributes.content ?? {};
        const entry     = { ...( existing[ activeBlock.blockKey ] ?? {} ) };
        const sourceVal = activeBlock.attributes[ attrKey ] ?? '';

        if ( value === sourceVal ) {
            delete entry[ attrKey ];
        } else {
            entry[ attrKey ] = value;
        }

        const updated = { ...existing };
        if ( Object.keys( entry ).length === 0 ) {
            delete updated[ activeBlock.blockKey ];
        } else {
            updated[ activeBlock.blockKey ] = entry;
        }
        updateBlockAttributes( coreBlockClientId, { content: updated } );
    };

    const resetActiveBlock = () => {
        if ( ! activeBlock?.blockKey ) return;
        const coreBlock = select( 'core/block-editor' ).getBlock( coreBlockClientId );
        const updated   = { ...( coreBlock?.attributes?.content ?? {} ) };
        delete updated[ activeBlock.blockKey ];
        updateBlockAttributes( coreBlockClientId, { content: updated } );
        setConfirmReset( false );
    };

    const resetAll = () => {
        updateBlockAttributes( coreBlockClientId, { content: {} } );
        setConfirmReset( false );
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <InspectorControls>
            <PanelBody
                title={ __( 'Pattern Sync Pro', 'pattern-sync-pro' ) }
                icon={ lock }
                initialOpen={ true }
                className="psp-panel psp-pattern-panel"
            >
                { /* Block chip navigator */ }
                <div className="psp-block-nav">
                    <div className="psp-block-chips" role="tablist" aria-label={ __( 'Pattern blocks', 'pattern-sync-pro' ) }>
                        { pspBlocks.map( ( block, i ) => {
                            const overridesForBlock = block.blockKey ? ( overrides[ block.blockKey ] ?? {} ) : {};
                            const hasOverrides      = Object.keys( overridesForBlock ).length > 0;
                            const lm                = PSP_Pattern_Lock_JS.getLockMask( block.attributes?.pspLock );
                            const fullyLocked       = Object.values( lm ).every( Boolean );
                            const label             = chipLabel( block, pspBlocks );

                            return (
                                <button
                                    key={ block.clientId }
                                    role="tab"
                                    aria-selected={ safeIndex === i }
                                    className={ [
                                        'psp-block-chip',
                                        safeIndex === i  && 'is-active',
                                        fullyLocked      && 'is-locked',
                                        hasOverrides     && 'has-overrides',
                                    ].filter( Boolean ).join( ' ' ) }
                                    onClick={ () => { setActiveIndex( i ); setConfirmReset( false ); } }
                                    title={ fullName( block ) }
                                >
                                    { label }
                                    { hasOverrides && <span className="psp-chip-dot" aria-hidden="true" /> }
                                    { fullyLocked  && <span className="psp-chip-lock" aria-hidden="true">🔒</span> }
                                </button>
                            );
                        } ) }
                    </div>

                    { /* Active block header */ }
                    <div className="psp-active-block__header">
                        <span className="psp-active-block__name">
                            { fullName( activeBlock ) }
                        </span>
                        <span className="psp-active-block__position">
                            { safeIndex + 1 } / { pspBlocks.length }
                        </span>
                    </div>
                </div>

                { /* Active block: customizable fields */ }
                { ! isFullyLocked && freeGroups.length > 0 && (
                    <div className="psp-section">
                        <div className="psp-section-divider is-free">
                            { __( 'Customizable', 'pattern-sync-pro' ) }
                        </div>

                        { freeGroups.map( group => {
                            const groupAttrs   = effectiveLockGroups[ group ] ?? LOCK_GROUPS[ group ] ?? [];
                            const editableAttrs = group === 'content'
                                ? getContentFields( activeBlock.name, groupAttrs, activeBlock.attributes )
                                : [];
                            const isGroupChanged = groupAttrs.some( k => k in blockOverrides );

                            return (
                                <div key={ group }>
                                    <div className={ `psp-group-row psp-group-free` }>
                                        <span className="psp-group-name">
                                            { group.charAt( 0 ).toUpperCase() + group.slice( 1 ) }
                                        </span>
                                        { isGroupChanged && (
                                            <span className="psp-changed-dot" aria-label={ __( 'Has overrides', 'pattern-sync-pro' ) } />
                                        ) }
                                    </div>

                                    { editableAttrs.map( ( { attrKey, label, control } ) => {
                                        const currentVal   = blockOverrides[ attrKey ] ?? activeBlock.attributes[ attrKey ] ?? '';
                                        const isOverridden = attrKey in blockOverrides;

                                        return (
                                            <div key={ attrKey } className="psp-field-row">
                                                { control === 'textarea' ? (
                                                    <TextareaControl
                                                        __nextHasNoMarginBottom
                                                        label={ label }
                                                        value={ currentVal }
                                                        onChange={ val => updateOverride( attrKey, val ) }
                                                        className={ isOverridden ? 'psp-field--overridden' : '' }
                                                        rows={ 3 }
                                                    />
                                                ) : (
                                                    <TextControl
                                                        __nextHasNoMarginBottom
                                                        label={ label }
                                                        value={ currentVal }
                                                        onChange={ val => updateOverride( attrKey, val ) }
                                                        className={ isOverridden ? 'psp-field--overridden' : '' }
                                                    />
                                                ) }
                                                { isOverridden && (
                                                    <p className="psp-override-notice">
                                                        { __( 'Canvas shows source. Override appears on front-end after saving.', 'pattern-sync-pro' ) }
                                                    </p>
                                                ) }
                                            </div>
                                        );
                                    } ) }
                                </div>
                            );
                        } ) }
                    </div>
                ) }

                { /* Active block: locked groups */ }
                { lockedGroups.length > 0 && (
                    <div className="psp-section">
                        <div className="psp-section-divider">
                            { __( 'Locked', 'pattern-sync-pro' ) }
                        </div>
                        { lockedGroups.map( group => (
                            <div key={ group } className="psp-group-row psp-group-locked">
                                <span className="psp-group-name">
                                    { group.charAt( 0 ).toUpperCase() + group.slice( 1 ) }
                                </span>
                            </div>
                        ) ) }
                    </div>
                ) }

                { /* Fully locked active block notice */ }
                { isFullyLocked && (
                    <div className="psp-all-locked-notice">
                        <Icon icon={ lock } size={ 16 } />
                        <span>{ __( 'All groups locked. Select a different block or edit the source pattern.', 'pattern-sync-pro' ) }</span>
                    </div>
                ) }

                { /* Prev / Next navigation */ }
                { pspBlocks.length > 1 && (
                    <div className="psp-block-nav__footer">
                        <Button
                            variant="tertiary"
                            size="small"
                            disabled={ safeIndex === 0 }
                            onClick={ () => { setActiveIndex( safeIndex - 1 ); setConfirmReset( false ); } }
                        >
                            { __( '← Prev', 'pattern-sync-pro' ) }
                        </Button>
                        <Button
                            variant="tertiary"
                            size="small"
                            disabled={ safeIndex === pspBlocks.length - 1 }
                            onClick={ () => { setActiveIndex( safeIndex + 1 ); setConfirmReset( false ); } }
                        >
                            { __( 'Next →', 'pattern-sync-pro' ) }
                        </Button>
                    </div>
                ) }

                { /* Reset controls */ }
                { hasAnyOverrides && (
                    <div className="psp-revert-all">
                        { ! confirmReset ? (
                            <Button
                                variant="tertiary"
                                isDestructive
                                size="small"
                                onClick={ () => setConfirmReset( true ) }
                            >
                                { __( 'Reset all changes', 'pattern-sync-pro' ) }
                            </Button>
                        ) : (
                            <div className="psp-revert-all__confirm">
                                <p>{ __( 'Reset all overrides on this pattern instance?', 'pattern-sync-pro' ) }</p>
                                <div className="psp-revert-all__actions">
                                    <Button variant="primary" isDestructive size="small" onClick={ resetAll }>
                                        { __( 'Yes, reset', 'pattern-sync-pro' ) }
                                    </Button>
                                    <Button variant="secondary" size="small" onClick={ () => setConfirmReset( false ) }>
                                        { __( 'Cancel', 'pattern-sync-pro' ) }
                                    </Button>
                                </div>
                            </div>
                        ) }
                    </div>
                ) }

                { /* Pro upsell */ }
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
