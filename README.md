# ChatGPT Exporter — English Autopilot 2.3.5 (Microsoft Edge)

This is a personal-use Edge/Chromium extension for building a durable local backup of the conversations exposed to your signed-in ChatGPT web session. Version 2.3.4 is an in-place upgrade from 2.2/2.3/2.3.1: it deliberately keeps the IndexedDB database name `english-autopilot-v2`, so replacing the files in the same unpacked-extension folder and pressing **Reload** at `edge://extensions` preserves the existing queue/cache when Edge keeps the same extension identity.

Version 2.3.5. Read [the update notes](CHANGELOG-v2.3.5.md) for the stuck-chat and attachment integrity fixes.

For an existing installation, stop the run, replace files inside the same extension folder, reload the extension at `edge://extensions`, and reopen the exporter. The same extension identity retains queue, cache, discovery cursors and folder handles. Choose Start / resume. Importing or rescanning everything is unnecessary when that state is still present.

For first installation, extract this folder to a permanent location, enable Developer mode at `edge://extensions`, and choose Load unpacked on the folder containing `manifest.json`. Open the extension dashboard, connect to the intended signed-in ChatGPT account/workspace, and choose your backup folder. Select an indexing/download mode and start. Keep Edge, the exporter dashboard and its ChatGPT tab open, and the computer awake.

Chats are saved as full JSON plus selected-branch Markdown. The backup also stores a conversation index, progress report and portable queue state. Eligible document/code/text attachments up to 10 MB are saved separately. Choose an existing-files folder to reuse locally available originals by filename and size. Error responses are not successful attachment downloads.

Rate limits retain progress and server cooldowns. File-specific failures yield to other items; account, browser-check, folder-permission or quota problems require attention. An unavailable attachment remains listed in the progress report. Private website endpoints may change, and the exporter cannot reconstruct deleted/unavailable server data.

Portable state can be imported after connecting and choosing the existing backup folder in another installation. It preserves IDs, statuses and discovery cursors; locally available JSON avoids repeat downloads. Keep original backups before uninstalling the extension or clearing browser data.

Use Stop run to checkpoint, Hold in place to temporarily hold the current engine, and Start / resume to continue. Scan now checks for new/changed chats. Passive watcher settings control periodic rescanning and whether network work yields while you use ChatGPT. See the included historical change notes and third-party notices for additional behavior and attribution.


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


## What v2.3/2.3.1/2.3.4 adds

### Revision-aware exports

Every retrieved conversation gets a SHA-256 content fingerprint. Before a server-marked refresh, v2.3 fingerprints the previous v2.2 cache/disk JSON when available. When the body differs, the existing JSON and Markdown basename is overwritten with the current conversation and the index records the prior hash, current hash, revision count, change time, and reason.

A conversation already loaded by ChatGPT can also be noticed passively. The extension compares that loaded body with its local cached body; a real difference requeues that conversation even if the server's list timestamp did not change.

### Oldest-first traversal by real conversation time

Download selection is ordered by `create_time`, or the earliest message creation time available in the conversation body. `update_time` is only the fallback. The queue therefore walks old conversations before newer ones based on calendar time, not on when you ran the backup.

### Portable state for another computer

**Export portable state** writes a JSON bundle containing:

- conversation IDs, URLs, titles, discovery provenance and project association;
- active/archived/project discovery cursors and verification state;
- saved/pending/error metadata, content hashes and revision history;
- Work/Codex/normal classification and its evidence;
- passive-rescan schedule;
- adaptive pacing tier, cooldown, success/limit history and recent policy regimes.

**Import portable state / index** accepts either a v2.3 portable-state JSON or a `conversation-index.json`. It must be used with the same signed-in ChatGPT account/workspace. The state bundle intentionally does **not** duplicate full conversation bodies; copy the backup folder as well if moving computers. On the new computer, valid JSON in that folder is reused before any conversation fetch, so a copied backup can regenerate Markdown/cache without redownloading the chat.

`portable-state.json`, `conversation-index.json`, and `export-report.json` are also refreshed in the backup root while the exporter runs.

### Passive watcher

With the exporter dashboard and its ChatGPT worker tab left open, passive mode can:

