# ChatGPT Exporter 2.4.9

Existing transcript recovery no longer treats newer local timestamps as server changes. Validated local bodies repair stale timestamp refresh flags while completed replies, genuinely newer server metadata and interrupted newer revisions remain eligible for fresh checking. A stale disk fallback cannot overwrite a newer pending body.

Folder discovery searches a selected older backup for a matching nested backup before rejecting the outer scope. The picked parent remains a search source. An explicitly selected/remembered older backup for the same user can supply verified transcript bodies only for IDs already in the current queue; unrelated chats and foreign job state are not imported. The personal selector label no longer overrides a native workspace ID observed under that selector.

Transcript search fingerprints persist locally across refreshes. Repeated scans check the same file handle, size and modification time before reusing parsed metadata/hash results; changed files and expanded cross-scope ID filters invalidate those results. Already scanned subtrees are skipped in overlapping transcript and file roots. Double Start reserves one worker before the first async preparation step.

Validation: 155 regression tests pass. Isolated Edge tests cover nested roots, known-ID restrictions, renamed files, verified local copies, empty ID input, double Start with exactly one write per queued body, reload/rescan, Library pagination, failure parking, the 10 MB boundary, image preference controls and six-minute activity controls. The 10,000-file performance fixture passes. Read-only checks of the reported real parent/child backups find 712 matching bodies and queue 673 local rewrites; five matching IDs retain a fresh-check requirement. Warm indexed scan was about 0.28 seconds versus 15.8 seconds cold in the local read-only harness. This is not a live browser/account speed guarantee.

Native JSON/Markdown, relative paths and Viewer catalog schemas remain unchanged. Current Offline Chat Viewer release is 1.1.7. Its full live import was not rerun for this release. The user's live extension/account was not reloaded or resumed during testing.

Update in the same unpacked extension folder, reload its card in edge://extensions, refresh the signed-in ChatGPT tab and reopen the dashboard. Connect, choose the outer existing backup folder if needed, then Rescan local folders and Resume backup. Existing source files remain intact; local rewrites copy matching bodies into the chosen current root. No queue reset is required.
