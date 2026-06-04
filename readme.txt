=== Pattern Sync Pro ===
Contributors:      tanmccuin
Tags:              blocks, patterns, synced patterns, block editor, full-site-editing
Requires at least: 7.0
Tested up to:      7.0
Requires PHP:      8.1
Stable tag:        0.2.0-alpha
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Field-level sync control for WordPress block patterns. Lock layout and design while freeing content — per block, per attribute group.

== Description ==

WordPress synced patterns are all-or-nothing. Pattern Sync Pro changes that.

Define exactly which parts of each block sync from the source pattern and which parts editors can override per instance — without breaking the pattern or losing sync.

When a pattern author locks "Design" but frees "Content", every editor can change text on their instance while colors, typography, and spacing remain consistent across every page the pattern appears on.

**Free features**

* Five attribute groups per block: Layout, Design, Content, Visibility, CSS Classes
* Chip navigator — see all blocks in a pattern at a glance, tap to edit
* Sidebar editing fields for overridable content
* Per-group and global reset with confirmation
* Override indicator on the canvas block when active overrides exist
* Lock enforcement — locked attributes cannot be changed, even programmatically
* Built-in compatibility with Kadence Blocks, GenerateBlocks, Stackable, Spectra, and more
* Extensible via `psp_lock_groups` filter for any block library
* Non-destructive — deactivating leaves everything intact
* Clean uninstall with your choice of data handling

**Pro features (coming soon)**

* Per-attribute granularity — lock just font size, not all of Design
* Override history — see what changed, when, and by whom
* Rollback to any previous override state
* Role-based permissions — editors vs. admins per group
* Copy overrides across pattern instances

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Activate through the **Plugins** screen in WordPress admin
3. Open any page or post containing a synced pattern
4. Click the pattern block — a **Pattern Sync Pro** panel appears in the sidebar
5. Use the chip navigator to browse blocks and manage overrides

To configure lock settings, open the synced pattern itself (Patterns > edit) and use the **Sync Controls** panel in the block inspector.

== Frequently Asked Questions ==

= What WordPress version is required? =

Pattern Sync Pro targets WordPress 7.0 and later. This version of WP changed how synced pattern inner blocks are rendered, and PSP is built for that model. If you are on an earlier version, check back — a compatibility branch may be added in future.

= What happens if I deactivate the plugin? =

Nothing destructive. The `pspLock` and `pspOverrides` attributes sit inert in your block markup. WordPress ignores unknown attributes, blocks render normally, and patterns behave as standard synced patterns.

= What happens if I delete the plugin? =

You will be prompted to choose a cleanup path: strip all PSP data from block markup (recommended, fully clean), or just remove the plugin options and leave markup intact. Either way is safe.

= Does it work with third-party block libraries? =

Yes. PSP includes built-in attribute mappings for Kadence Blocks, GenerateBlocks, Stackable, and Spectra. For any other library, use the `psp_lock_groups` filter to add your own mappings — no sub-plugin required.

= Where do overrides live in the database? =

Overrides are stored directly in the post's block markup as a `pspOverrides` attribute on the `core/block` wrapper — the same place WordPress stores all block data. There is no separate database table for free-tier overrides.

= Will this slow down my site? =

No measurable impact. The front-end renderer is a single `render_block` filter that only fires when a synced pattern with active overrides is present on the page.

== Screenshots ==

1. The PSP chip navigator showing all blocks in a pattern instance.
2. The Sync Controls panel in the source pattern editor.
3. The override notice and canvas indicator when a block has active overrides.

== Changelog ==

= 0.2.0-alpha =
* Initial alpha release.
* Core architecture: pspLock attribute groups, pspOverrides storage, PHP render_block application.
* WP 7.0+ compatible — sidebar-based editing model with front-end render-time override application.
* Chip navigator UI for browsing and editing all blocks in a pattern.
* Lock enforcement subscriber prevents writes to locked attribute groups.
* Built-in third-party block library compatibility (Kadence, GenerateBlocks, Stackable, Spectra, Cwicly, Greenshift).
* Extensible via psp_lock_groups filter.
* Canvas override indicator and inline contextual notice when overrides are active.
* Debug overlay (Tools > PSP Debug) for diagnosing block editing modes.

== Upgrade Notice ==

= 0.2.0-alpha =
Alpha release — not recommended for production use. API and data structures may change before stable release.
