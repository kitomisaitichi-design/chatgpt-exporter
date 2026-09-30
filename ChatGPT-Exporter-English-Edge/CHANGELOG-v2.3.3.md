# v2.3.3 — prepared-attachment scope fix + truthful attachment pacing

- Fixes a v2.3.2 bug where `assetPrepare` correctly pinned only the signed-in user, but `assetChunk` still passed through the old volatile workspace check. A fetched attachment could therefore fail while its already-fetched bytes were being copied out, causing one useless retry per pacing interval.
- Prepared attachment chunks/releases are now bound to the signed-in user that prepared them; workspace-header changes cannot invalidate bytes already fetched into the page.
- v2.3.2 attachment failures with the false workspace-change signature are requeued immediately on upgrade.
- Attachment chunk 404/permission failures become hard unavailable states instead of generic six-hour retries.
- Successful network attachment reads now count toward adaptive pacing success, so T5 can step down from demonstrated clean reads instead of waiting only for idle decay.
- Local reconciliation now reports how many permitted local files were actually scanned and whether the optional existing-files folder was readable.