- perform a full active/archived/project rescan every 2, 3, 6, or 12 hours;
- wake sooner when already-open ChatGPT tabs expose a previously unknown conversation link;
- wake sooner when a conversation body loaded by ChatGPT differs from the local cached fingerprint;
- retry only genuinely transient / rate-limited attachment work after its retry window; hard unavailable files stay retired until you explicitly retry or provide a local match.

A Manifest V3 alarm nudges the open dashboard every 15 minutes so a backgrounded tab does not rely only on JavaScript timers. The service worker itself does not fetch conversations or write your backup folder. Edge must be running; the dashboard and worker tab must remain available; the computer cannot be asleep.

### Eligible attachment backup (under 10 MB)

After a conversation is current, v2.3 scans its message metadata for attached text/document/data/source files and attempts to save eligible files under:

`attachments/<conversation basename>/<filename>`

Default recognized extensions include `.txt`, `.md`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.xlsm`, `.csv`, `.tsv`, `.html`, `.htm`, `.rtf`, `.odt`, `.ods`, `.pdf`, `.json`, `.jsonl`, `.yaml`, `.yml`, `.toml`, `.xml`, common source-code/project files, SQL, notebooks, scripts, config files, and similar text/source artifacts. Images, audio and video are not part of this attachment pass.

The exporter first checks permitted local folders for an exact filename + byte-size match. If found, it copies that file into the self-contained backup with no ChatGPT request. For files not found locally, the bridge reuses an observed ChatGPT download route or metadata URL when available, then tries at most one canonical signed-in file-download route. The 10 MB limit is checked from metadata/headers and again after retrieval. Hard 404 / missing-route / permission failures are recorded as unavailable and are not retried automatically; only rate limits and transient connection/server failures remain retryable.

### Work / Codex / normal chat indexing

The index now has `chat_kind` and `chat_kind_evidence`. Classification prefers explicit conversation metadata containing a Work or Codex marker; project discovery produces `project-chat`; otherwise the entry is `normal-chat`. This is intentionally evidence-labelled instead of guessing from the title or prose of the conversation.

### Adaptive step-up / step-down pacing

The controller now has persistent tiers rather than only "faster/slower":

- a real 429 or observed app limit steps sensitivity upward;
- recent native ChatGPT traffic, streaming, writes, page loads and navigation shrink the local rolling traffic budget dynamically;
- sustained successful quiet windows step the tier down gradually;
- recent tier changes and policy regimes persist across reloads and in portable state;
- page-opening recovery remains more expensive than a normal read;
- after a long wait caused **only** by the local heuristic budget, one low-cost check may be tried; server-requested cooldowns are never shortened.

This uses observable traffic and responses to be polite and stable. It does not know, predict exactly, or bypass ChatGPT's hidden anti-abuse/rate-limit logic.

## Existing v2.2 behavior retained

- active, archived and project discovery without depending on the sidebar UI;
- passive capture of visible/open/search-result conversation links;
- one-conversation-at-a-time durable writes;
- valid existing JSON recovery before refetching;
- difficult-chat browser recovery for supported 404/412 cases;
- incomplete discovery is reported instead of falsely called complete;
- queue/cache/cooldown survives dashboard reloads;
- cached-chat ZIP export remains available (with the existing memory-size guard).

## Install / update in Edge

For an update from v2.2:

1. Pause the current exporter.
2. Extract v2.3 and replace the files **inside the same installed unpacked-extension folder**.
3. Open `edge://extensions` and press **Reload** on ChatGPT Exporter — English Autopilot.
4. Reopen its dashboard. The existing IndexedDB queue/cache should still be present.
5. Keep the same backup folder. If the previous run was complete, either leave passive mode on or press **Scan now for new / changed chats**.

Do not uninstall/reinstall if preserving the existing extension database is important; an unpacked extension can receive a new identity when loaded from a different path.

For a fresh install, enable Developer mode in `edge://extensions`, choose **Load unpacked**, and select the folder containing `manifest.json`.

## Files written

