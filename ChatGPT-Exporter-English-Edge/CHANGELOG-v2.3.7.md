# v2.3.7 — retrieve actual attachment bytes and preserve repair state

September 30, 2026.

The inspected backup contained 237 physical attachment files: 235 were exactly 105 bytes and contained GetDownloadLinkError/file_not_found; two were not those service error envelopes. Its v2.3.6 portable state nevertheless reported 376 saved attachment references and retained 245 legacy failed records. Physical files and per-conversation references are different counts.

The earlier integrity update prevented new error responses from being saved, but did not repair all download routes or preserve repair decisions against a stale disk index. This release addresses those gaps:

- File-link requests now include conversation_id and inline=false. Fallbacks cover conversation attachment and alternate file-download routes, with a shared 60-second budget and immediate stop on authentication/rate-limit responses.
- The asset-only allowlist permits signed /backend-api/estuary/content URLs returned by ChatGPT. Legitimate HTML files on that binary-content route are accepted. External signed downloads receive no ChatGPT authorization headers.
- Old attachment records are queued for local byte validation, independent of transcript queue state. Legacy failed/unavailable records get one pass through the corrected routes. Versioned attachment-state metadata prevents disk inventory from replacing current validation/retry outcomes.
- Attachment success is credited after actual local bytes pass error-envelope and known-size checks. Missing files are retried. Existing valid files, including tiny text originals, are reused without network requests.
- Invalid service-error payloads are preserved under attachment-errors before their fake document entries are removed from the attachment folder. The canonical destination is checked even when an old record lost its saved path/status.
- Repair attachment backup explicitly reopens attachment work, retains discovered chat IDs and saved transcripts, and uses local JSON/cache. Route attempts and failures appear in the report. No uninstall, fresh discovery, or transcript redownload is required.
- Dashboard actions wait until saved state has finished loading.

Route references: [export-chatgpt API research](https://github.com/brianjlacy/export-chatgpt/blob/main/_docs/PROJECTS_FILES_RESEARCH.md), [chat2api download implementation](https://github.com/lanqian528/chat2api/blob/main/chatgpt/ChatService.py). These private website routes are implementation references, not an OpenAI stability guarantee.

Validation: 24 focused tests passed. A real Edge 154.0.4258.37 extension in an isolated profile used simulated website responses and legacy on-disk state. It saved real fixture bytes via a signed same-origin content URL, saved an HTML original, reused a valid tiny file without a request, preserved a 105-byte error separately, rejected unavailable data, and retained repaired statuses through reload and an explicit retry. No transcript network reads were made in that repair run.

The older 52-test engine suite has 22 failures on the unmodified v2.3.6 package as well as this package; the same test names fail, with no newly failing tests. This release does not claim that broad historical suite passes. The installed user Edge profile and availability of the missing original uploads were not verified.

