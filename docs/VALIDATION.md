# Validation for 2.4.24

262 Node regressions pass, including new-account setup under a permitted shared/foreign backup location, no-grant behavior, background creation disabled, occupied-name preservation, empty interrupted setup reuse, no creation on ambiguity/limits/permission faults, valid scope checks, existing-match priority and one saved-grant renewal respecting refusal.

The isolated Edge account fixture now also connects a new C account with no folder mapping or archive: its own account folder is prepared automatically, A/B entries and the exact saved B job are unchanged, and repeated Connect plus refresh reuse one C folder without nesting. Switching back restores B’s saved chat. The fixture uses synthetic data and the actual filesystem/storage logic, with only initialization/click-completion signals exposed in its isolated runtime copy. No conversation-network requests or page errors. Original live-profile activation and live account changes remain separate from these checks.

## Earlier validation: 2.4.23

251 Node regressions pass, including eighteen account-folder cases: migrated parent grants, explicit-folder priority, renamed/nested archives, no name-only ownership, conflicting/duplicate scope metadata, overlap deduplication, ambiguous copies, revoked permission, stale handles, shared directory/entry budgets, bounded large headers, reported legacy truncation and unchanged account records. Runtime syntax checks pass.

An isolated Edge fixture reproduces the previous missing-folder state when switching from A to B despite an already granted parent containing B’s archive. After the fix it restores B’s renamed folder and saved chat, keeps A’s entries separate, survives refresh, switches A/B/A correctly and handles double Connect/Start without conversation-network requests or page errors. The fixture exposes click completion and initialization flags only in an isolated runtime copy to avoid guessing from UI frame timing. Production connection/detection logic is unchanged by the fixture; all data and directory handles are synthetic.

Live private-account switching, a fresh current Viewer full import and activation in the user’s existing Edge profile are not claimed by these fixtures. The same-folder installation keeps Viewer adaptations and has a rollback copy. Browser activation requires Reload of the existing extension card and reconnecting to the selected account.

## Earlier validation: 2.4.22

233 Node regression tests pass, including eight storage-lifecycle cases: concurrent recovery, close/versionchange events, failed opens, bounded retries, permission/missing-store errors, quota/abort failures without replay, read completion and atomic batches. Runtime JS/MJS syntax checks pass.

An isolated Microsoft Edge fixture reproduced the exact native closing-connection error twice before the fix. After the fix it verifies all five storage operations, one shared reopen for concurrent requests, closing between connection retrieval and transaction creation, an interrupted write that retains the committed job, close/versionchange invalidation, visible non-transient errors, and saved queue/cache persistence after refresh. The fixture uses synthetic data and a separate profile; it never clears or reads the user's live browser database.

The existing eight themes, Viewer adapters and chat/Library behavior are preserved. A fresh full current Viewer import, live private-account export and activation in the user's existing Edge profile are not established by these isolated fixtures. Release ZIP/checksum and installed-file verification are recorded separately; browser activation requires reloading the existing extension card.

The established isolated dashboard flow also completed 100 synthetic cached chats through the actual Engine: double Start writes each initial body once, Hold retains its state during theme changes, and Stop/Resume completes twenty additional chats. All four release schedules, duplicate Check now, refresh, Library filters/views, image controls and activity filters/reset pass with zero ChatGPT backend requests or page errors. Local Viewer overlay checks preserve deletion tombstones, queue pause, scope/connection heartbeat, folder readiness and the Viewer-busy idle-install gate.

## Earlier validation: 2.4.21

225 Node regression tests passed, including the new appearance preference tests. Runtime JS/MJS syntax checks passed. The isolated Edge theme matrix verified all eight palettes in both densities at 1920, 900 and 390-pixel widths (48 layout cases). All existing control IDs remained available; tested views retained full-width Library, compact overview/watcher spacing, unique IDs and no horizontal overflow. Foreground text in the tested controls measured at least 4.5:1 contrast in every theme (minimum among sampled controls: Paper 6.30:1; High Contrast 9.10:1).

The browser fixture also checked theme keyboard navigation, owner/read-only tab preference synchronization, refresh persistence, resetting appearance without changing the saved backup job, folded-section navigation, Library and activity controls, native release checking and no page errors. All data in the screenshot gallery and test backup is synthetic. See `docs/APPEARANCE.md` for the available appearance controls and visual gallery.

These results do not establish that the user's live ChatGPT backup finished, that the loaded Edge extension has been reloaded, or that Viewer 1.1.34 completed a new full import. Those remain distinct from isolated test coverage.

## Earlier validation: 2.4.18

210 Node regression tests pass; runtime JS/MJS syntax checks pass. New cases cover update schedule/default/off persistence, manual checks, duplicate-request sharing, ETag responses, malformed releases, offline retry and cancellation. Installer cases cover idle/default-off gating, concurrent turns, local Viewer edits, extra/conflicting files, permission loss, checksum/path validation, partial-write rollback and interrupted-checkpoint recovery.

New v2.4.18 checks reproduce the real native service-worker Illegal invocation before the fix and complete an official GitHub release check after it, without a fetch shim. A forced tall sidebar reproduces a 784 px overview/watcher gap before the fix; after it, gaps are 18–23 px at 1920/1440/1100/900/390 widths, Library remains full-width and there is no horizontal overflow. Double Check now, refresh, unique IDs and page errors are checked.

Historical v2.4.17 isolated Microsoft Edge used the actual dashboard and synthetic data: all four update schedules, double Check now, reload persistence, optional installer preference and missing-folder instruction, 80 cached sample chats saved with zero conversation-detail requests, conditional Hold/Resume, Library views/search/manual filters/images and log filters/reset; no page errors. No private data is included in published demos.

Real installation-folder picker access, automatic physical replacement/reload of the user's loaded extension, live private-account backup and a fresh full import into the latest Viewer were not run as part of these browser fixtures. Filesystem installer transaction tests use controlled in-memory handles; they do not prove the user's grant or browser reload behavior.

Historical checks remain in versioned changelogs: v2.4.11 linear candidate-growth and 10,000-file dashboard fixtures, v2.4.14 oversized checkpoint recovery, and Viewer 1.1.6 full integration. Those were not all rerun for this patch. No catalog schemas or content reuse algorithms changed here.

The shipped ZIP is independently checked by scripts/package-release.mjs for required files, local imports, CRC and SHA-256. Published commit/package/install verification is recorded separately in local PLAN.md and evidence; build success alone does not prove live browser behavior.

[Homepage](../README.md) · [Complete guide](FEATURES.md) · [Version history](HISTORY.md)
