# v2.4.1 · Library reliability and Viewer integration

- Viewer v1.1.4 reads chat attachment and Library catalogs, filters files by source chat, downloads local copies, and imports manually downloaded files at their stable expected paths.
- Exporter writes expected paths for files at or above 10,000,000 bytes. They remain manual; automatic Library downloads are strictly smaller than that boundary.
- Sparse native observations retain known sizes, names, timestamps and saved metadata. Full pages without pagination markers receive an additional coverage check. Folder limits and repeated pages report incomplete coverage.
- Native rate-limit observations are consumed once. Transient discovery errors resume the interrupted page with bounded retries.
- Oversized response headers and streams cancel their bodies. Stop/hold is checked between file chunks and before writing the complete file.
- Saved Library copies are checked locally on resume. Missing, changed or error-envelope files return to repair; changing folders also requeues Library files. Local reuse respects a known checksum.
- Four Library catalogs now skip unchanged snapshots and batch updates every two seconds, with a final flush at stop/completion. Paused activity display freezes repeated-message counters; later repeated notices appear after clearing the view.

Validation: 54 exporter regression tests; 162 Viewer backend tests; isolated Microsoft Edge integration covering real extension execution, simulated ChatGPT responses, Stop/resume, exact-size manual handling, actual exported catalogs, manual import and byte-identical local download. Live ChatGPT Library account/API compatibility remains unverified.
