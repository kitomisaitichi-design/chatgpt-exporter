# Complete feature guide

Exporter 2.4.18 · [Install and quick start](../README.md#install-in-edge) · [Every version](HISTORY.md) · [Validation](VALIDATION.md)

## Functionality at a glance

| Area | Current functionality |
| --- | --- |
| Conversation discovery | Active, archived and project chats; bounded recent checks and full scheduled scans; manual chat links/IDs; adaptive interleaving, bounded index warm-up and index-only workflows. |
| Conversation backup | Native JSON and readable Markdown, oldest-first processing, content fingerprints, revision metadata, consistent transcript filenames, local cache/disk reuse, and truthful incomplete/error reporting. |
| Passive watching | Completed-reply and body-change detection, recent metadata checks, fixed full-scan deadlines, adaptive quiet intervals, persisted schedule, watcher health, Stop/Start and reload recovery while Edge/dashboard/ChatGPT stay open. |
| File downloads | Uploaded and generated files exposed by ChatGPT; chat attachments and owned Library folders; linked native IDs, bounded route fallbacks, checked byte sizes, error-envelope rejection, and chunked Stop/hold support. |
| Size and images | New automatic transfers strictly under decimal 10 MB; searchable manual lists for larger, connected or unavailable files; persisted image download toggle for both sources. |
| Deduplication and versions | SHA-256 content sharing across names/IDs, identity reuse before downloading, automatic bounded background linking, manual Deduplicate & smart scan for redundant-copy removal, numbered-copy families, date/revision evidence, size-only review suggestions, and retention of distinct content. |
| Independent source history | Separate chat/Library presence, retained chat-only files, unavailable-chat records, missing Library items after complete scans, earlier verified versions, source names/links, and source filters. Missing references never remove saved copies. |
| Download memory | Two failed file transfers shared by linked references, persistent parking, per-file or grouped explicit Retry, and no failure charge for server cooldowns or Stop. |
| Viewer integration | Current Offline Chat Viewer 1.1.27; versioned relative-path catalogs, shared files and retained history, source-chat navigation, chat Files/text previews, and manual downloaded-copy import. Latest Viewer download link stays current. |
| Controls and activity | Connect/folder readiness, Start/Stop, Hold/Resume, fair queue turns, active work/reason/growth/stall display, cached dashboard rendering, live six-minute activity toggle/countdown, file status cards, list/grid, search/sort/page sizes, full pagination, detailed routes, and log search/level/category/pause/follow/reset/copy/TXT/JSON controls. |
| Recovery and portability | Same-folder queue/cache upgrades, account/workspace checks, disk-index reconciliation, portable-state import/export, cached transcript ZIP, adaptive pacing, offline waits, incomplete discovery repair and optional one-shot difficult-chat recovery. |
| Local storage | Selected backup root, optional permitted existing-file folder, JSON/Markdown/binaries/catalogs/reports/portable checkpoints; no developer API key or external export service required. |

The sections below explain the controls and their limits. **Current behavior takes precedence over historical release descriptions**: for example, all new automatic file transfers now share the strict decimal 10 MB limit, and unrelated local filename/size matches require a matching reported hash.

## One file, independent chat and Library references

A chat attachment and a Library item can refer to **the same uploaded or generated file**. The exporter now links native file IDs and Library IDs before downloading, checks the saved copy's real SHA-256 and size, and reuses that copy across both sources even when the names differ. Different IDs can still share content after verified hash equality. Names and byte sizes alone never establish equality.

Each file retains separate chat and Library source records in portable state and the existing Viewer catalogs. A complete, supported Library scan can mark a source **not seen**; a refreshed chat body can mark an attachment reference **not seen**; a chat returning 404/410 is recorded as currently unavailable. Incomplete scans and stale repeated browser observations cannot establish disappearance. These states retain saved copies, names and source-chat links. They do not assert that ChatGPT permanently deleted the underlying file.

If one download route fails, the exporter tries bounded native file and conversation attachment routes with available source contexts. Failure attempts are shared by the linked file: **two failed transfer attempts**, then parking until explicit Retry. Cooldowns and Stop do not spend that budget. Chat-only retained records stay in the file workspace and Viewer catalog even if their current chat reference is removed. Library records remain when their chat is unavailable. Earlier verified versions stay separately cataloged when metadata/content changes.

New automatic transfers from either source are **strictly below 10,000,000 bytes**. Larger files stay on the manual list, including chat-only files. Previously saved eligible legacy copies remain available. **Download images** applies to both sources. Use **Chat + Library**, **Chat attachments**, or **Retained source history** to inspect coverage; Details includes source names and disappearance explanations.

[OpenAI's Library documentation](https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt) confirms that uploaded and created files can be saved in Library, and deleting a chat does not delete its Library files. It does not guarantee that deleting a Library file leaves its chat download usable. Recovery always depends on an accessible server route or a verified local copy.

## Smart file reuse and version scan

Different filenames and file IDs can share **one verified local copy**. New downloads are hashed with SHA-256 before saving. A matching saved hash reuses its existing relative path and keeps every original name, ID and source-chat link in the catalogs. If the Library supplies a SHA-256, the exporter checks the local bytes and can skip the network transfer entirely. A verified saved copy with the same native file ID can also avoid a transfer. Otherwise, without a remote hash, a previously unseen file must be read once to establish its content; equal name, size or `(1)` / `(2)` suffixes never prove equality.

Use **Deduplicate & smart scan** while the worker is stopped to hash existing saved Library and chat attachments. The control publishes all updated file/chat references before removing any redundant physical copy, verifies both copies again, and retains a removal journal across interruption. Only exact verified duplicates are removed. Files with errors or conflicting hashes remain for inspection. Local reads are bounded to the existing 10 MiB attachment limit and run one file at a time.

The Library automatically groups same-folder names such as `Report.txt`, `Report (1).txt` and `Report (2).txt`, plus explicit `v2` / `rev3` revisions. **Preferred version** uses comparable reported modification dates first, upload / creation dates second, and explicit revision numbers third. **Larger · review** is a weaker size-only suggestion; a numbered browser copy is never treated as proof of supersession. Missing or tied metadata produces a review label. Distinct content is retained, including an older, larger or smaller version. Backup write dates are not treated as source modification dates.

Use **Download images** to choose image downloads for both Library files and chat attachments. It is on by default, persists across reloads and portable-state restores, and leaves existing saved images intact when off. Skipped images remain listed for manual access. Turning it on queues an attachment pass from saved conversation JSON and resumes eligible Library images. Known image names/MIME types are excluded before requests; image download-link metadata or response headers also stop opaque images before their bodies are consumed. The Library's strict 10 MB boundary still applies.

Filters include **Chat + Library**, **Chat attachments**, **Retained source history**, **Identical content**, **Version families**, **Preferred versions** and **Images excluded**. File details explain the evidence, source dates and shared path. The summary counts unique local copies rather than counting alias sizes repeatedly.

## How work is prioritised

**Smart adaptive** gives chat text, chat discovery, attachment batches, Library work, recent checks and local validation bounded turns. Newly changed chats can take two urgent turns; captured chat bodies can take four local turns. Other ready queues keep their place. **Balanced** omits the brief chat-index warm-up. **Index only** downloads neither transcripts nor files. Existing index-first settings become Smart adaptive without resetting saved state.

Library downloads begin during discovery. Fresh small inventories get at most two pages or 30 seconds of warm-up. Existing substantial inventories, or at least half of a substantial observed high-water count, can start downloads immediately. Active discovery targets **one download per four Library page turns (about 20%)**. If new file IDs stay below **2% of the observed high-water count over three rolling minutes**, it targets **four downloads per page (about 80%)**. A ready file also gets a turn after a minute without a file attempt. The high-water count is local observed inventory, not proof of the total available in ChatGPT; these percentages describe Library operations, not bandwidth.

Small files usually go first; every fourth file turn favours the oldest waiting record. Uploaded, generated, retained chat files and images share file identity, hash reuse and failure memory. **Download images** controls images from both sources. Each chat attachment pass handles at most **25 records and one new transfer attempt**, preserves its cursor, and yields to other queues. Batch yields spend no failure attempts and resume without a six-hour penalty. Owned folders rotate by last page time; local validation handles one copy between productive turns and coalesces matching path/size/hash expectations.

The overview shows **what is running and why**, queued chats/attachment passes, rolling discovery growth and the current 20%/80% target. Network wait reasons remain visible. While running, ten minutes without new file saves or any completed work produces a progress notice; it never clears parked failures or bypasses server waits. Pause/hold, streaming, the activity toggle, offline state and real cooldowns still apply.

Jobs checkpoint to IndexedDB after each operation. Full reports, catalogs and portable JSON batch at a 15-second target while running and flush on completion/pause or explicit actions. Keep the dashboard open; a hard crash may leave those exported snapshots briefly behind the durable local queue. Safe deduplication still publishes its changed references before deleting verified duplicates.

## How Passive watcher works

Keep **Edge, the exporter dashboard and its connected signed-in ChatGPT tab open**, with the computer awake. The dashboard can remain in the background. Closing it, stopping the watcher, closing Edge, or putting the computer to sleep stops active processing.

| Check | Default or options | Coverage |
| --- | --- | --- |
| Recent server metadata | 5 minutes; optional 15 or 30 minutes | First updated-order page of active chats, enabled archived chats, project previews, and one rotating known project |
| Full traversal | Selected 2, 3, 6 or 12 hours | Enabled discovery sources beyond the recent pages |
| Observed ChatGPT tabs | While connected | New links, changed loaded bodies and completed native replies |
| Dashboard alarm | 1 minute | Nudges the open dashboard; it does not independently export chats |

Recent checks are bounded checks. The full traversal provides broader discovery coverage. The five-minute setting is a target interval: active streaming, enabled user-yield behavior, browser sleep and actual server cooldowns can delay network requests. When **Pause network work while I use ChatGPT** is On, user-yield waits for six quiet minutes before new network work. Its checkbox remains available during a run, displays the remaining quiet time, and persists across reloads. Switching it Off releases the activity wait; genuine server cooldowns and streaming still delay new requests. Fresh conversation bodies already captured from ChatGPT can be saved locally during a cooldown.

Use the watcher health text to distinguish an active watcher from one waiting on network permission, user activity or rate limits. **Stop passive watch** suspends automatic wakeups; **Start / resume** reactivates them. **Rescan chats** requests a new discovery pass. Reopening an active saved watcher reconnects while preserving its queue and cooldown.

## Repair tiny or missing attachments

Windows may display a tiny service-error response as “1 KB.” A JSON response such as `GetDownloadLinkError/file_not_found` contains no original document bytes. The exporter validates downloads and saved files before counting them as successful attachments.

After updating, select the existing backup folder and resume. Upgrade validation uses the saved conversation JSON. **Repair attachment backup** explicitly reopens failed/unavailable attachment work. Valid saved files and existing transcripts are reused; missing or invalid attachment bytes are retried through the available routes.

Known error files are preserved for inspection under `attachment-errors/<conversation>/<filename>.error-response.json` before their false document entries are removed from `attachments`. Successful retrieval saves actual bytes in a verified shared-content location. Files still unavailable remain reported as unavailable or deferred.

If you have the original uploads on disk, choose **Choose existing files folder** and select an enclosing folder. For unrelated local files, the exporter requires a reported SHA-256 matching the actual bytes, along with any expected size, before reuse. Saved backup references with a matching native file ID are verified separately. A filename and size match alone cannot prove that an original is the correct file. Folder access requires your selection; the extension cannot search arbitrary folders without it.

Attachment scope covers supported document, text, data, source-code files and optional images. New automatic transfers must be strictly below decimal 10 MB; saved legacy copies are locally checked within the earlier inclusive 10 MiB bound. Audio and video are excluded from the chat attachment pass. Deleted or unavailable server files can only be recovered if a usable original exists locally or becomes available from ChatGPT.

## Backup contents

| Path | Contents |
| --- | --- |
| `json/<conversation>.json` | Full retrieved conversation payload, including available branches |
| `markdown/<conversation>.md` | Readable selected branch |
| `attachments/content/<sha256>/<compact-name>` | New verified binaries; identical files share a path while catalogs retain their names |
| `attachments/<conversation>/...` / `attachments/library/<id>/...` | Retained legacy paths for existing saved files |
| `attachment-errors/<conversation>/...` | Preserved error responses from earlier false attachment saves |
| `conversation-index.json` | Conversation metadata, hashes, revisions, classification and attachment results |
| `export-report.json` | Discovery, progress, pacing and error details |
| `portable-state.json` | Portable queue, discovery, schedule and pacing state |

Changed conversations update their existing JSON/Markdown basenames and record revision metadata. Valid existing JSON is reused before another conversation request. Rate limits checkpoint progress and retain the server cooldown; file-specific failures yield to other work.

To move a backup to another installation, copy the whole backup folder, connect to the same account/workspace, select that folder, and import `portable-state.json`. Portable state contains queue metadata rather than full conversation bodies; the copied JSON files provide those bodies. Preserve a copy of your backup before uninstalling or clearing browser data.

## ChatGPT Library

Leave **Auto-save** enabled in the Library panel. Library discovery and downloads interleave with chat text, bounded attachment passes and validation; **Scan Library / resume** starts a scan or resumes its saved queue. Folder/list pagination and error states remain in portable state. Library inventory refreshes every three hours while the passive watcher is enabled. Library failures do not convert saved transcripts into failed chats.

The Library limit uses decimal MB: **strictly less than 10,000,000 bytes**. Known larger files are listed immediately; unknown-size streams are bounded and stopped when they exceed the limit. The same boundary now applies to new chat attachment transfers. Existing eligible legacy copies remain available. Large files are listed for manual access.

Use **Manual downloads** to filter the dashboard, or **Manual-download list** for a portable HTML list. Open the listed Library folder/source chat, find the filename and ID, and download it through ChatGPT. The manual list also records unavailable and permission-limited files for inspection. It opens ChatGPT pages rather than retaining expiring signed download URLs. Scanning supports known Library nodes and the Library query route; an unfamiliar response, repeated page or early end is reported as incomplete.

New binaries use `attachments/content/<sha256>/<compact-name>`, so different content never overwrites a shared earlier version. Existing valid paths are retained. Library reuse of an unrelated local name/size match requires a reported SHA-256 as well. Saved paths and hashes are verified before a transfer is suppressed. **Retry this file** releases one parked file. **Retry parked files** releases parked/unavailable files together. Both reset that file’s two-attempt budget explicitly; ordinary resumes and scans preserve it. Known files at the size boundary remain manual. Cooldowns defer the queue without counting as failed file transfers.

| Output | Purpose |
| --- | --- |
| `attachments/library-index.json` | Versioned file IDs, names, source dates, status, failure counts, paths, SHA-256, alias/version evidence, image preference and source chat IDs |
| `attachments/library-catalog.html` | Offline all-file catalog with links to saved files |
| `attachments/manual-downloads.html` / `.json` | Manual/unfinished items and links to their ChatGPT folder/source |
| `viewer-handoff.json` | Conversation source paths, linked files and Library inventory for viewer integration |

## Offline viewer interoperability

Point your **kitomisaitichi-design/chatgpt-viewer** at the complete backup folder, keeping `conversation-index.json`, `json/`, `markdown/` and `attachments/` together. Existing native conversation JSON, branches, IDs, timestamps, classifications and basenames keep their format. The conversation index attaches Library files where a source conversation ID is available. Unlinked Library files stay in the file catalog; they are not invented conversations.

Exporter 2.4.18 retains the `chatgpt-conversation-index/v1`, `chatgpt-library-index/v1` and `chatgpt-exporter-viewer/v1` catalog formats. Hash-alias, version-evidence, image-preference, native-file-ID and independent source-reference fields are additive. Historical versions have separate catalog identities so Viewer retains distinct bytes. Viewer 1.1.6 retains the file catalog reader and uses each catalog entry's relative file path, so it supports both retained legacy paths and `attachments/content/<sha256>/<compact-name>` shared copies.

| Exporter feature | Viewer behavior |
| --- | --- |
| Identical content under different names / IDs | Catalog entries retain their names, IDs and chat links while opening the same saved binary. |
| Deduplicate & smart scan | Updated conversation and Library catalogs point to the surviving verified copy before redundant bytes are removed. Reopen Files & Library to refresh the catalog. |
| Different file versions | Distinct content remains available as separate files. Preferred-version evidence and filters are presented in the exporter. |
| Download images switched off | Already saved images remain available; excluded images remain cataloged for manual access. Enabling downloads resumes eligible images. |
| Files at or above 10 MB | Download through the listed ChatGPT link, then use **Import downloaded copy** in the Viewer. Saved file downloads and source-chat navigation use the existing Viewer workflow. |

Keep the complete backup together: the Viewer needs the indexes and actual `attachments/` binaries. The cached-chat ZIP contains transcripts and metadata; compress the complete backup folder when transferring files between computers. Historical isolated exporter-to-Viewer checks ran against **Viewer 1.1.6**, release commit `5e2ff2c849f94824fb234b6f8c1232750139f12c`. They verify catalog loading, retained chat-only files after source disappearance, saved byte downloads, source-chat navigation, the current chat Files panel and text previews, and manual 10 MB imports without rebuilding message indexes.

The current Viewer reads the native conversation index and Library file catalog together. Its chat Files control adds text/image previews and original-path access; its Library control retains manual downloaded-copy imports. Use its Files & Library panel to browse local files and import manual downloads. The saved HTML catalogs remain available without the Viewer. The cached-chat ZIP remains a transcript export; compress the full backup folder to include Library binaries.

## Activity controls

Filter messages by search text, severity or category. **Pause log display** freezes only the displayed events; backups continue. Scrolling away from the bottom turns following off; **Jump to latest** resumes it. **Clear view** hides earlier events without deleting queue history, and **Show all / reset** restores them. Copy/TXT exports use the visible filter; full JSON exports use the retained history. Filters/follow preferences persist in the extension. Retained history is capped at 1,500 events; full JSON means all retained events, not an unlimited audit trail.

## Privacy and limits

The extension has no external analytics or upload backend. Scheduled release checks contact GitHub for public release metadata; optional installation also downloads official release assets. Neither request sends your chats or backup files. Authentication stays in the signed-in ChatGPT page; bearer tokens are not stored in the extension's IndexedDB or exported state. Backups and portable state contain private conversation information, so keep them separate from public source repositories and release uploads.

Discovery depends on the conversations exposed by the enabled ChatGPT website routes. Those private endpoints can change. Completion means the enabled routes reached their end and exposed conversations were handled; it cannot prove the existence or recovery of chats the service never exposed. Sign-in challenges, changed accounts/workspaces, folder permissions and quota failures may require user action.

## Incremental local search and background linking

Both folder selectors inspect the selected folder and supported nested backups. Remembered grants and prior indexes are hints, scoped to the connected account/workspace. Choose a parent containing older exports to reuse those copies. The extension cannot silently search all Documents, Downloads, Desktop, browser downloads or Windows Search without a granted folder. Folder-root detection is bounded to depth 4 / 400 directories; file walks to depth 12 / 50,000 files / 5,000 directories.

Shared SHA-256, native-ID, path and size lookups keep one live index per scope/folder generation. Concurrent requests share a build. Downloads add records directly; unchanged candidates are classified once instead of reopening every same-size candidate for every file. Dirty records flush at 250 records or two seconds, plus safe lifecycle checkpoints. Persisted fingerprints require verification on first reuse after reopening. Rescan refreshes metadata while retaining valid session fingerprints.

Background maintenance hashes one file per turn, allows at most two metadata reads, yields metadata processing after 8 ms, and runs one turn per ten productive operations or during idle/cooldown time. Foreground work takes priority; Hold/Stop suspend maintenance. Repeated triggers coalesce and completed verification wakes affected lookups. Automatic linking changes references to verified identical bytes; physical duplicate removal remains manual. Names, size, dates and sampled fingerprints never prove equality.

Saved chats count actual valid transcript bodies reconciled with the queue. Index-only links and cached bodies not yet written are separate. Large portable-state files use a bounded 64 KiB identity header; individual transcript JSON over 64 MiB is skipped. Permission, quota and database failures visibly pause without spending remote transfer attempts. Moved or deleted local candidates are invalidated rather than blocking unrelated files.

## Release checks and optional silent installation

**Extension updates** is separate from chat discovery and Passive watcher. Choose 12 hours, **24 hours by default**, weekly or off. Check now works with off. The background worker checks the official GitHub latest release, shares overlapping requests, caches its ETag and reports the last successful check, next check and errors. Network failures retain the last known release and retry after at most an hour while scheduling is enabled. No browser notification permission is requested: the dashboard displays the notice and release link.

**Install automatically when idle** is optional and **off by default**. Choose installation folder once and grant write access to the exact loaded unpacked extension folder. Keep the dashboard open. Installation waits until backup, detection, connection and local maintenance are inactive; a held run stays held. It downloads bounded official ZIP/checksum assets, validates the archive and manifest, checks existing managed files against their original release, snapshots overwritten files under .exporter-rollback, writes the manifest last, verifies bytes and reloads only after commit. An interrupted transaction is restored when the dashboard reopens.

Extra local files are retained. Modified managed files—including optional Viewer adapters—defer silent installation and show a manual-update instruction; automatic merging is not attempted. An expired grant, unavailable baseline release, checksum mismatch or conflicting local file also leaves installation deferred. Fix the cause and choose the folder again to retry, or install manually. Disabling silent installation during replacement restores the previous files. Off stops scheduled discovery of new releases; a release already found or found with Check now can still install if the separate silent-install switch is enabled.

Rollback: stop backup, close Edge, copy the retained rollback files over the extension folder and reload the same extension card. Keep the extension folder and identity stable to preserve IndexedDB; never clear browser storage as an update step. Rollback snapshots contain runtime code, not your chat archive. The cached-chat ZIP exports JSON, Markdown, report, conversation index and portable state; it excludes attachment binaries and Library catalogs. Compress the complete backup folder to transfer everything.

