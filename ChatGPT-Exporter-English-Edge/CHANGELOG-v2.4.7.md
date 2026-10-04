# ChatGPT Exporter 2.4.7 — October 4, 2026

Resuming a backup could immediately pause after local recovery with `Cannot read properties of null (reading 'localeCompare')`. Retained chat attachments without native file IDs were valid inputs, but equal-size candidates reached an unsafe ID comparison in the Library queue.

- Queue tie-breaking now uses the existing source key or name when a native ID is absent.
- Duplicate analysis, catalog ordering and Library name/status/recent sorts accept null text fields. File icons also accept missing labels.
- No native ID is invented. Existing IDs, saved paths, SHA-256 hashes, attempts, parked decisions, source history, cursors and cache remain intact.
- The adaptive scheduler, bounded attachment batches, image controls, strict automatic limit below 10 MB, and Viewer catalog schemas are unchanged.

Five new regressions cover portable restart, null-ID queue rotation, duplicate analysis, catalog preservation and all Library sorts. All 130 regressions pass. A read-only in-memory check reproduced the exact failure from the existing saved state before the fix and completed queue selection/catalog generation after it; no private data enters tests or releases. Live account resume still requires reloading the installed extension.

Update the same folder, Reload in edge://extensions, reopen the exporter and resume the existing backup. Do not uninstall or reset it.
