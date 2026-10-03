# ChatGPT Exporter — English Autopilot for Microsoft Edge

**Version 2.4.3 · October 2, 2026**

Build a local backup of the conversations available to your signed-in ChatGPT web session. The extension discovers active, archived and project chats, writes conversation JSON and readable Markdown, tracks revisions, and backs up eligible attachments. Your backup stays in the folder you select.

[Download v2.4.3](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.3) · [All releases](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases) · [Source code](https://github.com/kitomisaitichi-design/chatgpt-exporter/tree/main/ChatGPT-Exporter-English-Edge)

**Viewer compatibility:** Exporter **2.4.3 remains interoperable with [Offline Chat Viewer 1.1.4](https://github.com/kitomisaitichi-design/chatgpt-viewer/releases/tag/v1.1.4)**, including the new shared-content file layout. Select the complete backup root in the Viewer and open **Files & Library**.

## Smart file reuse and version scan

Different filenames and file IDs can share **one verified local copy**. New downloads are hashed with SHA-256 before saving. A matching saved hash reuses its existing relative path and keeps every original name, ID and source-chat link in the catalogs. If the Library supplies a SHA-256, the exporter checks the local bytes and can skip the network transfer entirely. Without a remote hash, a previously unseen file must be read once to establish its content; equal name, size or `(1)` / `(2)` suffixes never prove equality.

Use **Deduplicate & smart scan** while the worker is stopped to hash existing saved Library and chat attachments. The control publishes all updated file/chat references before removing any redundant physical copy, verifies both copies again, and retains a removal journal across interruption. Only exact verified duplicates are removed. Files with errors or conflicting hashes remain for inspection. Local reads are bounded to the existing 10 MiB attachment limit and run one file at a time.

The Library automatically groups same-folder names such as `Report.txt`, `Report (1).txt` and `Report (2).txt`, plus explicit `v2` / `rev3` revisions. **Preferred version** uses comparable reported modification dates first, upload / creation dates second, and explicit revision numbers third. **Larger · review** is a weaker size-only suggestion; a numbered browser copy is never treated as proof of supersession. Missing or tied metadata produces a review label. Distinct content is retained, including an older, larger or smaller version. Backup write dates are not treated as source modification dates.

Use **Download images** to choose image downloads for both Library files and chat attachments. It is on by default, persists across reloads and portable-state restores, and leaves existing saved images intact when off. Skipped images remain listed for manual access. Turning it on queues an attachment pass from saved conversation JSON and resumes eligible Library images. Known image names/MIME types are excluded before requests; image download-link metadata or response headers also stop opaque images before their bodies are consumed. The Library's strict 10 MB boundary still applies.

Filters include **Identical content**, **Version families**, **Preferred versions** and **Images excluded**. File details explain the evidence, source dates and shared path. The summary counts unique local copies rather than counting alias sizes repeatedly.

## Library files in your Viewer

Use [Offline Chat Viewer 1.1.4](https://github.com/kitomisaitichi-design/chatgpt-viewer/releases/tag/v1.1.4), select this backup's root folder, then open **Files & Library**. It reads `conversation-index.json` and `attachments/library-index.json`, opens saved files and their source chats, and filters files for the selected conversation. For files at or above **10,000,000 bytes**, use the ChatGPT link to download them yourself, then **Import downloaded copy** in the Viewer. The Viewer copies a size-checked file into its expected backup path and keeps any existing copy. Importing a file does not rebuild message indexes.

v2.4.3 follows the native Library `cursor`, keeps scanning after unsupported entries, catalogs mounted folders without aborting owned-file discovery, and preserves `origination_thread_id` as a source-chat link. File downloads try the observed native no-query route first and retain the frontend headers observed in the signed-in tab. Each file has **two failed transfer attempts**, then stays parked across scans, metadata changes, restarts and portable-state restores until you explicitly retry it.

The Library now has a full-width workspace, four status cards, list/grid views, search, sorting, page sizes of 25/50/100/All, visible first/previous/next/last controls, route details and per-file retry. The dashboard uses a refreshed indigo/slate design with responsive layouts.

Keep the exporter dashboard and signed-in ChatGPT tab open for passive checks. Quiet recent-chat polling gradually backs off; new activity resets it. Full discovery and Library scans retain their fixed deadlines. Offline periods and cooldowns preserve the queue.

Validation: **90 exporter regression tests**. Isolated Edge integration uses native-shaped responses and hundreds of files to check pagination, folder discovery, download bytes, failure memory, per-file retry and responsive file browsing. Live ChatGPT inspection verified the current Library response shapes and a successful native download-link request. Running the updated extension end to end in the live account remains unverified because browser tooling blocks extension pages.

## What changed in v2.4.3

- Verify SHA-256 equality across names and IDs; automatically share saved content between Library and chat attachment references. Use a reported hash to avoid a transfer where available.
- Add **Deduplicate & smart scan** for existing saved files, with reference-first persistence, revalidation before redundant-copy removal, interruption recovery and an exported audit journal.
- Add version families, preferred/earlier labels, review suggestions, evidence in details and dedicated filters. Keep all distinct versions.
- Add **Download images** for Library and chat attachments, including discoverable chat image pointers, persisted preferences, manual listings and resume when enabled.
- Keep two-attempt failure parking, full Library pagination, Stop/hold, the strict Library byte limit, passive checks and Viewer 1.1.4 compatibility.

Upgrade in the **same folder** to retain the queue and cache. Saved conversation JSON is rescanned once to discover newly supported images; existing valid files and hard attachment-failure decisions are retained. Details: `CHANGELOG-v2.4.3.md`.

## Install in Edge

1. Download **ChatGPT-Exporter-English-Edge-v2.4.3.zip** from the release page. The separate `.sha256.txt` asset contains its SHA-256 checksum.
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
4. Refresh the connected ChatGPT tab, then reopen the dashboard. Connect to the same account/workspace if prompted, keep the same backup folder, retain Passive watcher, and press **Start / resume** if stopped.

Keep the same installation path and Edge profile to retain the extension identity, IndexedDB queue/cache, discovery cursors, cooldowns and directory handles. Avoid uninstalling or loading a second copy from a different path when preserving that state matters. Chat backups retain their discovery progress. Library discovery is refreshed once automatically to repair older stuck cursors; saved files and parked failures remain intact.

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

Known error files are preserved for inspection under `attachment-errors/<conversation>/<filename>.error-response.json` before their false document entries are removed from `attachments`. Successful retrieval saves actual bytes in a verified shared-content location. Files still unavailable remain reported as unavailable or deferred.

If you have the original uploads on disk, choose **Choose existing files folder** and select an enclosing folder. The exporter can reuse an eligible original with the exact filename and expected byte size, after checking for service-error content. Folder access requires your selection; the extension cannot search arbitrary folders without it.

Attachment scope covers supported document, text, data, source-code files and optional images up to the existing inclusive 10 MiB attachment limit. Audio and video are excluded from the chat attachment pass. Deleted or unavailable server files can only be recovered if a usable original exists locally or becomes available from ChatGPT.

## Backup contents

| Path | Contents |
| --- | --- |
| `json/<conversation>.json` | Full retrieved conversation payload, including available branches |
| `markdown/<conversation>.md` | Readable selected branch |
| `attachments/content/<sha256>/<first-name>` | New verified binaries; identical files share a path while catalogs retain their names |
| `attachments/<conversation>/...` / `attachments/library/<id>/...` | Retained legacy paths for existing saved files |
| `attachment-errors/<conversation>/...` | Preserved error responses from earlier false attachment saves |
| `conversation-index.json` | Conversation metadata, hashes, revisions, classification and attachment results |
| `export-report.json` | Discovery, progress, pacing and error details |
| `portable-state.json` | Portable queue, discovery, schedule and pacing state |

Changed conversations update their existing JSON/Markdown basenames and record revision metadata. Valid existing JSON is reused before another conversation request. Rate limits checkpoint progress and retain the server cooldown; file-specific failures yield to other work.

To move a backup to another installation, copy the whole backup folder, connect to the same account/workspace, select that folder, and import `portable-state.json`. Portable state contains queue metadata rather than full conversation bodies; the copied JSON files provide those bodies. Preserve a copy of your backup before uninstalling or clearing browser data.

## ChatGPT Library

Leave **Auto-save** enabled in the Library panel. Library discovery and file work run after ready chat work; **Scan Library / resume** starts a scan or resumes its saved queue. Folder/list pagination and error states remain in portable state. Library inventory refreshes every three hours while the passive watcher is enabled. Library failures do not convert saved transcripts into failed chats.

The Library limit uses decimal MB: **strictly less than 10,000,000 bytes**. Known larger files are listed immediately; unknown-size streams are bounded and stopped when they exceed the limit. This differs from the older document-attachment feature's inclusive 10 MiB limit. Large files are never automatically downloaded by the Library worker.

Use **Manual downloads** to filter the dashboard, or **Manual-download list** for a portable HTML list. Open the listed Library folder/source chat, find the filename and ID, and download it through ChatGPT. The manual list also records unavailable and permission-limited files for inspection. It opens ChatGPT pages rather than retaining expiring signed download URLs. Scanning supports known Library nodes and the Library query route; an unfamiliar response, repeated page or early end is reported as incomplete.

New binaries use `attachments/content/<sha256>/<first-name>`, so different content never overwrites a shared earlier version. Existing valid paths are retained. Library reuse of an unrelated local name/size match requires a reported SHA-256 as well. Saved paths and hashes are verified before a transfer is suppressed. **Retry this file** releases one parked file. **Retry parked files** releases parked/unavailable files together. Both reset that file’s two-attempt budget explicitly; ordinary resumes and scans preserve it. Known files at the size boundary remain manual. Cooldowns defer the queue without counting as failed file transfers.

| Output | Purpose |
| --- | --- |
| `attachments/library-index.json` | Versioned file IDs, names, source dates, status, failure counts, paths, SHA-256, alias/version evidence, image preference and source chat IDs |
| `attachments/library-catalog.html` | Offline all-file catalog with links to saved files |
| `attachments/manual-downloads.html` / `.json` | Manual/unfinished items and links to their ChatGPT folder/source |
| `viewer-handoff.json` | Conversation source paths, linked files and Library inventory for viewer integration |

## Offline viewer interoperability

Point your **kitomisaitichi-design/chatgpt-viewer** at the complete backup folder, keeping `conversation-index.json`, `json/`, `markdown/` and `attachments/` together. Existing native conversation JSON, branches, IDs, timestamps, classifications and basenames keep their format. The conversation index attaches Library files where a source conversation ID is available. Unlinked Library files stay in the file catalog; they are not invented conversations.

Exporter 2.4.3 retains the `chatgpt-conversation-index/v1`, `chatgpt-library-index/v1` and `chatgpt-exporter-viewer/v1` catalog formats. New hash-alias, version-evidence and image-preference fields are additive. Viewer 1.1.4 uses each catalog entry's relative file path, so it supports both retained legacy paths and `attachments/content/<sha256>/<first-name>` shared copies.

| Exporter feature | Behavior with Viewer 1.1.4 |
| --- | --- |
| Identical content under different names / IDs | Catalog entries retain their names, IDs and chat links while opening the same saved binary. |
| Deduplicate & smart scan | Updated conversation and Library catalogs point to the surviving verified copy before redundant bytes are removed. Reopen Files & Library to refresh the catalog. |
| Different file versions | Distinct content remains available as separate files. Preferred-version evidence and filters are presented in the exporter. |
| Download images switched off | Already saved images remain available; excluded images remain cataloged for manual access. Enabling downloads resumes eligible images. |
| Files at or above 10 MB | Download through the listed ChatGPT link, then use **Import downloaded copy** in the Viewer. Saved file downloads and source-chat navigation use the existing Viewer workflow. |

Keep the complete backup together: the Viewer needs the indexes and actual `attachments/` binaries. The cached-chat ZIP contains transcripts and metadata; compress the complete backup folder when transferring files between computers. Version 2.4.3's isolated exporter-to-Viewer check verified catalog loading, saved file bytes, source-chat navigation, selected-chat filtering and manual-file import without rebuilding chat indexes.

Viewer 1.1.4 reads the native conversation index and Library file catalog together. Use its Files & Library panel to browse local files and import manual downloads. The saved HTML catalogs remain available without the Viewer. The cached-chat ZIP remains a transcript export; compress the full backup folder to include Library binaries.

## Activity controls

Filter messages by search text, severity or category. **Pause log display** freezes only the displayed events; backups continue. Scrolling away from the bottom turns following off; **Jump to latest** resumes it. **Clear view** hides earlier events without deleting queue history, and **Show all / reset** restores them. Copy/TXT exports use the visible filter; full JSON exports use the retained history. Filters/follow preferences persist in the extension.

## Privacy and limits

The extension has no external analytics or upload backend. Authentication stays in the signed-in ChatGPT page; bearer tokens are not stored in the extension's IndexedDB or exported state. Backups and portable state contain private conversation information, so keep them separate from public source repositories and release uploads.

Discovery depends on the conversations exposed by the enabled ChatGPT website routes. Those private endpoints can change. Completion means the enabled routes reached their end and exposed conversations were handled; it cannot prove the existence or recovery of chats the service never exposed. Sign-in challenges, changed accounts/workspaces, folder permissions and quota failures may require user action.

## Validation

Isolated Edge checks cover 253-file browsing, failure memory, downloads, Viewer integration, renamed aliases, a reported-hash transfer skip, safe cleanup, image-toggle persistence and resume, and desktop/tablet/phone layouts. The updated version has not been run against the live user account.

All **90 exporter regression tests** pass, including duplicate equality, false-positive prevention, changed canonical files, catalog write failure, Stop/removal-journal recovery, version ambiguity, image extraction and image-body cancellation. Runtime syntax and package checks cover the shipped files. The native API shapes were inspected in a signed-in ChatGPT Library session; download and UI integration tests use an isolated Edge profile and synthetic files. No private account data or credentials are included in tests or releases.

## License and attribution

Repository code is distributed under the MIT license in the repository root. Bundled third-party components retain their own notices and licenses. See `THIRD-PARTY-NOTICES.md` and `licenses/` inside the extension folder for upstream references and JSZip notices.
