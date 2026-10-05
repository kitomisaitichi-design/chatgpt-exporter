# ChatGPT Exporter 2.4.8 — October 4, 2026

Folder selection previously always appended chatgpt-backup-<scope>, even when the selected folder was already the backup. Transcript discovery only inspected immediate JSON children with a narrow filename suffix. Local-copy matching relied on one filename index and offered little feedback.

- Detect matching root/parent/nested/renamed backups before creating a destination. Empty named backup roots survive reconnect without nesting another root. Foreign workspace markers and backup names are excluded.
- Read transcript identity from JSON content; recursively recognize nested/renamed files and conversation arrays. Credit validated canonical bodies immediately; queue local rewrites for other layouts, preserving sources and preferring detected bodies over stale browser cache.
- Restore matching portable queues and missing metadata; preserve live failure decisions, refreshes, hashes and discovery state. Show browser-cache bodies separately from files actually on disk.
- Remember up to eight permitted folders per workspace, persist a local file index, and offer Documents/Downloads/Desktop/last-location picker shortcuts. Rescan rebuilds detection after file changes.
- Search prior indexes at nested backup roots and directly selected attachments subfolders. Match native IDs, hash paths, normalized names and expected hashes across differently named same-size files. Verify actual bytes before reuse. Reuse applies to chat and Library queues.
- Count large, empty/error and eligible local files; explain unmatched references and scan limits. Yield directory/hash batches; preserve image preferences, parked failures, strict under-10-MB transfers and Viewer schemas.

Limits: only selected/remembered currently granted locations are accessible. A subfolder grant does not include its parent/siblings. Per-source walks: 12 levels, 50,000 files, 5,000 directories; root search: four levels/400 directories; JSON parsing: 64 MB, direct legacy probing 32 MB. Full-machine or other-browser-profile search is unavailable through these handles. Names and sizes alone do not prove content identity.

Validation: 144 regressions, including 14 new local-detection tests; isolated Edge root/parent/index/hash-copy/reload/rescan checks; 253-file Library integration and 10,000-file performance checks. A read-only existing-folder scan confirmed root reuse and content recognition. Source/releases contain no private backups or indexes. Live account execution after upgrade remains unverified. Current Viewer is 1.1.7; existing catalog schemas are retained.

Reload the same installed extension folder. Choose the existing backup root or its parent to rebuild local detection, or use Rescan local folders. Select/grant each new original-files folder once; remembered permitted locations are searched subsequently. Resume the existing backup without resetting it.
