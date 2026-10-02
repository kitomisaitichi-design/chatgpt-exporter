# ChatGPT Exporter 2.4.2

Library downloads and discovery are aligned with the current native request format. The scanner follows `cursor`, retains source-chat IDs and continues past mounted/unsupported entries instead of abandoning the page.

- Passive observations now update the existing queue record instead of replacing it during an active transfer, preserving both saved results and failure counts.
- Two failed transfers park a file. Attempts and park state survive rescans, metadata changes, restarts and portable-state restore. A user retry starts a new two-attempt cycle; server cooldowns and Stop do not count as file failures.
- Native no-query download route first, observed frontend headers, and per-file HTTP route details.
- Full-width Library workspace with status cards, grid/list, search, sort, 25/50/100/All rows and always-visible page controls. Per-file retry and source-chat links.
- Refreshed indigo dashboard, responsive layouts and clearer file statuses.
- Automatic downloads stay strictly below 10,000,000 bytes. Larger files remain listed for manual download and import into Viewer 1.1.4.

Update inside your existing unpacked-extension folder, reload that extension in Edge, refresh the connected ChatGPT tab, and reopen the dashboard. Connect to the same account/workspace and resume. The first upgraded connection repairs Library discovery once without clearing saved file results or failure counts.

Validation: 67 regression tests, runtime syntax checks and isolated Edge integration. Current native Library response shapes and a successful native download-link request were inspected live; the updated extension has not been run end to end against the live account because browser tooling blocks extension pages.
