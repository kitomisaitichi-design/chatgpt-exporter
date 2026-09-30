# ChatGPT Exporter — English Autopilot for Edge

Version 2.3.7 repairs attachment retrieval and stale saved-file bookkeeping. File requests include their conversation context, follow signed same-origin content links, and try bounded fallback routes. Old saved attachment records are locally verified before being counted. See [the update notes](CHANGELOG-v2.3.7.md).

To repair an existing backup, stop the current run/watch, reload the existing extension at `edge://extensions`, and reopen the dashboard. Connect to the same account/workspace if prompted and press **Start / resume**. Upgrade automatically queues an attachment validation pass using saved JSON. **Repair attachment backup** can explicitly reopen failed/unavailable attachment work later. Valid files are reused; only missing or invalid files need network requests. Transcript statuses and discovery cursors are retained.

Known JSON service-error files are copied to `attachment-errors/<conversation>/<filename>.error-response.json` before their fake document entries are removed from `attachments`. Those preserved error responses contain no original document content. A successful retry saves the real attachment in its normal location. An unsuccessful retry is reported as unavailable with the routes attempted, and does not create another fake file. Files larger than 10 MB and the existing media exclusions remain outside the attachment scope.

For an existing installation, stop the run, replace files inside the same extension folder, reload the extension at `edge://extensions`, and reopen the exporter. The same extension identity retains queue, cache, discovery cursors and folder handles. Choose Start / resume. Importing or rescanning everything is unnecessary when that state is still present.

For first installation, extract this folder to a permanent location, enable Developer mode at `edge://extensions`, and choose Load unpacked on the folder containing `manifest.json`. Open the extension dashboard, connect to the intended signed-in ChatGPT account/workspace, and choose your backup folder. Select an indexing/download mode and start. Keep Edge, the exporter dashboard and its ChatGPT tab open, and the computer awake.

Chats are saved as full JSON plus selected-branch Markdown. The backup also stores a conversation index, progress report and portable queue state. Eligible document/code/text attachments up to 10 MB are saved separately. Choose an existing-files folder to reuse locally available originals by filename and size. Error responses are not successful attachment downloads.

Rate limits retain progress and server cooldowns. File-specific failures yield to other items; account, browser-check, folder-permission or quota problems require attention. An unavailable attachment remains listed in the progress report. Private website endpoints may change, and the exporter cannot reconstruct deleted/unavailable server data.

Portable state can be imported after connecting and choosing the existing backup folder in another installation. It preserves IDs, statuses and discovery cursors; locally available JSON avoids repeat downloads. Keep original backups before uninstalling the extension or clearing browser data.

Use Stop run to checkpoint, Hold in place to temporarily hold the current engine, and Start / resume to continue. Scan now checks for new/changed chats. Passive watcher settings control periodic rescanning and whether network work yields while you use ChatGPT. See the included historical change notes and third-party notices for additional behavior and attribution.

