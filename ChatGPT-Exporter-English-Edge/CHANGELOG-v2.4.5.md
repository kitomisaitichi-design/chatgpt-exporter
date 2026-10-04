# ChatGPT Exporter 2.4.5 — responsive dashboard and live activity pause

Large inventories previously caused repeated full-catalog analysis and file-by-file scans of every saved reference. The dashboard could freeze while polling or browsing. The six-minute activity setting also reopened as enabled even when its saved value was off, and setting changes waited for full backup reports before updating the display.

## Changes

- Native-ID lookup indexes replace repeated full-reference searches in shared failure budgets and retained file joins. Queue selection filters and sorts eligible files first and shares one lookup across candidates.
- Dashboard statistics and file view models cache unchanged inventories. Inventory presentation no longer builds the export catalog; duplicate/version analysis is reused across summaries and selection.
- Progress notifications share one animation frame. Unchanged log events skip repeated date formatting and rendering. Unchanged file rows retain their DOM and expanded Details; changed rows retain expanded Details by file identity.
- Search waits for 120 ms of typing quiet. All displays up to 500 rows per page for large inventories, with first/previous/next/last controls and search reaching every item. Inventories of 500 or fewer still display together.
- The six-minute activity checkbox loads its actual saved `yieldUser` value, stays available during a run, and immediately shows On/Off plus remaining quiet time. Turning it off wakes the worker's current activity wait, which rechecks conditions within its one-second tick. Actual server cooldowns, app streaming, offline waits and network spacing continue to apply.
- Changing the activity checkbox saves the setting without running image scans or rewriting the entire backup report. Other settings update the display before report writes; image classification runs only when the image option changes.
- Catalog generation reuses a single snapshot for both HTML catalogs and manual JSON, and checks the two-second batching window before generating it.
- Shared-file identity, SHA-256 deduplication, independent source history, failure memory, image choice, strict automatic transfers below 10,000,000 bytes and Viewer relative-path schemas remain supported.

## Validation

115 regression tests pass. Isolated Edge 154 checks use 10,000 files, 5,000 chats, 15,000 source records and 1,500 log events. Queue selection took about 74 ms; 120 unchanged file/log updates took about 0.3 ms, preserving row identity and open Details. Activity-checkbox feedback took about 132 ms and its off setting survived reload. These timings describe a synthetic test on this machine, not a guarantee for every backup.

End-to-end fixtures check the checkbox during an active six-minute network gate, downloads, all 253 fixture files, two-failure parking/retry, source disappearance, hash aliases, image choice, Stop/resume, responsive layouts, and current Viewer 1.1.6 file previews, source navigation and manual imports. The updated extension has not been run against the live user account.

## Upgrade

Replace files in the same installed extension folder, click Reload in `edge://extensions`, refresh ChatGPT and reopen the exporter dashboard. Keep the existing backup folder; queue, cache, file history and schedules remain in the same IndexedDB database. See README.md for the complete feature guide and version history.
