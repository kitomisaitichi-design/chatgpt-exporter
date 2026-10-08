# ChatGPT Exporter 2.4.16

Fix: a long attachment path caused a file-specific NotFound write failure, which 2.4.15 incorrectly escalated to a global pause. New writes preserve the original display name in metadata, shorten the disk basename to 64 characters, retain the extension and content hash folder, and retry once with a compact filename. Two file-specific missing-path failures produce a manual skipped-file record with both errors; the queue continues without spending remote attempts. Explicit Retry is available. Missing destination directories, permission, quota and database errors remain global failures. Existing files, aliases, versions, queues and Viewer adapters are retained.

Library fallback links now search by the complete original filename. The supplied log is from local saving after retrieval, so it does not indicate a URL lookup failure.

Validation: 194 tests pass, all runtime syntax checks pass, and compact-path bytes were written/read on disk and SHA-256 verified. Reported original path: 267 characters; new path at the same root: 209. The Windows browser path-limit explanation is consistent with the log and reproduced under an imposed path limit; the installed authenticated extension run was not verified. Published as v2.4.16.

Activate: reload ChatGPT Exporter at edge://extensions and refresh its dashboard, then Resume. The current connection/profile, backup and queues remain unchanged.
