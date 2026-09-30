# v2.3.5 — queue progress and attachment integrity

Updated September 30, 2026.

- A successful conversation read retains the newer list timestamp and records the timestamp it checked. An older detail response cannot repeatedly requeue the same chat. A genuinely newer list timestamp still queues an update.
- Cached changed-body observations are handled once. Older passive payloads cannot replace a newer cached conversation.
- A file-specific write failure defers that chat and lets other chats continue. After three failed attempts it is reported as failed. Retrieved chat data stays cached, so retrying its write does not repeat the conversation download. Folder access, security, and quota failures still stop for attention because they affect the whole backup.
- Network failures, including responses without a status, have a bounded three-attempt request budget before deferral. Attachment download-link cycles and excessive redirects are rejected. Attachment routes have a shared 60-second budget, bridge calls have a 100-second timeout, and local file writes have a 90-second timeout with an attempted abort.
- HTTP-200 attachment error envelopes, including `GetDownloadLinkError/file_not_found`, are rejected rather than saved as document bytes. Chunk transfer must advance and finish at the declared length. Known original file sizes are checked before saving.
- Tiny previously saved attachment files are revalidated on upgrade. Local attachment matching excludes known service-error envelopes. Existing saved files are checked before their saved status is reused. Original suspect files remain on disk for inspection; an unavailable original is reported honestly.
- Fixed a missing `safeName` import that could defer otherwise successful attachment downloads.
- Completion text includes unavailable/deferred attachment counts.

Validation: eight focused tests passed, including a failed-write queue yielding to another chat, bounded status-zero retries, stale timestamp deduplication, repeat-observation suppression, real bridge error-envelope rejection, circular-link rejection, and valid document chunking. A real Edge 154.0.4258.37 extension test in an isolated profile verified transcript writes, a real fixture attachment, rejection of a missing-file response, and rescan without a repeated conversation download. Website responses were mocked. Your live account and original attachment availability were not tested.

## Updating while keeping progress

Stop the current run. Replace files inside the same installed extension folder, then reload its card at `edge://extensions` and reopen its dashboard. Keep the same extension folder so the database identity, queue and cache remain available. Start/resume uses existing discovery cursors and saved files; a full scan is not required to install this fix.

For recovery in another installation, connect to the same account/workspace, choose the existing backup folder, then import `portable-state.json`. The portable queue retains known links and statuses; conversation JSON in the backup folder provides the locally reusable bodies. No reset or deletion of the old backup is needed.

## Why tiny attachment files are invalid

The supplied `attachments.zip` contained 236 file entries: 235 were exactly 105 bytes containing a JSON `file_not_found` service error, and one was a 79,182-byte Markdown file. Windows may display each tiny file as 1 KB after rounding. Those error entries do not contain the original uploaded documents. This update prevents that false success and allows valid original files in a selected local file library to be reused. It cannot reconstruct documents that ChatGPT no longer serves and that are absent locally.

The attachment scope remains eligible text, document and code files up to 10 MB. Existing media/type exclusions remain in place.
