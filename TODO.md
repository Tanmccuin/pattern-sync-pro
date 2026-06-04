# Pattern Sync Pro — TODO / Backlog

Items flagged during development for future attention.
Format: `[ ]` open · `[x]` done · `[~]` in progress · `[P]` Pro tier only

---

## 🔴 High Priority

- [ ] **Lock overlay group targeting** — overlay currently applies to ALL panels when any group is locked. Should only overlay panels whose controls belong to locked PSP groups (e.g. Stackable's Layout tab → PSP `layout` group). Requires mapping Stackable/Kadence tab/panel names to PSP lock groups. Currently all-or-nothing.

- [ ] **Design/Layout override capture** — editors can change design attrs via Stackable's Style tab but PSP doesn't capture those changes to `core/block.content`. Subscriber-based capture caused page load hangs (two attempts). Needs a fundamentally different approach — likely a pre-save hook or `useEffect` watching `isSavingPost` that runs a one-time scan before the save XHR fires.

- [ ] **`__unstableSetTemporarilyEditingAsBlocks` replacement** — deprecated since WP 7.0, still used for sidebar context switching in `PspPatternWrapper`. Monitor for removal in future WP major. Need stable alternative API when WP provides one.

---

## 🟡 Medium Priority

- [ ] **Stackable attribute mapping edge cases** — pattern-based detection (`getLockGroupsFromRegistry`) covers ~84% of Stackable/text attrs. Uncaught: `zIndex`, `overflow`, `clear`, `displayCondition`, `htmlTag`, `transitionDuration`. Add these to ATTR_PATTERNS or LIBRARY_MAPPINGS.

- [ ] **`metadata.name` in List View** — WP uses `metadata.name` as block label in List View (`stackable-text-mpzibw29` instead of "Stackable Text"). Expected WP behavior — can we supply a human-friendly override via block metadata?

- [ ] **`metadata.bindings` graceful degradation** — writing `metadata.bindings` via `setAttributes()` without regenerating `save()` HTML causes WP block validation errors. The right path: intercept WP's native "Allow overrides" UI flow or regenerate innerHTML post-write. Currently reverted — Tier 1 graceful degradation only works if user also enables WP native bindings manually.

- [ ] **"Changed" dot in chip nav for Design overrides** — chip dot only shows when `core/block.content` has a stored override. Design/Layout changes via Stackable's Style tab aren't captured yet (related to Design/Layout capture TODO above). Once capture is fixed, dots should work automatically.

- [ ] **PHP renderer: more block types in `update_block_content_html()`** — regex approach handles `core/paragraph`, `core/heading`, `core/button`, `core/list-item`, `core/quote`, `core/verse`. Add `core/image` (alt/title attrs), `core/pullquote`, `core/cover` and common Stackable blocks that use static rendering.

- [ ] **`delete_override` REST handler stub** — `PSP_Rest_Overrides::delete_override()` returns `{deleted: true}` but doesn't call `delete_overrides_for_instance()`. Implement properly. (Pro tier storage path — low urgency until Pro features build out.)

---

## 🟢 Low Priority / Polish

- [ ] **SCSS deprecation warnings** — `admin.scss` still triggers Sass deprecation warnings (likely `darken()` or similar). Replace with `color.adjust()` or literal hex values.

- [ ] **`pspOverrides` legacy attribute registration** — Phase 8 TODO: once migration window closes (sites have been on v0.2.0+ long enough), remove `pspOverrides` attribute from `blocks.registerBlockType` filter and all remaining fallback read paths. Currently kept for sites that haven't opened the PSP panel since upgrade.

- [ ] **`use-psp-context.js` stale file** — `src/js/editor/hooks/use-psp-context.js` exists in the repo from early scaffolding. Check if it's referenced anywhere; remove if dead code.

- [ ] **Settings page: Freemius / license integration** — License tab is a placeholder. When licensing provider is chosen (Freemius recommended for WP), implement SDK initialization, activation flow, and replace the placeholder key input.

- [ ] **WP.org submission prep** — `readme.txt` and `CHANGELOG.md` marked for revision before launch. Write real user-facing copy, add screenshots to `/assets/`, complete FAQ.

- [ ] **Version bump to stable** — currently `0.2.0-alpha`. Bump to `0.2.0` or `1.0.0` when feature-complete, tested on production data, and WP.org submission approved.

---

## [P] Pro Tier Roadmap

- [ ] **Per-attribute granularity** — lock just `fontSize`, not all of Design. Requires per-attr UI in Author Panel and attribute-level enforcement.
- [ ] **Override history & rollback** — shadow CPT (`_psp_override`) is wired up and reserved for this. Needs versioning logic and UI.
- [ ] **Role-based permissions** — which user roles can override which lock groups per pattern.
- [ ] **Copy overrides across instances** — apply one instance's overrides as a template to other instances of the same pattern.
- [ ] **Design/Layout override inputs in panel** — full UI for non-content group overrides (color pickers, spacing controls) rather than relying on block library's own controls + passive capture.
- [ ] **Per-library UI control disabling** — Pro version of the lock overlay: actually disable (not just visually shield) specific block library controls based on lock group mapping. Requires deep per-library integration.
- [ ] **Audit log** — track who changed what override, when, on which post.

---

## Architecture Notes

- **WP 7.0+ only** — canvas is read-only for synced patterns; all editing is sidebar-based.
- **Storage** — `core/block.content` attribute (WP-native format, shared with `core/pattern-overrides`).
- **Binding source** — `psp/overrides` registered in WP block bindings registry.
- **Pattern-based attr detection** — `getLockGroupsFromRegistry()` in `lock-utils.js` derives group membership from registered block attrs using naming patterns. Cached per block type. Covers all third-party blocks automatically.
- **Shadow CPT** (`_psp_override`) — reserved for Pro versioning/history. Not used in free tier.

---

*Last updated: 2026-06-04*
