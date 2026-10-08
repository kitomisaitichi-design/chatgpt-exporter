# ChatGPT Exporter 2.4.14 — large-archive recovery

Fixes prior same-user archives being silently excluded when portable-state.json exceeds the 64 MiB JSON limit. The detector reads at most 64 KiB of identity header without loading the oversized checkpoint. Actual transcript JSON is still validated; only conversation IDs already in the current queue can be reused across workspace keys. Different users, conflicting identities and permission loss remain protected.

The dashboard explains that index-only links are not saved transcripts and tells you how to grant access to an older archive's parent folder. Existing incremental file/hash indexes, two-attempt failure memory, image controls, manual cleanup and Viewer catalog formats are retained. Includes the v2.4.13 metadata/Resume fix. No dependencies or exported schema changes.

Validation: 180 regressions, syntax checks, and isolated Edge folder recovery with a 65 MiB checkpoint, empty input, double Start, refresh, and zero ChatGPT file/conversation requests. Read-only real archive reproduction confirmed the 69 MB checkpoint failure; repaired detection found 721 matching bodies. A separate authorized local reconsolidation verified missing copies and rebuilt catalogs without deleting originals. Live authenticated resume and full Viewer import were not run.

Update the same installed extension folder with rollback, reload its card at edge://extensions, refresh the dashboard, connect, Rescan local folders, then Resume. Saved counts reflect verified current transcripts; newer pending revisions remain queued. The browser cannot silently access a parent outside its folder grants: use Reuse files you already have to select that parent when necessary.

Viewer compatibility follows the unchanged catalogs. Current Viewer: 1.1.27, checked October 8. The optional Viewer bridge is separate from the release ZIP; preserve an existing adapter when updating. Its older installer is version-gated and should not be forced onto this release without validation.
