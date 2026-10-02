# v2.4.0 — October 2, 2026

## What changed in v2.4.0

- ChatGPT Library backup: catalog files and folders, then automatically save all file types strictly below **10,000,000 bytes**. The exact 10 MB boundary and larger files are listed for manual download.
- Stable file IDs keep duplicate filenames separate. Known local files are reused, downloaded bytes are hashed, and transient failures get bounded retries.
- Library work shares adaptive pacing and yields to chat updates. Changed conversations get priority; quiet watcher checks can stretch to 30 minutes, while full scans retain their deadline. Offline network work waits for connectivity.
- Activity controls: search, level/category filters, pause display, follow new events, jump to latest, clear view, reset, copy, TXT and JSON exports. Up to 1,500 events are retained; repeated notices are coalesced.
- Viewer-compatible native conversation JSON and index paths, plus a versioned file catalog and handoff manifest for your viewer's future file interface.

The same-folder upgrade retains queue/cache state. Library automatic backup and adaptive watcher checks can each be switched off. Detailed notes: `CHANGELOG-v2.4.0.md`.

## Validation

All **41 focused tests passed**, including the existing 35 regression tests. Runtime syntax and release package checks passed. An isolated Edge 154 smoke run with simulated website responses verified extension startup, a five-byte Library file saved and hashed, an exact 10 MB file listed without a download request, manual filtering, and log search/pause/reset.

Extended tests were deferred at the user's request to conserve compute: large unknown-length streams, diverse live Library schemas, folder/pagination variants, interruptions and resume, offline transitions, adaptive interval timing, and end-to-end viewer file-browser integration. No live-account Library download is claimed. Previous v2.3.9 browser checks are historical evidence, not validation of these new features.

