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

The viewer can continue importing conversations through its existing index/native-JSON importer. The new `chatgpt-exporter-viewer/v1` and `chatgpt-library-index/v1` manifests expose Library metadata for its future file browser. This release updates the exporter; it does not add a new Library interface to the viewer application. Open the saved HTML catalog now to browse files locally. The cached-chat ZIP remains a transcript export; compress the full backup folder to include saved Library binaries.

## Activity controls

Filter messages by search text, severity or category. **Pause log display** freezes only the displayed events; backups continue. Scrolling away from the bottom turns following off; **Jump to latest** resumes it. **Clear view** hides earlier events without deleting queue history, and **Show all / reset** restores them. Copy/TXT exports use the visible filter; full JSON exports use the retained history. Filters/follow preferences persist in the extension.

