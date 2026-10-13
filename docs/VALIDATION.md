# Validation for 2.4.21

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
