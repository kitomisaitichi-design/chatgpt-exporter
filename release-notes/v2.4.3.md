# ChatGPT Exporter 2.4.3

## Smart content and versions

- SHA-256 equality lets different names and IDs share one verified local binary. A reported Library hash can skip a transfer after verifying the saved bytes. Otherwise the first unknown file must be read once; the exporter avoids writing a second copy of identical content.
- New binaries use content-hash directories. Refreshing one file cannot overwrite bytes still referenced by another version or chat.
- **Deduplicate & smart scan** checks existing saved Library and chat files one at a time, publishes every new reference before deleting redundant bytes, rechecks both copies, and retains a removal journal for Stop/restart recovery. Original filenames, IDs and source-chat links stay in catalogs. Mismatched or missing files stay for inspection.
- Group same-folder `(1)` / `(2)` copies and explicit v/rev names. Suggest a preferred version using modification dates, upload/creation dates or explicit revisions. Size-only, missing and tied evidence requires review. Distinct content is retained.
- Add evidence in file details, four new filters, unique-copy size totals and shared-copy labels. Keep Viewer catalog schemas compatible through additive fields.

## Image choice

- **Download images** controls new Library and chat image downloads. Persist it in the job and portable state. Keep existing saved images and list excluded images for manual access.
- Support image uploads and image pointers in conversation JSON. Recheck saved JSON once on upgrade; enabling the toggle resumes eligible images without retrieving transcripts again.
- Exclude known images before requests. Check download-link metadata and response headers to cancel opaque image bodies. Preserve manual handling at or above 10,000,000 Library bytes and two-failure parking.

## Validation and upgrade

90 regression tests pass. Isolated Edge integration covers a 253-file inventory, verified download bytes, failure memory, exact size boundary, Viewer import/download integration, renamed hash aliases, remote-hash request suppression, deduplicate cleanup, version labels, image exclusion/resume and responsive layouts. Live-account execution remains unverified.

Reload the existing extension in Edge, refresh the connected ChatGPT tab, and reopen its dashboard. Keep the same installation folder and backup root to preserve state. Use **Deduplicate & smart scan** to consolidate existing saved duplicates. Local smart-scan reads are bounded to the existing 10 MiB attachment limit. No private fixtures, account data or tokens are shipped.
