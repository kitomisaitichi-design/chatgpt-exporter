# ChatGPT Exporter 2.4.15 — local download and storage repair

A stale local file handle no longer aborts the entire attachment/transcript search. Missing nested directories and stale fingerprint comparisons are handled as local misses with visible counts. Permission, quota and unexpected filesystem faults remain errors.

Backup and browser-database writes identify their failing operation and pause file work without consuming remote attempts. Quota errors advise freeing space on both system and backup drives; folder errors advise restoring/reselecting the folder. Existing queues, caches, originals, content hashes, account boundaries and exported schemas remain intact. Proven local charges are removed from complete and mixed histories. Older chat records without history release only their latest explicit local fault, retaining any earlier unknown charge. Genuine remote-only failures stay parked; all failure evidence is retained.

Validation: 189 regression tests and runtime syntax checks. A signed-in ChatGPT Library download of the reported screenshot succeeded and its 1,079,489-byte PNG was verified. The system drive initially had under 100 MB free and was rechecked after cleanup with 88 GB available. Browser policy blocked the installed extension dashboard, so live Resume, dashboard refresh/double-submit and full Viewer import were not rerun. A passing source test is not proof of that live run.

Update the existing unpacked extension folder, reload its card at edge://extensions and refresh the exporter dashboard. Free adequate disk space first, Rescan the permitted folders and Resume. Keep the same extension/profile and backup location; do not clear browser storage to recover space. The optional Viewer adapter must be preserved separately from the public release ZIP.
