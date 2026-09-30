# v2.3.0 — revision-aware portable autopilot

- Preserve the v2.x IndexedDB database so a same-folder extension reload keeps the existing queue/cache.
- Add SHA-256 conversation fingerprints, revision history, and same-basename overwrite for changed chats.
- Compare passively loaded conversation bodies with the local cache, so body changes can be noticed even without a newer list timestamp.
- Traverse pending conversations oldest-first by conversation/message creation time, falling back to update time only when necessary.
- Add portable-state export/import containing queue, cursors, index metadata, schedule, chat classification, pacing tier and learned regime history.
- Add passive rescans (2/3/6/12 h) plus a 15-minute Manifest V3 alarm that nudges an already-open dashboard.
- Add bounded attachment backup for eligible text/document/data/source files under 10 MB, with observed-route reuse and retry metadata.
- Add Work / Codex / project / normal chat classification with evidence recorded in the index.
- Replace simple speed drift with persistent adaptive tiers, rolling pressure, explicit step-up on limits and cautious step-down after sustained quiet success.
- Expand `conversation-index.json`, `export-report.json`, and automatic `portable-state.json` checkpoints.
