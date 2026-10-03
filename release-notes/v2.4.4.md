# ChatGPT Exporter 2.4.4 — shared files and independent source history

An uploaded or generated file can appear as both a chat attachment and a Library item. Previously those queues could fetch the same native file twice, and removed chat references could leave saved files out of the catalog. This release links native IDs before transfer, verifies actual saved bytes, combines available download routes, and retains independent source records.

- One verified copy shared across chat and Library names; hash sharing also works within a single attachment pass.
- Two failed transfer attempts shared by linked references. Explicit Retry releases matching unsaved references, including refreshed files; scans and restarts retain parking.
- Retained chat-only files and prior verified versions stay in the dashboard and Viewer catalog. Complete Library scans mark absence; unavailable chats and removed references retain local files. Stale repeated observations cannot restore false presence.
- New automatic chat and Library transfers are strictly below 10,000,000 bytes. Larger items remain manual; existing eligible copies remain accessible. Image preference is retained.
- Complete GitHub and packaged README feature guide and version history, covering every published release and documented development build.
- Source filters and source-name/history details. Unrelated local filename/size matches require a reported hash.
- Existing Viewer v1 catalog schemas preserved with additive source metadata and distinct historical identities. Verified against Viewer 1.1.6 with retained files, chat Files/text preview, source navigation, saved-byte downloads and manual 10 MB import.

Validation: 107 regression tests; runtime syntax and deterministic package checks; isolated Edge 253-file, file-intelligence, shared-source/disappearance and Viewer 1.1.6 integration checks. The updated extension has not been run against the live user account.

Update files in the same installed folder, Reload at edge://extensions, refresh the ChatGPT tab, and reopen the exporter. Preserve the backup and extension storage. No private backups, fixtures, credentials or browser profiles ship in the package.

Deleting a chat does not delete its Library files according to OpenAI's Library documentation. A deleted Library item is recoverable only when a server route or verified local copy remains; no missing server file is promised recoverable.
