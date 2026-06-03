/**
 * PSP Debug — floating panel, bottom-right corner.
 * Enabled via Tools > PSP Debug.
 */
import { addFilter }                   from '@wordpress/hooks';
import { createHigherOrderComponent }  from '@wordpress/compose';
import { useSelect }                   from '@wordpress/data';
import { useState, useEffect }         from '@wordpress/element';

if ( window.pspData?.debug ) {

    // Simple shared registry using a global object — avoids React portal issues.
    window._pspDebugBlocks = window._pspDebugBlocks || {};
    window._pspDebugUpdate = null;

    // ── Per-block silent collector ────────────────────────────────────────────
    function PspCollector( { clientId, name, attributes } ) {
        const info = useSelect( ( select ) => {
            const editor      = select( 'core/editor' );
            const blockEditor = select( 'core/block-editor' );
            if ( ! editor || ! blockEditor ) return null;

            const postType   = editor.getCurrentPostType?.();
            const parents    = blockEditor.getBlockParents?.( clientId ) ?? [];
            const parentData = parents.map( pid => {
                const b = blockEditor.getBlock?.( pid );
                return b ? { name: b.name, ref: b.attributes?.ref ?? null } : null;
            } ).filter( Boolean );

            const syncedParent = parentData.find( b => b.name === 'core/block' && b.ref );
            const selfBlock    = blockEditor.getBlock?.( clientId );

            return {
                clientId:    clientId.slice( 0, 8 ),
                fullId:      clientId,
                name:        name.replace( 'core/', '' ),
                editingMode: blockEditor.getBlockEditingMode?.( clientId ),
                postType,
                parentCount: parents.length,
                parentData,
                syncedRef:   syncedParent?.ref ?? null,
                isSource:    postType === 'wp_block',
                isInstance:  Boolean( syncedParent ) && postType !== 'wp_block',
                selfRef:     selfBlock?.attributes?.ref ?? null,
                pspLock:     attributes?.pspLock ?? null,
                pspId:       attributes?.pspInstanceId ?? null,
            };
        }, [ clientId ] );

        useEffect( () => {
            if ( ! info ) return;
            window._pspDebugBlocks[ clientId ] = info;
            if ( window._pspDebugUpdate ) window._pspDebugUpdate();
        } );

        return null;
    }

    // ── Floating panel component ──────────────────────────────────────────────
    function PspPanel() {
        const [ , tick ]        = useState( 0 );
        const [ open, setOpen ] = useState( true );
        const [ expanded, setExpanded ] = useState( null );

        useEffect( () => {
            window._pspDebugUpdate = () => tick( n => n + 1 );
            return () => { window._pspDebugUpdate = null; };
        }, [] );

        const blocks = Object.values( window._pspDebugBlocks ).sort( ( a, b ) => {
            if ( a.selfRef && ! b.selfRef ) return -1;
            if ( ! a.selfRef && b.selfRef ) return 1;
            return a.parentCount - b.parentCount;
        } );

        return (
            <div style={ {
                position: 'fixed', bottom: 16, right: 16, zIndex: 999999,
                width: 300, maxHeight: 400, background: '#1a1a1a',
                border: '1px solid #555', borderRadius: 6, fontFamily: 'monospace',
                fontSize: 11, color: '#e0e0e0', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                pointerEvents: 'all',
            } }>
                <div onClick={ () => setOpen( o => !o ) } style={ {
                    padding: '5px 10px', background: '#2d2d2d', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: open ? '1px solid #444' : 'none', flexShrink: 0,
                } }>
                    <strong style={ { color: '#a8ff78' } }>PSP Debug { open ? '▾' : '▸' }</strong>
                    <span style={ { color: '#777', fontSize: 10 } }>{ blocks.length } blocks · v{ window.pspData?.version }</span>
                </div>

                { open && (
                    <div style={ { overflowY: 'auto', flex: 1 } }>
                        { blocks.length === 0 && (
                            <div style={ { padding: '8px 10px', color: '#666', fontStyle: 'italic' } }>
                                Interact with the canvas to populate.
                            </div>
                        ) }
                        { blocks.map( b => {
                            const isExp   = expanded === b.fullId;
                            const mColor  = b.editingMode === 'default'  ? '#a8ff78'
                                          : b.editingMode === 'disabled' ? '#ff6b6b' : '#ffd93d';
                            const icon    = b.selfRef ? '🔗' : b.isInstance ? '📄' : b.isSource ? '✍️' : '–';
                            return (
                                <div key={ b.fullId }
                                    onClick={ () => setExpanded( isExp ? null : b.fullId ) }
                                    style={ {
                                        padding: '4px 10px', borderBottom: '1px solid #252525',
                                        cursor: 'pointer', background: isExp ? '#222' : 'transparent',
                                    } }
                                >
                                    <div style={ { display: 'flex', justifyContent: 'space-between' } }>
                                        <span>{ icon } <b>{ b.name }</b> <span style={ { color: '#555' } }>{ b.clientId }</span></span>
                                        <span style={ { color: mColor, fontWeight: 'bold' } }>{ b.editingMode ?? '?' }</span>
                                    </div>
                                    { b.syncedRef && <div style={ { color: '#888', fontSize: 10 } }>ref:{ b.syncedRef } parents:{ b.parentCount }</div> }
                                    { isExp && (
                                        <pre style={ {
                                            margin: '4px 0 2px', whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all', color: '#bbb', fontSize: 10, lineHeight: 1.4,
                                        } }>{ JSON.stringify( b, null, 2 ) }</pre>
                                    ) }
                                </div>
                            );
                        } ) }
                    </div>
                ) }
            </div>
        );
    }

    // Mount into a plain DOM element appended to body — no React portal needed.
    let panelRoot = null;
    function mountPanel() {
        if ( panelRoot ) return;
        const container = document.createElement( 'div' );
        container.id    = 'psp-debug-root';
        document.body.appendChild( container );

        // Use wp.element.render (WP's ReactDOM.render wrapper).
        if ( window.wp?.element?.render ) {
            window.wp.element.render( <PspPanel />, container );
            panelRoot = container;
        }
    }

    // ── Filters ───────────────────────────────────────────────────────────────
    addFilter( 'editor.BlockEdit', 'pattern-sync-pro/debug',
        createHigherOrderComponent( ( BlockEdit ) => ( props ) => (
            <>
                <BlockEdit { ...props } />
                <PspCollector clientId={ props.clientId } name={ props.name } attributes={ props.attributes } />
            </>
        ), 'withPspCollector' ),
    999 );

    // Mount panel after editor boots.
    window.addEventListener( 'DOMContentLoaded', mountPanel );
    setTimeout( mountPanel, 500 );

    console.log( '[PSP] debug active v' + window.pspData?.version );
}
