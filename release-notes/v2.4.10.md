# ChatGPT Exporter 2.4.10

Both folder controls now supply transcript recovery. Existing files folder and remembered permitted file locations are included in recursive JSON matching, alongside the chosen backup and its picked parent. New queue IDs invalidate the in-memory inventory so a later-discovered chat can be found locally before a download. Persistent verified file fingerprints still avoid repeated parsing of unchanged files.

Includes all 2.4.9 repairs: local timestamps cannot force server refreshes, nested backup discovery, known-ID-only reuse from same-user older scoped backups, personal-selector/native workspace handling, stale-body protection, overlap pruning and single-worker Start.

Validation: 155 regression tests; isolated Edge verifies a transcript found only in Existing files folder, both nested backup paths, renamed local attachments, zero conversation/file downloads for local resume, exactly one write per local body on double Start, empty input and refresh. Library pagination, two-failure memory, the 10 MB boundary, six-minute control and the 10,000-file performance fixture pass. Real parent/child folders were checked read-only: 712 matching bodies, 673 local rewrites, five matching IDs still require fresh checking. Warm read-only scan around 0.3 seconds; live browser timings may differ.

README and complete version history updated. Current Offline Chat Viewer is 1.1.7; exported schemas and paths remain compatible. Live account resume and full Viewer 1.1.7 import were not rerun. Install in the same extension directory, reload at edge://extensions, refresh ChatGPT, reconnect, select the existing outer backup and/or Existing files folder, then Rescan local folders and Resume backup. Keep both old and nested backup folders.
