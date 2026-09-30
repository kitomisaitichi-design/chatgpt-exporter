# v2.3.1 — migration and pacing repair

- Bulk-reconcile the backup folder at startup. Physical conversation JSON files are immediately credited as already saved instead of being replayed through the queue one at a time.
- Restore every ID from an existing `conversation-index.json`, including index-only conversations that do not yet have a downloaded JSON body.
- Preserve the old index's discovery provenance, revision metadata, chat kind, project metadata, and attachment state where available.
- Separate local work from network pacing. Reading, hashing, indexing, and rewriting local cache/disk files never waits on ChatGPT request timers.
- Move attachment retrieval into a post-conversation phase: discovery and transcript backup finish first, then eligible attachments are scanned/retrieved.
- Avoid re-downloading attachment files already recorded as saved during a retry.
- De-duplicate near-simultaneous exporter/native traffic observations so one exporter request is not counted twice by the local activity guard.
- Replace the 300-second self-throttling pressure stack with burst guards sized so ordinary tier cadence does not block itself.
- Remove request-spacing jitter. The displayed tier delay is now the actual baseline network interval.
- Make step-down responsive to sustained successful requests: higher tiers fall toward faster tiers after a bounded clean run rather than requiring 45–90 minutes of quiet.
- Bound locally invented rate-limit rests to 1–4 minutes by tier; an explicit server `Retry-After` remains authoritative even when longer.
- On upgrading a live v2.3.0 job, discard legacy self-generated long cooldown residue while preserving an explicit server `Retry-After` when one was recorded.
- Dashboard wording now distinguishes network waits from local backup work.
