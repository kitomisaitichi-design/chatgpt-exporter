# 2.4.22 — recover closed local database connections

- Fix the native “Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing” error affecting Viewer queue processing, passive watching and local indexes. The old page kept one resolved connection forever; it now reopens closed connections and shares an in-flight open across callers.
- Release stale handles on close/versionchange. Retry transaction creation once when a connection closes between retrieval and use. Never replay a transaction that has started.
- Resolve reads only after their transaction completes; aborted reads and writes reject explicitly. Keep permission, quota, missing-store and malformed-record errors visible, with atomic index batches.
- Preserve the existing database name/version/stores, saved chats, queue state, folder grants, file fingerprints, Viewer catalogs, image preferences and failure memory. No new dependencies or exported schema changes.
- Retain eight themes and all previous UI, revision and Library download fixes.

Verification: 233 Node regressions; native isolated Edge reproduction and recovery, concurrent requests, interrupted write preservation, every storage method and refresh. Full live-account backup/current Viewer import and original-profile activation were not run. Reload the existing Edge extension card after installing into the same directory; keep browser data.
