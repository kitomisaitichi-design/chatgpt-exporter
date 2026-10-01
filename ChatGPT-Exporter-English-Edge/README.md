# ChatGPT Exporter — English Autopilot for Microsoft Edge

**Version 2.3.9 · October 1, 2026**

Build a local backup of the conversations available to your signed-in ChatGPT web session. The extension discovers active, archived and project chats, writes conversation JSON and readable Markdown, tracks revisions, and backs up eligible attachments. Your backup stays in the folder you select.

[Download v2.3.9](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases/tag/ChatGPT2.3.9) · [All releases](https://github.com/kitomisaitichi-design/chatgpt-exporter/releases) · [Source code](https://github.com/kitomisaitichi-design/chatgpt-exporter/tree/main/ChatGPT-Exporter-English-Edge)

## What changed in v2.3.9

The dashboard now puts backup progress and run controls first, with account and folder setup alongside them on wide screens. Watcher settings, backup scope, recovery tools, portable state and activity have their own labeled panels.

- A clearer dark layout, compact navigation and responsive spacing.
- Six counters, saved-chat totals and percentage, and visible attention indicators.
- Clear headings and colors for exporting, watching, waiting, paused, held, complete and error states.
- Visible Connecting feedback, account/folder readiness and concise account labels.
- Separate recent-check and full-discovery selectors, with watcher enable/off feedback.
- Keyboard focus indicators, form labels and reduced-motion support.

This is a dashboard update. Conversation retrieval, attachment handling, saved queue/cache, adaptive pacing and v2.3.8 watcher scheduling retain their working behavior. The same-folder upgrade retains your progress.

Detailed change notes are included as `CHANGELOG-v2.3.9.md` inside the extension folder.

## Install in Edge

1. Download **ChatGPT-Exporter-English-Edge-v2.3.9.zip** from the release page. The separate `.sha256.txt` asset contains its SHA-256 checksum.
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

## Privacy and limits

The extension has no external analytics or upload backend. Authentication stays in the signed-in ChatGPT page; bearer tokens are not stored in the extension's IndexedDB or exported state. Backups and portable state contain private conversation information, so keep them separate from public source repositories and release uploads.

Discovery depends on the conversations exposed by the enabled ChatGPT website routes. Those private endpoints can change. Completion means the enabled routes reached their end and exposed conversations were handled; it cannot prove the existence or recovery of chats the service never exposed. Sign-in challenges, changed accounts/workspaces, folder permissions and quota failures may require user action.

## Validation

All **35 focused tests passed**. Additional Edge dashboard checks verified busy connection feedback, setup readiness, original control IDs, watcher toggling, recovery/manual-link controls, visual status states and six viewport widths from 320 to 1440 pixels without horizontal overflow. Isolated Microsoft Edge 154 tests with simulated website responses checked automatic discovery of a server-only new chat, remotely changed conversations, completed streamed replies with unchanged timestamps, stable full-scan scheduling, overdue scans, Stop/Start/reload, watcher health and attachment recovery. Archive integrity, manifest assets, module imports and runtime syntax were also checked.

The historical 52-test suite previously retained the same 22 failing test names between v2.3.6 and v2.3.8. The focused tests and browser checks above are the validation for this UI update. These checks do not establish attachment availability or watcher behavior on a particular live ChatGPT account.

## License and attribution

Repository code is distributed under the MIT license in the repository root. Bundled third-party components retain their own notices and licenses. See `THIRD-PARTY-NOTICES.md` and `licenses/` inside the extension folder for upstream references and JSZip notices.
