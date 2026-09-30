# v2.3.2 — local-first attachments + one-shot difficult-chat recovery

- Existing attachment files are now reused from disk before any ChatGPT attachment request.
  - The selected backup folder is scanned locally (excluding transcript JSON/Markdown folders).
  - An optional **Choose existing files folder** picker lets you point the exporter at the folder tree where your original uploads/downloads already live.
  - Exact filename + byte-size matches are copied into the self-contained backup attachment folder without network traffic.
- v2.3.1 legacy attachment failures are migrated out of the automatic retry loop.
  - Old `failed` attachment states become non-retrying `unavailable` / `deferred-manual` states.
  - Hard 404 / missing-route / permission failures no longer wake the passive watcher every six hours.
  - Only genuine transient failures and HTTP 429 remain automatically retryable.
- Attachment retrieval no longer guesses three private endpoints per file. It uses an observed route or metadata URL first, then at most one canonical `/backend-api/files/download/<id>` fallback.
- The attachment bridge pins the backup's explicit workspace for file reads instead of rejecting because unrelated native page traffic temporarily changed the last observed workspace header.
- Attachment log lines distinguish local reuse, network download, unavailable files, oversize files and retryable failures.
- Adaptive pacing now also decays during genuine idle time: after a limit, each 12-minute quiet block can step down one tier even if there are no successful conversation requests available to provide the old success counter.
- **Automatically open difficult chats** is off by default for new installs/jobs.
  - When enabled, each hard 404/412 conversation gets at most one browser-navigation recovery attempt per retry cycle.
  - Repeated `Deferred page recovery` loops are removed.
- Retrying unresolved work no longer turns a successfully saved transcript back into a pending chat merely because an attachment was deferred.
