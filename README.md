# ChatGPT Exporter — English Autopilot for Microsoft Edge

**Version 2.4.1 · October 2, 2026**

Build a local backup of the conversations available to your signed-in ChatGPT web session. The extension discovers active, archived and project chats, writes conversation JSON and readable Markdown, tracks revisions, and backs up eligible attachments. Your backup stays in the folder you select.

[Download v2.4.1](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.1) · [All releases](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases) · [Source code](https://github.com/kitomisaitichi-design/chatgpt-exporter/tree/main/ChatGPT-Exporter-English-Edge)

## Library files in your Viewer

Use [Offline Chat Viewer 1.1.4](https://github.com/kitomisaitichi-design/chatgpt-viewer/releases/tag/v1.1.4), select this backup's root folder, then open **Files & Library**. It reads `conversation-index.json` and `attachments/library-index.json`, opens saved files and their source chats, and filters files for the selected conversation. For files at or above **10,000,000 bytes**, use the ChatGPT link to download them yourself, then **Import downloaded copy** in the Viewer. The Viewer copies a size-checked file into its expected backup path and keeps any existing copy. Importing a file does not rebuild message indexes.

v2.4.1 also preserves complete metadata during sparse observations, resumes pagination with bounded retries, checks existing Library copies on resume, cancels oversized streams, honors Stop/hold between chunks, batches changing catalogs and skips unchanged catalog writes. Manual catalogs include the expected backup path. Paused logs freeze duplicate counters, and new repeated notices remain visible after clearing the view.

Keep the exporter dashboard and signed-in ChatGPT tab open for passive checks. Quiet recent-chat polling gradually backs off; new activity resets it. Full discovery and Library scans retain their fixed deadlines. Offline periods and cooldowns preserve the queue.

Validation: **54 exporter tests**, **162 Viewer backend tests**, and an isolated Edge integration check covering Stop/resume, exact 10 MB manual handling, actual exporter catalogs, manual import, source-chat navigation and intact saved-file bytes. ChatGPT website responses were simulated; live-account Library/API compatibility remains unverified.

## What changed in v2.4.1

- ChatGPT Library backup: catalog files and folders, then automatically save all file types strictly below **10,000,000 bytes**. The exact 10 MB boundary and larger files are listed for manual download.
- Stable file IDs keep duplicate filenames separate. Known local files are reused, downloaded bytes are hashed, and transient failures get bounded retries.
- Library work shares adaptive pacing and yields to chat updates. Changed conversations get priority; quiet watcher checks can stretch to 30 minutes, while full scans retain their deadline. Offline network work waits for connectivity.
- Activity controls: search, level/category filters, pause display, follow new events, jump to latest, clear view, reset, copy, TXT and JSON exports. Up to 1,500 events are retained; repeated notices are coalesced.
- Viewer-compatible native conversation JSON and index paths, plus a versioned file catalog and handoff manifest for the Viewer Files & Library interface.

The same-folder upgrade retains queue/cache state. Library automatic backup and adaptive watcher checks can each be switched off. Detailed notes: `CHANGELOG-v2.4.1.md`.

## Install in Edge

1. Download **ChatGPT-Exporter-English-Edge-v2.4.1.zip** from the release page. The separate `.sha256.txt` asset contains its SHA-256 checksum.
2. Extract the ZIP to a permanent folder. Inside it, find `ChatGPT-Exporter-English-Edge`, which contains `manifest.json`.
3. Open `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder.
4. Open the exporter dashboard from the extension. Connect to the intended signed-in ChatGPT account and workspace.
5. Choose your backup folder, select the indexing/download mode and enabled discovery sources, then press **Start / resume**.
6. Leave **Passive watcher** enabled to continue checking after available export work finishes.

No developer tools or build step are required to install the packaged extension. The GitHub **Source code** archives contain the repository; select its `ChatGPT-Exporter-English-Edge` subfolder if installing from those archives.

## Update without resetting your backup

1. Stop the current exporter run or passive watcher.
2. Extract the new release and replace the files **inside the same installed unpacked-extension folder**.
3. Click **Reload** on the existing extension card at `edge://extensions`.
4. Reopen the dashboard. Connect to the same account/workspace if prompted, keep the same backup folder, retain Passive watcher, and press **Start / resume** if stopped.

Keep the same installation path and Edge profile to retain the extension identity, IndexedDB queue/cache, discovery cursors, cooldowns and directory handles. Avoid uninstalling or loading a second copy from a different path when preserving that state matters. A reset, reimport or full rescan is not required merely to install this update.

## How Passive watcher works

Keep **Edge, the exporter dashboard and its connected signed-in ChatGPT tab open**, with the computer awake. The dashboard can remain in the background. Closing it, stopping the watcher, closing Edge, or putting the computer to sleep stops active processing.

| Check | Default or options | Coverage |
| --- | --- | --- |
| Recent server metadata | 5 minutes; optional 15 or 30 minutes | First updated-order page of active chats, enabled archived chats, project previews, and one rotating known project |
| Full traversal | Selected 2, 3, 6 or 12 hours | Enabled discovery sources beyond the recent pages |
| Observed ChatGPT tabs | While connected | New links, changed loaded bodies and completed native replies |
| Dashboard alarm | 1 minute | Nudges the open dashboard; it does not independently export chats |

Recent checks are bounded checks. The full traversal provides broader discovery coverage. The five-minute setting is a target interval: active streaming, enabled user-yield behavior, browser sleep and actual server cooldowns can delay network requests. User-yield waits for six quiet minutes before new network work. Fresh conversation bodies already captured from ChatGPT can be saved locally during a cooldown.

Use the watcher health text to distinguish an active watcher from one waiting on network permission, user activity or rate limits. **Stop passive watch** suspends automatic wakeups; **Start / resume** reactivates them. **Scan now** requests a new discovery pass. Reopening an active saved watcher reconnects while preserving its queue and cooldown.

## Repair tiny or missing attachments

Windows may display a tiny service-error response as “1 KB.” A JSON response such as `GetDownloadLinkError/file_not_found` contains no original document bytes. The exporter validates downloads and saved files before counting them as successful attachments.

After updating, select the existing backup folder and resume. Upgrade validation uses the saved conversation JSON. **Repair attachment backup** explicitly reopens failed/unavailable attachment work. Valid saved files and existing transcripts are reused; missing or invalid attachment bytes are retried through the available routes.

Known error files are preserved for inspection under `attachment-errors/<conversation>/<filename>.error-response.json` before their false document entries are removed from `attachments`. Successful retrieval saves the actual file in the normal attachment location. Files still unavailable remain reported as unavailable or deferred.

If you have the original uploads on disk, choose **Choose existing files folder** and select an enclosing folder. The exporter can reuse an eligible original with the exact filename and expected byte size, after checking for service-error content. Folder access requires your selection; the extension cannot search arbitrary folders without it.

Attachment scope covers supported document, text, data and source-code files up to 10 MB. Images, audio and video are excluded from this pass. Deleted or unavailable server files can only be recovered if a usable original exists locally or becomes available from ChatGPT.

## Backup contents

| Path | Contents |
| --- | --- |
| `json/<conversation>.json` | Full retrieved conversation payload, including available branches |
| `markdown/<conversation>.md` | Readable selected branch |
| `attachments/<conversation>/...` | Eligible attachments successfully recovered |
| `attachment-errors/<conversation>/...` | Preserved error responses from earlier false attachment saves |
| `conversation-index.json` | Conversation metadata, hashes, revisions, classification and attachment results |
| `export-report.json` | Discovery, progress, pacing and error details |
| `portable-state.json` | Portable queue, discovery, schedule and pacing state |

Changed conversations update their existing JSON/Markdown basenames and record revision metadata. Valid existing JSON is reused before another conversation request. Rate limits checkpoint progress and retain the server cooldown; file-specific failures yield to other work.

To move a backup to another installation, copy the whole backup folder, connect to the same account/workspace, select that folder, and import `portable-state.json`. Portable state contains queue metadata rather than full conversation bodies; the copied JSON files provide those bodies. Preserve a copy of your backup before uninstalling or clearing browser data.

## ChatGPT Library

Leave **Auto backup** enabled in the Library panel. Library discovery and file work run after ready chat work; **Scan Library / resume** starts a scan or resumes its saved queue. Folder/list pagination and error states remain in portable state. Library inventory refreshes every three hours while the passive watcher is enabled. Library failures do not convert saved transcripts into failed chats.

The Library limit uses decimal MB: **strictly less than 10,000,000 bytes**. Known larger files are listed immediately; unknown-size streams are bounded and stopped when they exceed the limit. This differs from the older document-attachment feature's inclusive 10 MiB limit. Large files are never automatically downloaded by the Library worker.

Use **10 MB or larger** to filter the dashboard, or **Save manual-download list** for a portable HTML list. Open the listed Library folder/source chat, find the filename and ID, and download it through ChatGPT. The manual list also records unavailable and permission-limited files for inspection. It opens ChatGPT pages rather than retaining expiring signed download URLs. Scanning supports known Library nodes and the Library query route; an unfamiliar response, repeated page or early end is reported as incomplete.

Saved files use `attachments/library/<stable-file-id>/<original-name>`, so identical filenames do not overwrite one another. Matching existing small files are reused where size/name and uniqueness permit it. **Retry unavailable files** explicitly reopens unavailable/transient file work; known files at the size boundary remain manual.

| Output | Purpose |
| --- | --- |
| `attachments/library-index.json` | Versioned file IDs, names, byte sizes, status, relative paths, SHA-256 and source chat IDs |
| `attachments/library-catalog.html` | Offline all-file catalog with links to saved files |
| `attachments/manual-downloads.html` / `.json` | Manual/unfinished items and links to their ChatGPT folder/source |
| `viewer-handoff.json` | Conversation source paths, linked files and Library inventory for viewer integration |

## Offline viewer interoperability

Point your **kitomisaitichi-design/chatgpt-viewer** at the complete backup folder, keeping `conversation-index.json`, `json/`, `markdown/` and `attachments/` together. Existing native conversation JSON, branches, IDs, timestamps, classifications and basenames keep their format. The conversation index attaches Library files where a source conversation ID is available. Unlinked Library files stay in the file catalog; they are not invented conversations.

Viewer 1.1.4 reads the native conversation index and Library file catalog together. Use its Files & Library panel to browse local files and import manual downloads. The saved HTML catalogs remain available without the Viewer. The cached-chat ZIP remains a transcript export; compress the full backup folder to include Library binaries.

## Activity controls

Filter messages by search text, severity or category. **Pause log display** freezes only the displayed events; backups continue. Scrolling away from the bottom turns following off; **Jump to latest** resumes it. **Clear view** hides earlier events without deleting queue history, and **Show all / reset** restores them. Copy/TXT exports use the visible filter; full JSON exports use the retained history. Filters/follow preferences persist in the extension.

## Privacy and limits

The extension has no external analytics or upload backend. Authentication stays in the signed-in ChatGPT page; bearer tokens are not stored in the extension's IndexedDB or exported state. Backups and portable state contain private conversation information, so keep them separate from public source repositories and release uploads.

Discovery depends on the conversations exposed by the enabled ChatGPT website routes. Those private endpoints can change. Completion means the enabled routes reached their end and exposed conversations were handled; it cannot prove the existence or recovery of chats the service never exposed. Sign-in challenges, changed accounts/workspaces, folder permissions and quota failures may require user action.

## Validation

All **54 exporter regression tests** and **162 Viewer backend tests** passed. Runtime syntax and package checks passed. Isolated Microsoft Edge 154 integration verified small-file download and hashing, exact 10 MB manual handling, Stop/resume during chunk transfer, real exporter catalog ingestion, a manual file import, byte-identical saved-file download, source-chat navigation, selected-chat filtering and activity controls. Simulated response tests also cover nested folders, pagination, transient retries, sparse observations, oversize streams, catalog batching and missing saved-copy repair. Live-account Library/API compatibility remains unverified.

## License and attribution

Repository code is distributed under the MIT license in the repository root. Bundled third-party components retain their own notices and licenses. See `THIRD-PARTY-NOTICES.md` and `licenses/` inside the extension folder for upstream references and JSZip notices.
