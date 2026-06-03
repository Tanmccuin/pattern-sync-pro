# Changelog

All notable changes to Pattern Sync Pro will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/) once stable.

---

<!-- TODO: Expand these entries with user-facing descriptions before WP.org submission -->

## [0.1.11-alpha] — 2026-06-03

### Added
- Core plugin architecture: `pspLock` attribute groups (Layout, Design, Content, Visibility, CSS Classes) per block in source patterns
- `pspOverrides` storage — overrides live directly in the post's `core/block` wrapper attribute, no separate DB table
- PHP `PSP_Block_Renderer` — `render_block` filter applies per-instance overrides at output time
- **Chip navigator UI** (`PspPatternPanel`) — mounted on the pattern wrapper block; shows all PSP-managed blocks as chips with prev/next navigation; locked blocks shown greyed with lock indicator
- `PspAuthorPanel` — Sync Controls panel in the source pattern editor; preset buttons (Lock all / Content only), status pill, Pro upsell
- `PspInstancePanel` — per-inner-block fallback panel for when navigating via Outline view
- Lock enforcement Redux subscriber — reverts writes to locked attribute groups; WP 7.0+ compatible
- Reactive sidebar context (`PspPatternWrapper`) — re-activates `__unstableSetTemporarilyEditingAsBlocks` on re-selection, fixing "Edit original" reversion bug
- Canvas override indicator — green outline on pattern blocks with active overrides
- Inline contextual notice below overridden fields explaining canvas vs front-end preview gap
- Built-in third-party block library compat (`PSP_Block_Compat`): Kadence Blocks, GenerateBlocks, Stackable, Spectra / UAGB, Cwicly, Greenshift
- `psp_lock_groups` filter for extending attribute mappings to any block library
- `PSP_Override_Store` shadow CPT — reserved for Pro versioning/history features
- REST API endpoints — reserved for Pro features
- Clean uninstall with two paths: full attribute strip or minimal option/record removal
- Debug overlay (Tools > PSP Debug) showing block editing modes, ref, and parent depth

### Architecture notes
- Targets WordPress 7.0+ only; WP 7.0 renders synced pattern canvas as static HTML — PSP uses sidebar fields + PHP render-time application rather than canvas contenteditable
- `pspOverrides` key format: `{shortBlockType}-{indexAmongSameType}` (e.g. `paragraph-0`) — deterministic, matches both JS `generateBlockKey()` and PHP `apply_overrides_recursive()`

---

<!-- TODO before stable release:
  - Add screenshots to /assets/
  - Write proper WP.org readme description
  - Add unit tests
  - Audit all __unstable* API usage for WP 7.x compatibility
  - Replace __unstableSetTemporarilyEditingAsBlocks when WP provides stable API
  - Performance profiling on sites with many synced patterns
-->
