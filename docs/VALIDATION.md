# Validation for 2.4.17

209 Node regression tests pass; runtime JS/MJS syntax checks pass. New cases cover update schedule/default/off persistence, manual checks, duplicate-request sharing, ETag responses, malformed releases, offline retry and cancellation. Installer cases cover idle/default-off gating, concurrent turns, local Viewer edits, extra/conflicting files, permission loss, checksum/path validation, partial-write rollback and interrupted-checkpoint recovery.

Isolated Microsoft Edge uses the actual dashboard and synthetic data: all four update schedules, double Check now, reload persistence, optional installer preference and missing-folder instruction, 80 cached sample chats saved with zero conversation-detail requests, conditional Hold/Resume, Library views/search/manual filters/images and log filters/reset; no page errors. No private data is included in published demos.

Real installation-folder picker access, automatic physical replacement/reload of the user's loaded extension, live private-account backup and a fresh full import into the latest Viewer were not run as part of these browser fixtures. Filesystem installer transaction tests use controlled in-memory handles; they do not prove the user's grant or browser reload behavior.

Historical checks remain in versioned changelogs: v2.4.11 linear candidate-growth and 10,000-file dashboard fixtures, v2.4.14 oversized checkpoint recovery, and Viewer 1.1.6 full integration. Those were not all rerun for this patch. No catalog schemas or content reuse algorithms changed here.

The shipped ZIP is independently checked by scripts/package-release.mjs for required files, local imports, CRC and SHA-256. Published commit/package/install verification is recorded separately in local PLAN.md and evidence; build success alone does not prove live browser behavior.

[Homepage](../README.md) · [Complete guide](FEATURES.md) · [Version history](HISTORY.md)