- `json/<title>_<conversation-id>.json` — complete server conversation payload, including all branches available in the payload;
- `markdown/<title>_<conversation-id>.md` — readable selected branch;
- `attachments/<conversation basename>/...` — eligible attachments that could be retrieved;
- `conversation-index.json` — chronological index with chat type, hashes, revisions and attachment results;
- `export-report.json` — detailed progress/discovery/pacing/error report;
- `portable-state.json` — portable queue/index/schedule/adaptive-controller state.

## Limits

"Complete" means every conversation the enabled discovery routes exposed was saved and those discovery routes reached their end. The website uses private endpoints that can change, and the extension cannot reconstruct deleted chats or conversations ChatGPT never exposes and for which no ID/link/cache exists.

A passive watcher is not a daemon: nothing runs while Edge is closed or the computer sleeps. Sign-in challenges, account/workspace changes, and revoked folder permissions still require user action.

Backups contain private conversation content. The extension has no external analytics/upload backend and stores no bearer token in its IndexedDB/export files. Authentication remains in the signed-in ChatGPT page.

See `THIRD-PARTY-NOTICES.md` for upstream references and bundled-library notices.



## v2.3.4 attachment + recovery repair

Attachment backup is now **local first**. The exporter checks files it can already see on disk before making any attachment request. Your normal backup folder is scanned automatically (excluding the transcript JSON/Markdown trees), and you can optionally click **Choose existing files folder** to grant read access to the folder tree where your original uploads/downloads live. An exact filename + byte-size match is copied into `attachments/<conversation>/...` locally so the backup remains self-contained.

Browser security does **not** let an extension scan an arbitrary hard drive without permission. If an original file lives outside the selected backup folder, point the new existing-files picker at an enclosing folder once. That directory handle is kept in the same extension database for later runs.

Hard attachment failures are no longer treated as endlessly retryable. A missing route / 404 / permission response is recorded as unavailable and left alone. Only HTTP 429 and genuinely transient failures stay retryable. v2.3.1 `failed` attachment records are migrated out of the six-hour retry loop automatically.

The difficult-conversation browser recovery option is now off by default. If you enable it, a hard 404/412 chat gets at most one browser-opening recovery attempt per retry cycle instead of repeated deferred-navigation loops.

## v2.3.1 migration + pacing repair

When an existing backup folder is selected, v2.3.1 first reconciles it locally. Every conversation ID retained in `conversation-index.json` is restored to the queue, and every physically present `json/*.json` transcript is credited as already saved immediately. This local reconciliation does not consume or wait on the network pacing controller.

Network pacing is now driven mainly by the adaptive tier interval. A confirmed limit steps the tier upward; a sustained clean run steps it back down. Local burst guards only protect against short overlaps with visible ChatGPT activity and are not a second five-minute quota. Locally inferred cooldowns are bounded; explicit server `Retry-After` values are honored as given.

Attachment retrieval runs only after conversation discovery/verification and transcript downloading are current. Local scans that find no eligible attachments do not issue a ChatGPT request.


## v2.3.4 prepared-attachment repair

v2.3.2 could successfully prepare an attachment and then reject its local chunk copy because the generic workspace check ran again after preparation. v2.3.4 binds prepared bytes to the signed-in user instead, so workspace-header churn does not turn a good file fetch into a false retry. Successful attachment reads also feed the same adaptive success controller used by transcript reads. Local reconciliation logs now show how many local files were scanned and whether the optional existing-files folder was actually readable.


## v2.3.4 live-hold and quiet-use behavior

- Hard conversation HTTP 400/404/410/412/422 results are parked for 7 days. Normal scans and Retry unresolved do not hammer the same conversation again during that hold; a newer server update timestamp clears the hold.
- Discovery no longer performs the old full-list verification loop. The initial traversal is authoritative when it completes cleanly; only an incomplete discovery route is repaired.
- Attachment/transcript work continues while a discovery repair is merely waiting, instead of idling for verification.
- **Hold in place** keeps the dashboard worker, queue position, discovery cursors, connection and in-memory engine alive. Resume continues the same loop without inventory/discovery restart. **Stop run** remains the durable stop.
- When **Yield network work while I use ChatGPT** is enabled, clicks, keypresses, wheel/touch/scroll activity in any ChatGPT tab starts a 6-minute exporter network quiet window. Local disk/cache work is still allowed.
