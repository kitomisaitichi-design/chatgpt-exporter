# ChatGPT Exporter 2.4.13 — Resume backup repair

Fixes **Cannot read properties of null (reading 'metadata')** after the optional Viewer integration's heartbeat ran before Resume. Folder readiness now requires the resolved root and its metadata together. Existing JSON/Markdown, attachments, hashes, queue progress, schedule and browser state are retained.

## Update and resume

1. Download and extract **ChatGPT-Exporter-English-Edge-v2.4.13.zip**. Keep your previous extension folder for rollback.
2. Update the same unpacked extension folder and select **Reload** at `edge://extensions`; refresh its dashboard and ChatGPT tab.
3. Reconnect to the same account and backup folder, then select **Resume backup**. Do not reset the queue or delete the backup.
4. Use **Offline Chat Viewer v1.1.16** for the companion heartbeat fix. Its optional adapter supports Exporter 2.4.12 and 2.4.13.

The folder/resume regression uses actual application functions with simulated filesystem/browser services. Live authenticated resume and remote deletion have not been exercised in this repair; browser policy blocks automated access to extension pages. The previous 2.4.12 ZIP and checksum are kept unchanged.

Validation: 177 exporter regressions passed, including missing metadata and lost permission; runtime JavaScript syntax and ZIP CRC/import validation passed. Companion Viewer adapter checks passed on both supported exporter versions.
