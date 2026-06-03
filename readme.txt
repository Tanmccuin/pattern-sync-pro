=== Pattern Sync Pro ===
Contributors:      yourname
Tags:              blocks, patterns, synced patterns, block editor, FSE
Requires at least: 6.4
Tested up to:      6.7
Requires PHP:      8.1
Stable tag:        0.1.11-alpha
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Field-level sync control for WordPress block patterns. Lock layout and design while freeing content — per block, per attribute group.

== Description ==

WordPress synced patterns are all-or-nothing. Pattern Sync Pro changes that.

Define exactly which parts of each block sync from the source pattern and which parts editors can override per-instance — without breaking the pattern or losing sync entirely.

**Free features:**
* Per-block lock masks with five attribute groups: Layout, Design, Content, Visibility, CSS Classes
* Works with all core blocks and most third-party blocks
* Non-destructive — deactivating the plugin leaves everything intact
* Clean uninstall with your choice of data handling

**Pro features (coming soon):**
* Granular per-attribute control
* Pattern versioning and rollback
* Change audit log (who changed what instance, when)
* Multisite / cross-site pattern sync
* Lock inheritance for nested patterns

== Installation ==

1. Upload the plugin to `/wp-content/plugins/pattern-sync-pro/`
2. Activate the plugin through the Plugins screen
3. Open any synced pattern in the block editor
4. Select a block — a "Pattern Sync Pro" panel appears in the block inspector
5. Toggle which attribute groups are locked vs. overridable

== Frequently Asked Questions ==

= What happens if I deactivate the plugin? =
Nothing destructive. The plugin's block attributes (`pspLock`, `pspInstanceId`) sit inert in the markup — core WordPress ignores them, blocks render normally, and everything is fully editable as if PSP never existed.

= What happens if I delete the plugin? =
You'll be prompted to choose: strip all PSP data from your block markup (recommended, fully clean), or just delete override records and leave the markup intact (also safe — attributes are inert without the plugin).

= Does it work with Stackable / Greenshift blocks? =
Yes. PSP operates at the block attribute level and is block-library agnostic.

= Does it work with the Blocksy theme? =
Yes. PSP has no theme dependencies.

== Changelog ==

= 0.1.11-alpha =
* Fix: override WP's 'disabled' editingMode on child blocks inside synced pattern instances.
* Add: Tools > PSP Debug page for toggling the debug overlay without WP-CLI.
* Add: Debug overlay now shows editingMode, templateLock, and parent chain per block.

= 0.1.0 =
* Initial scaffold release.
