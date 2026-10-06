# ChatGPT Exporter — English Autopilot for Microsoft Edge

**Version 2.4.10 · October 6, 2026**

Build a local backup of the conversations available to your signed-in ChatGPT web session. The extension discovers active, archived and project chats, writes conversation JSON and readable Markdown, tracks revisions, and backs up eligible attachments. Your backup stays in the folder you select.

[Download v2.4.10](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.10) · [All releases](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases) · [Source code](https://github.com/kitomisaitichi-design/chatgpt-exporter/tree/main/ChatGPT-Exporter-English-Edge)

**Viewer compatibility:** Exporter **2.4.10 remains interoperable with [Offline Chat Viewer](https://github.com/kitomisaitichi-design/chatgpt-viewer/releases/latest)**, including the new shared-content file layout. The current release is **1.1.7**; the download link follows the latest release. Select the complete backup root in the Viewer and open **Files & Library**.

## Functionality at a glance

| Area | Current functionality |
| --- | --- |
| Conversation discovery | Active, archived and project chats; bounded recent checks and full scheduled scans; manual chat links/IDs; adaptive interleaving, bounded index warm-up and index-only workflows. |
| Conversation backup | Native JSON and readable Markdown, oldest-first processing, content fingerprints, revision metadata, consistent transcript filenames, local cache/disk reuse, and truthful incomplete/error reporting. |
| Passive watching | Completed-reply and body-change detection, recent metadata checks, fixed full-scan deadlines, adaptive quiet intervals, persisted schedule, watcher health, Stop/Start and reload recovery while Edge/dashboard/ChatGPT stay open. |
| File downloads | Uploaded and generated files exposed by ChatGPT; chat attachments and owned Library folders; linked native IDs, bounded route fallbacks, checked byte sizes, error-envelope rejection, and chunked Stop/hold support. |
| Size and images | New automatic transfers strictly under decimal 10 MB; searchable manual lists for larger, connected or unavailable files; persisted image download toggle for both sources. |
| Deduplication and versions | SHA-256 content sharing across names/IDs, identity reuse before downloading, Deduplicate & smart scan, safe redundant-copy removal, numbered-copy families, date/revision evidence, size-only review suggestions, and retention of distinct content. |
| Independent source history | Separate chat/Library presence, retained chat-only files, unavailable-chat records, missing Library items after complete scans, earlier verified versions, source names/links, and source filters. Missing references never remove saved copies. |
| Download memory | Two failed file transfers shared by linked references, persistent parking, per-file or grouped explicit Retry, and no failure charge for server cooldowns or Stop. |
| Viewer integration | Current Offline Chat Viewer 1.1.7; versioned relative-path catalogs, shared files and retained history, source-chat navigation, chat Files/text previews, and manual downloaded-copy import. Latest Viewer download link stays current. |
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

## Library files in your Viewer

Use [Offline Chat Viewer](https://github.com/kitomisaitichi-design/chatgpt-viewer/releases/latest), select this backup's root folder, then open **Files & Library**. It reads `conversation-index.json` and `attachments/library-index.json`, opens saved files and their source chats, and filters files for the selected conversation. For files at or above **10,000,000 bytes**, use the ChatGPT link to download them yourself, then **Import downloaded copy** in the Viewer. The Viewer copies a size-checked file into its expected backup path and keeps any existing copy. Importing a file does not rebuild message indexes.

v2.4.4 follows the native Library `cursor`, keeps scanning after unsupported entries, catalogs mounted folders without aborting owned-file discovery, and preserves `origination_thread_id` as a source-chat link. File downloads try the observed native no-query route first and retain the frontend headers observed in the signed-in tab. Each file has **two failed transfer attempts**, then stays parked across scans, metadata changes, restarts and portable-state restores until you explicitly retry it.

The Library now has a full-width workspace, four status cards, list/grid views, search, sorting, page sizes of 25/50/100/All, visible first/previous/next/last controls, route details and per-file retry. The dashboard uses a refreshed indigo/slate design with responsive layouts. All lists with more than 500 items use 500 rows per page to keep controls responsive; every item remains reachable through search and pagination. Search updates after 120 ms of typing quiet.

Keep the exporter dashboard and signed-in ChatGPT tab open for passive checks. Quiet recent-chat polling gradually backs off; new activity resets it. Full discovery and Library scans retain their fixed deadlines. Offline periods and cooldowns preserve the queue.

Validation: **144 exporter regression tests**. Isolated Edge integration uses native-shaped responses and hundreds of files to check pagination, folder discovery, download bytes, failure memory, per-file retry and responsive file browsing. Live ChatGPT inspection verified the current Library response shapes and a successful native download-link request. Running the updated extension end to end in the live account remains unverified because browser tooling blocks extension pages.

## How work is prioritised

**Smart adaptive** gives chat text, chat discovery, attachment batches, Library work, recent checks and local validation bounded turns. Newly changed chats can take two urgent turns; captured chat bodies can take four local turns. Other ready queues keep their place. **Balanced** omits the brief chat-index warm-up. **Index only** downloads neither transcripts nor files. Existing index-first settings become Smart adaptive without resetting saved state.

Library downloads begin during discovery. Fresh small inventories get at most two pages or 30 seconds of warm-up. Existing substantial inventories, or at least half of a substantial observed high-water count, can start downloads immediately. Active discovery targets **one download per four Library page turns (about 20%)**. If new file IDs stay below **2% of the observed high-water count over three rolling minutes**, it targets **four downloads per page (about 80%)**. A ready file also gets a turn after a minute without a file attempt. The high-water count is local observed inventory, not proof of the total available in ChatGPT; these percentages describe Library operations, not bandwidth.

Small files usually go first; every fourth file turn favours the oldest waiting record. Uploaded, generated, retained chat files and images share file identity, hash reuse and failure memory. **Download images** controls images from both sources. Each chat attachment pass handles at most **25 records and one new transfer attempt**, preserves its cursor, and yields to other queues. Batch yields spend no failure attempts and resume without a six-hour penalty. Owned folders rotate by last page time; local validation handles one copy between productive turns and coalesces matching path/size/hash expectations.

The overview shows **what is running and why**, queued chats/attachment passes, rolling discovery growth and the current 20%/80% target. Network wait reasons remain visible. While running, ten minutes without new file saves or any completed work produces a progress notice; it never clears parked failures or bypasses server waits. Pause/hold, streaming, the activity toggle, offline state and real cooldowns still apply.

Jobs checkpoint to IndexedDB after each operation. Full reports, catalogs and portable JSON batch at a 15-second target while running and flush on completion/pause or explicit actions. Keep the dashboard open; a hard crash may leave those exported snapshots briefly behind the durable local queue. Safe deduplication still publishes its changed references before deleting verified duplicates.

## What changed in v2.4.10

**Both folder controls recover existing chats.** Existing files folder and remembered permitted locations now contribute JSON transcripts as well as binary files. A chat stored only there can be copied locally into your backup. New queue IDs invalidate the in-memory search, while persisted fingerprints avoid parsing unchanged files again. All 2.4.9 recovery safeguards remain.

155 regressions pass. Isolated Edge confirms both folder controls independently, zero downloads for local recovery, exactly one write per queued body on double Start, empty input and refresh, Library behavior and the 10,000-file performance fixture. Live account resume and full Viewer 1.1.7 import were not rerun. [Full notes](CHANGELOG-v2.4.10.md).

## What changed in v2.4.9

**Existing chats are recovered locally before network work.** Local file/index timestamps no longer masquerade as server changes. Verified bodies repair stale timestamp refresh flags; genuinely newer replies and interrupted revisions stay protected. A stale disk body cannot overwrite a newer pending version. Double Start creates one worker.

Selecting an older backup now searches for the matching backup nested inside it before rejecting its scope. The original picked parent stays available for search. Same-user older backups contribute bodies only for conversation IDs already in your current queue; unrelated chats, account job state and discovery cursors stay separate. Matching bodies outside the current root are **copied locally** into its JSON/Markdown layout, preserving the original files. The personal account selector uses a workspace UUID only when ChatGPT's native requests observed it under that selector.

An on-device transcript search index persists across reloads. Unchanged files reuse their parsed fingerprints only after same-handle, size and modification-time checks; changed files and newly discovered IDs invalidate the appropriate matches. Overlapping roots skip previously scanned subtrees. Scan results show reused fingerprints and skipped foreign sources. New location grants still require the browser picker.

155 regression tests and isolated Edge checks pass, including empty input, exactly one write per queued body on double Start, refresh, nested parents, renamed files, Library failure memory and pagination. The read-only check of the reported nested backups found 712 matching bodies, queued 673 local rewrites and kept five matching IDs for fresh checking. A warm local harness scan took about 0.28 seconds versus 15.8 seconds cold; live browser timings may differ. Live account resume and a fresh full Viewer 1.1.7 import were not run. Existing Viewer schemas remain unchanged. See [full notes](CHANGELOG-v2.4.9.md).

To apply: reload the existing extension card in `edge://extensions`, refresh ChatGPT, reconnect, choose the outer existing backup folder and use **Rescan local folders → Resume backup**. Retain both old and nested backup folders.

## What changed in v2.4.8

Selecting an existing backup reuses its root instead of creating another backup inside it. Selecting a parent finds matching renamed/nested backups. Recursive transcript detection reads JSON contents, supports nested canonical JSON and official conversation arrays, and credits validated local bodies before Start. Other layouts queue local rewrites into the normal JSON/Markdown layout; source files remain intact. Matching portable state and indexes restore missing metadata without overwriting newer live failures or cursors.

**Local detection & search** shows found bodies, index-only links, local rewrite work, browser-cache bodies, eligible file copies, large files and scan limits. **Rescan local folders** rebuilds the index. The shared picker shortcut opens **Downloads, Documents, Desktop or the last location**. Up to eight selected locations and a file-search index are remembered per workspace. Only currently permitted handles are searched; the browser still requires a picker/grant for a new location. Selecting a subfolder cannot grant its parent or siblings automatically.

Local retrieval uses prior conversation/Library indexes (including nested ones), native file IDs, content-addressed paths, normalized names and verified SHA-256. An expected hash also searches same-size candidates under different names. Copies are verified before reuse; a filename/size match alone never credits a file. Pending chat and Library files share this local search. Files at/above 10 MB are counted for manual handling, image choices and parked failures remain respected. The index stores handles/metadata locally; it is excluded from exported backup state.

Searches yield between directory batches. Each selected-source transcript/file walk is bounded to 12 levels, 50,000 files and 5,000 directories; root discovery checks up to four levels/400 directories. Transcript/index JSON parsing is limited to 64 MB (direct legacy-root probing 32 MB); limits and oversized transcript files are reported. Rename and native-ID hints never bypass content verification. Full-machine search, other browser profiles and ungranted locations are outside browser file access.

144 regressions pass. Isolated Edge checks cover root/parent selection, immediate counts, nested indexes, renamed local copies, reload/rescan persistence, Library scheduling and 10,000-file dashboard performance. The current Viewer release is 1.1.7; the existing exported schemas remain compatible. Historical Viewer 1.1.6 fixture results below retain their actual tested version. Details: `CHANGELOG-v2.4.8.md`.

## What changed in v2.4.7

Fixes the immediate restart pause `Cannot read properties of null (reading 'localeCompare')`. Retained chat attachments can legitimately lack native file IDs. Queue sorting now uses their existing source keys as a fallback, and duplicate analysis, catalog ordering and Library display sorting tolerate missing labels or statuses. Native IDs, saved paths, hashes, attempts and source history are preserved; no backup reset is required. Details: `CHANGELOG-v2.4.7.md`.

## What changed in v2.4.6

Ready files now download before complete Library discovery; continuing chats, attachment passes and saved-copy validation cannot monopolise the file phase. Growth-based 20%/80% Library turns, bounded restartable attachment batches, folder rotation and periodic old-file turns keep progress moving. The dashboard explains the queue and waits; full reports batch during runs while job checkpoints remain per operation. Details: `CHANGELOG-v2.4.6.md`.

## What changed in v2.4.5

Large backups now use indexed file joins and shared failure lookups, cached file/statistics models, reused duplicate/version analysis, coalesced progress rendering and unchanged-log skips. The dashboard avoids regenerating the export catalog on each timer tick. Unchanged rows keep their DOM and expanded Details; changed rows preserve expanded Details by file identity. Large All lists use 500 rows per page.

**Pause network work while I use ChatGPT** now loads its actual saved value and works during a run. Its status shows On/Off and remaining quiet time. Switching it off wakes the activity wait within the worker's one-second tick; other network conditions still apply. The setting saves without an image scan or a full backup-report rewrite. In-flight transfers finish their current operation; the policy governs new reads.

Isolated Edge checks used **10,000 files, 5,000 chats and 1,500 log events**. Queue selection took about 74 ms, 120 unchanged file/log updates about 0.3 ms, and activity-toggle feedback about 132 ms on the test machine. Actual performance depends on the backup and computer. The active-run toggle, persistence, downloads and current Viewer 1.1.6 integration passed; live-account behavior remains unverified. Details: `CHANGELOG-v2.4.5.md`.

## What changed in v2.4.4

- Link chat and Library references by native identity before transfer; immediately register successful content so another file in the same pass can share its hash.
- Retain independent source presence, removed chat references, unavailable chats, and previous verified file versions in portable state and Viewer catalogs.
- Combine bounded download routes and share the two-failure budget. Retrying a linked file releases its matching unsaved references together.
- Prevent stale passive Library observations from undoing a complete scan's source history. Align new automatic chat/Library transfers to the strict decimal 10 MB boundary.
- Add source filters, source names and history explanations; require a reported hash for unrelated local filename/size reuse.
- Verify integration against the current **Viewer 1.1.6**, including retained files, its chat Files panel, text preview, downloads and manual imports.

Upgrade in the **same folder** to retain the queue and cache. Existing source records are seeded from saved Library and chat attachment metadata, including legacy failure decisions. Details: `CHANGELOG-v2.4.4.md`.

## Install in Edge

1. Download **ChatGPT-Exporter-English-Edge-v2.4.10.zip** from the release page. The separate `.sha256.txt` asset contains its SHA-256 checksum.
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

Recent checks are bounded checks. The full traversal provides broader discovery coverage. The five-minute setting is a target interval: active streaming, enabled user-yield behavior, browser sleep and actual server cooldowns can delay network requests. When **Pause network work while I use ChatGPT** is On, user-yield waits for six quiet minutes before new network work. Its checkbox remains available during a run, displays the remaining quiet time, and persists across reloads. Switching it Off releases the activity wait; genuine server cooldowns and streaming still delay new requests. Fresh conversation bodies already captured from ChatGPT can be saved locally during a cooldown.

Use the watcher health text to distinguish an active watcher from one waiting on network permission, user activity or rate limits. **Stop passive watch** suspends automatic wakeups; **Start / resume** reactivates them. **Scan now** requests a new discovery pass. Reopening an active saved watcher reconnects while preserving its queue and cooldown.

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
| `attachments/content/<sha256>/<first-name>` | New verified binaries; identical files share a path while catalogs retain their names |
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

New binaries use `attachments/content/<sha256>/<first-name>`, so different content never overwrites a shared earlier version. Existing valid paths are retained. Library reuse of an unrelated local name/size match requires a reported SHA-256 as well. Saved paths and hashes are verified before a transfer is suppressed. **Retry this file** releases one parked file. **Retry parked files** releases parked/unavailable files together. Both reset that file’s two-attempt budget explicitly; ordinary resumes and scans preserve it. Known files at the size boundary remain manual. Cooldowns defer the queue without counting as failed file transfers.

| Output | Purpose |
| --- | --- |
| `attachments/library-index.json` | Versioned file IDs, names, source dates, status, failure counts, paths, SHA-256, alias/version evidence, image preference and source chat IDs |
| `attachments/library-catalog.html` | Offline all-file catalog with links to saved files |
| `attachments/manual-downloads.html` / `.json` | Manual/unfinished items and links to their ChatGPT folder/source |
| `viewer-handoff.json` | Conversation source paths, linked files and Library inventory for viewer integration |

## Offline viewer interoperability

Point your **kitomisaitichi-design/chatgpt-viewer** at the complete backup folder, keeping `conversation-index.json`, `json/`, `markdown/` and `attachments/` together. Existing native conversation JSON, branches, IDs, timestamps, classifications and basenames keep their format. The conversation index attaches Library files where a source conversation ID is available. Unlinked Library files stay in the file catalog; they are not invented conversations.

Exporter 2.4.10 retains the `chatgpt-conversation-index/v1`, `chatgpt-library-index/v1` and `chatgpt-exporter-viewer/v1` catalog formats. Hash-alias, version-evidence, image-preference, native-file-ID and independent source-reference fields are additive. Historical versions have separate catalog identities so Viewer retains distinct bytes. Viewer 1.1.6 retains the file catalog reader and uses each catalog entry's relative file path, so it supports both retained legacy paths and `attachments/content/<sha256>/<first-name>` shared copies.

| Exporter feature | Viewer behavior |
| --- | --- |
| Identical content under different names / IDs | Catalog entries retain their names, IDs and chat links while opening the same saved binary. |
| Deduplicate & smart scan | Updated conversation and Library catalogs point to the surviving verified copy before redundant bytes are removed. Reopen Files & Library to refresh the catalog. |
| Different file versions | Distinct content remains available as separate files. Preferred-version evidence and filters are presented in the exporter. |
| Download images switched off | Already saved images remain available; excluded images remain cataloged for manual access. Enabling downloads resumes eligible images. |
| Files at or above 10 MB | Download through the listed ChatGPT link, then use **Import downloaded copy** in the Viewer. Saved file downloads and source-chat navigation use the existing Viewer workflow. |

Keep the complete backup together: the Viewer needs the indexes and actual `attachments/` binaries. The cached-chat ZIP contains transcripts and metadata; compress the complete backup folder when transferring files between computers. The current isolated exporter-to-Viewer checks run against **Viewer 1.1.6**, release commit `5e2ff2c849f94824fb234b6f8c1232750139f12c`. They verify catalog loading, retained chat-only files after source disappearance, saved byte downloads, source-chat navigation, the current chat Files panel and text previews, and manual 10 MB imports without rebuilding message indexes.

The current Viewer reads the native conversation index and Library file catalog together. Its chat Files control adds text/image previews and original-path access; its Library control retains manual downloaded-copy imports. Use its Files & Library panel to browse local files and import manual downloads. The saved HTML catalogs remain available without the Viewer. The cached-chat ZIP remains a transcript export; compress the full backup folder to include Library binaries.

## Activity controls

Filter messages by search text, severity or category. **Pause log display** freezes only the displayed events; backups continue. Scrolling away from the bottom turns following off; **Jump to latest** resumes it. **Clear view** hides earlier events without deleting queue history, and **Show all / reset** restores them. Copy/TXT exports use the visible filter; full JSON exports use the retained history. Filters/follow preferences persist in the extension.

## Privacy and limits

The extension has no external analytics or upload backend. Authentication stays in the signed-in ChatGPT page; bearer tokens are not stored in the extension's IndexedDB or exported state. Backups and portable state contain private conversation information, so keep them separate from public source repositories and release uploads.

Discovery depends on the conversations exposed by the enabled ChatGPT website routes. Those private endpoints can change. Completion means the enabled routes reached their end and exposed conversations were handled; it cannot prove the existence or recovery of chats the service never exposed. Sign-in challenges, changed accounts/workspaces, folder permissions and quota failures may require user action.

## Validation

Isolated Edge checks cover downloads before inventory completion, 30 distinct attachments across bounded resumable batches, 10,000-file/5,000-chat responsiveness, active-run activity-toggle behavior and reload persistence, bounded All browsing, preserved expanded Details, 253-file browsing, linked chat/Library identity reuse, fallback routes, shared failure memory, source disappearance, retained files in Viewer 1.1.6, manual imports, renamed aliases, a reported-hash transfer skip, safe cleanup, image-toggle persistence and resume, and desktop/tablet/phone layouts. The updated version has not been run against the live user account.

All **144 exporter regression tests** pass, including duplicate equality, native identity reuse, failure sharing, explicit retry after metadata changes, false-positive prevention, source retention, stale observations, previous versions, catalog write failure, Stop/removal-journal recovery, version ambiguity, image extraction and image-body cancellation. Runtime syntax and package checks cover the shipped files. The native API shapes were inspected in a signed-in ChatGPT Library session; download and UI integration tests use an isolated Edge profile and synthetic files. No private account data or credentials are included in tests or releases.

## Complete version history

This lists **every published GitHub release** plus the earlier development builds documented in this repository. Each row links to the detailed notes or the complete code comparison. Older Viewer numbers and download policies in archived notes describe those versions; current interoperability is tested with **Viewer 1.1.6**.

| Version | Changes introduced | Release and detailed history |
| --- | --- | --- |
| **2.4.10** | Both folder controls recover transcript JSON; remembered file locations join chat search; new queue IDs trigger indexed local lookup before download. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.10) · [Full notes](CHANGELOG-v2.4.10.md) |
| **2.4.9** | Stop local timestamps from forcing downloads; recover nested same-user backup bodies for known IDs; persist validated transcript scan fingerprints; skip overlap; single-worker Start. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.9) · [Full notes](CHANGELOG-v2.4.9.md) |
| **2.4.8** | Detect existing/nested backup roots; recursive JSON-content recovery; browser-cache and matching metadata restoration; remembered permitted locations/search index; Documents/Downloads/Desktop shortcuts; renamed/native-ID/hash local retrieval; visible scan results and rescan. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.8) · [Full notes](CHANGELOG-v2.4.8.md) |
| **2.4.7** | Fix restart pause caused by null attachment IDs; deterministic source-key fallback; null-safe duplicate/catalog/display sorting; preserve saved backup state. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.7) · [Full notes](CHANGELOG-v2.4.7.md) |
| **2.4.6** | Fair queues; Library downloads during discovery; 20%/80% growth-based Library turns; bounded attachment batches/cursors; rotating folders and validation; older-file turns; recent checks during file work; visible priority/growth/stall reasons; batched reports with per-operation checkpoints. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.6) · [Full notes](CHANGELOG-v2.4.6.md) |
| **2.4.5** | Indexed file/queue lookups, cached display models, reused file analysis, coalesced renders, unchanged-log skips, debounced search, bounded All pages, expanded Details retention, and a persisted live six-minute toggle with countdown and worker wakeup. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.5) · [Full notes](CHANGELOG-v2.4.5.md) |
| **2.4.4** | Native identity reuse across chat/Library before transfer; independent source presence and retained chat-only files; previous verified versions; shared failure budget and retry; stale-observation fix; unified strict 10 MB boundary; source filters/details; current Viewer 1.1.6 checks. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.4) · [Full notes](CHANGELOG-v2.4.4.md) |
| **2.4.3** | SHA-256 sharing across names/IDs; reported-hash request suppression; content-hash storage; safe Deduplicate & smart scan with removal journal; version families and preferred/review evidence; image downloads toggle and chat image-pointer support. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.3) · [Full notes](CHANGELOG-v2.4.3.md) |
| **2.4.2** | Native Library cursor and source-chat metadata; continued discovery past mounted/unsupported entries; stable in-flight queue objects; persistent two-failure parking; explicit retries; native no-query route/header handling; full-width Library with search, sort, grid/list, page sizes and visible pagination; refreshed responsive visuals. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.2) · [Full notes](CHANGELOG-v2.4.2.md) |
| **2.4.1** | Reliable folder/pagination resume; sparse metadata preservation; existing-copy validation; oversize cancellation and Stop/hold between chunks; fewer catalog writes; paused/cleared log fixes; Viewer Files & Library and manual copy import. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.1) · [Full notes](CHANGELOG-v2.4.1.md) |
| **2.4.0** | Library file/folder inventory; automatic downloads under 10,000,000 bytes and manual catalogs; stable IDs and hashes; Library pacing/chat priority; adaptive quiet checks and offline waits; full activity controls; versioned Library index and Viewer handoff. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.4.0) · [Full notes](CHANGELOG-v2.4.0.md) |
| **2.3.9** | Dashboard redesign: leading progress and Start/Stop, grouped setup/settings/watch/file/activity/portable tools, saved totals and percentage, connection feedback, status colors, readiness, responsive layouts, focus and reduced-motion support. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.3.9) · [Full notes](CHANGELOG-v2.3.9.md) |
| **2.3.8** | Autonomous recent metadata checks at a default five-minute target; fixed full-scan deadlines; completed streamed replies with unchanged timestamps; chat priority over attachments; persisted pending revisions; one-minute background alarm and visible watcher health. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.3.8) · [Full notes](CHANGELOG-v2.3.8.md) |
| **2.3.7** | Attachment repair with conversation-aware routes and signed-content fallbacks; rejected service-error bytes; saved/local byte validation; preserved error evidence and honest unavailable results; migrated attachment repair state. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.3.7) · [Complete code changes](https://github.com/kitomisaitichi-design/chatgpt-exporter/compare/ChatGPT2.3.6...ChatGPT2.3.7) |
| **2.3.6** | Passive watching after available work finishes, including parked chats; distinct watch state and saved run outcome; Stop/Start suspension; reload reconnect and cooldown preservation; wake only for new/changed/due work. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.3.6) · [Full notes](CHANGELOG-v2.3.6.md) |
| **2.3.5** | Prevent older detail timestamps and repeated body observations from requeuing chats; bounded failed writes/network retries; download-cycle/time limits; error-envelope rejection; chunk/size integrity checks; tiny-file revalidation and missing import fix. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.3.5) · [Full notes](CHANGELOG-v2.3.5.md) |
| **2.3.4** | Park hard chat-detail failures for seven days; newer metadata can release them; remove redundant full-account verification; productive work during discovery retry waits; Hold/Resume; six-minute user-activity yielding; faster quiet pacing recovery. First published release uses the original `ChatGPT` tag. | [Release](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT) · [Full notes](CHANGELOG-v2.3.4.md) |
| **2.3.3** — development | Fix prepared attachment chunks using a volatile workspace check; bind prepared bytes to the preparing user; requeue affected failures; classify hard chunk failures; count successful attachment reads toward pacing recovery. | [Full notes](CHANGELOG-v2.3.3.md) |
| **2.3.2** — development | Local attachment reuse and optional existing-file folder; retire old hard attachment retry loops; workspace-pinned reads; one-shot optional difficult-chat recovery; idle pacing decay; preserve saved transcripts when attachments defer. Its filename/size-only reuse policy was tightened in 2.4.4. | [Full notes](CHANGELOG-v2.3.2.md) |
| **2.3.1** — development | Startup disk/index reconciliation; retain IDs/provenance/revisions; separate local work from network pacing; retrieve attachments after transcripts; deduplicate traffic observations; bounded local rests and clearer tier cadence/recovery. | [Full notes](CHANGELOG-v2.3.1.md) |
| **2.3.0** — development | Preserve v2.x queue/cache; conversation fingerprints and revision-aware overwrites; passive body comparisons; oldest-first traversal; portable queue/index/schedule/pacing state; scheduled rescans; attachment backup; chat-kind classification and reports. | [Full notes](CHANGELOG-v2.3.md) |

Browse [all releases](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases), [all packaged changelogs](https://github.com/kitomisaitichi-design/chatgpt-exporter/tree/main/ChatGPT-Exporter-English-Edge), or [the complete commit history](https://github.com/kitomisaitichi-design/chatgpt-exporter/commits/main/) for line-by-line changes. Earlier upstream adaptations are attributed in [Third-party notices](THIRD-PARTY-NOTICES.md); they are not presented as additional published releases of this repository.

## License and attribution

Repository code is distributed under the MIT license in the repository root. Bundled third-party components retain their own notices and licenses. See `THIRD-PARTY-NOTICES.md` and `licenses/` inside the extension folder for upstream references and JSZip notices.
