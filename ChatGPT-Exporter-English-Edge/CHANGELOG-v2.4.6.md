# ChatGPT Exporter 2.4.6 — fair queues and adaptive Library downloads

Previously, Library downloads waited for a complete Library inventory, chat attachment passes ran first, and saved-copy validation could occupy the entire file phase. A long scan or continuing chat activity could keep ready files waiting while the saved-file count appeared stuck.

## Scheduling

- Chat transcripts, chat discovery, recent checks, chat attachment batches, Library work and saved-copy validation take bounded turns. Newly changed chats receive up to two urgent turns; already captured chat bodies receive up to four local turns. Other ready queues retain their place.
- The default mode is now **Smart adaptive · discover and download together**. The existing `index-first` setting migrates to this behaviour without resetting the queue. Its chat-index warm-up is bounded to two pages or 30 seconds. Balanced omits this chat warm-up; Index only continues to skip transcript and file downloads.
- Library discovery no longer blocks downloads until every page/folder is finished. Small fresh inventories get at most two pages or 30 seconds of warm-up. An existing substantial inventory, or at least half of a substantial previously observed high-water count, can start downloading immediately.
- During active discovery, the target is one download per four Library page turns, roughly 20% of Library turns. If new file IDs in the rolling three-minute window fall below 2% of the locally observed high-water count, it favours four downloads per page, roughly 80%. These are operation shares, not bandwidth guarantees or claims about the unknown server-wide total. With only one ready queue it continues that work; ready downloads also receive a turn after a minute without a file attempt.
- Library folders rotate by last page time. A large root inventory cannot indefinitely block already discovered owned folders.
- Small files usually download first; every fourth file turn favours the oldest waiting record, preserving access for older larger eligible files. Uploaded, generated, retained chat files and images share verified native identity/hash handling. The image toggle and strict automatic transfer boundary below 10,000,000 bytes still apply.
- Each chat attachment pass handles at most 25 records and one new file transfer attempt. A per-chat cursor resumes its remaining records across turns/restarts; batches rotate between chats. A quota yield consumes no failure attempt and imposes no six-hour retry delay. Genuine failures, server cooldowns and explicit Retry keep their existing semantics.
- A scheduled asset turn no longer yields merely because ordinary chats or discovery pages remain queued. Newly changed chats can still interrupt an asset wait within the bounded urgent allowance.
- Local validation is one queue turn at a time, coalesced by path, expected size and hash. It does not run across the entire saved catalog before downloads can resume.

## Clearer progress and persistence

The dashboard shows the active queue, its selection reason, separate pending chats/attachment passes, observed Library high-water count, rolling discovery growth and the current 20%/80% target. Actual network waits replace the queue reason with their cause. It warns after ten minutes without new file saves or completed work while running. Policy transitions appear in the activity log.

Every operation still checkpoints its job in IndexedDB. During a run, full reports/catalogs/portable JSON are batched at a 15-second target; finish, pause and explicit report actions flush immediately. This reduces repeated large-file serialization. Deduplication still commits reference changes before removing redundant bytes. Queue positions, shared attempts, source history and existing Viewer catalog formats remain portable.

## Validation and upgrade

125 regression tests pass, including incomplete-inventory downloads, continuous chat pressure, growth-based policy changes, lane fairness, asset preemption, attachment batch timing, old-file fairness, recent-check spacing and checkpoint restoration. Isolated Edge 154 runs prove bytes download before a Library scan completes, all 30 distinct attachments finish across 30 bounded turns without duplicate transfers, two-failure memory remains, and image/hash/source-history/Stop-resume flows work. The 10,000-file/5,000-chat performance fixture remains responsive. Viewer 1.1.6 catalog loading, manual imports, previews and retained file access pass.

The live backup reports were inspected read-only for diagnosis; the updated worker has not been run against the live user account. Existing reports, queues, files and cached bodies are not reset by this upgrade.

Reload the extension in edge://extensions, refresh ChatGPT, reopen the exporter and resume the existing backup. Do not uninstall or choose a new backup folder. The full functionality guide and all version changes are in README.md.
