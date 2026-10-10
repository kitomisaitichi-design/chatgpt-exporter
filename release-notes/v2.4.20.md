# ChatGPT Exporter 2.4.20

- Fix Library images and other files repeatedly failing with **“Library file size differs from its metadata.”** A stale listing byte count can no longer invalidate complete download bytes. The actual prepared transfer length must match, and an available remote SHA-256 must still match the downloaded content.
- Reuse the exact same on-disk image across Library and Chat attachments when its SHA-256 matches, even if the Library listing reports a different size. Name alone remains insufficient to establish a match.
- Store the verified byte count for saved files separately from the listing's reported size. Repeated Library scans with the same stale metadata no longer reopen completed downloads or spawn unnecessary duplicate local copies. Real changed content is still refreshed.
- Recover records parked specifically by the old stale-size rejection during version upgrade; preserve unrelated server, authentication, filesystem and checksum failures.
- Keep the existing 10 MB automatic-download boundary on actual bytes, deduplicated content storage, all source references, and distinct file versions.
- Added focused regressions for mismatched listing versus complete transfer, hash-verified local reuse, preserved saved status on rescan, rejected mismatching checksums and parked-record migration.
