# v2.3.8 — autonomous discovery and reliable passive updates

October 1, 2026.

The supplied dashboard snapshot recorded some successful revisions, but also showed a running export waiting on repeated server cooldowns. Between complete scans, v2.3.7 primarily observed links, timestamps and conversation bodies already present in ChatGPT tabs. It did not independently poll recent server metadata, and completion of unrelated small runs reset the next full-scan deadline. Frequent activity could therefore keep postponing full discovery.

Changes:

- Independent recent metadata checks run every 5 minutes by default, with 15- and 30-minute settings. They read one updated-order active page, the enabled archive page, project previews and one rotating known project. A new/changed chat can be queued without a visible link, search, or previously captured body. The selected full traversal remains responsible for complete coverage beyond those recent pages.
- The full-scan deadline is advanced when the full scan is queued, and its completion time is recorded after the traversal succeeds. Unrelated downloads and watching do not postpone it. Due full scans can be queued during another export; an existing initial traversal is never discarded just because a timer expires.
- Successful native chat requests emit a durable-in-session completion revision. Streamed replies are observed to their end and their conversation ID is extracted without storing the stream. Each completion is queued once, including replies whose list/detail timestamps remain unchanged. New bridge code is injected into already-open ChatGPT tabs as needed.
- Pending local revisions and current content fingerprints take precedence over stale disk metadata. An older existing export cannot cancel an interrupted revision write or replace the current fingerprint.
- Chat updates preempt attachment requests and attachment waits. Deferred attachment work preserves its remaining records and can resume after a one-minute deferment.
- A one-minute browser alarm supplements dashboard timers. The UI exposes last tab observation, last successful server check, upcoming recent check and network waits/errors. Dashboard actions remain disabled while persisted state is loading.
- Restore reconnects for observation without waiting out the whole saved history cooldown first. Actual history/file requests still respect the cooldown. Fresh already-captured conversation bodies can be written locally during that wait.

Limits and operating conditions:

The dashboard, Edge and connected ChatGPT tab must remain open and the computer awake. Background alarms do not turn this into a cloud service and do not process jobs while the dashboard is closed. Five minutes is the requested metadata-check interval; active streaming, enabled six-minute user-yield, browser sleep and genuine server cooldowns can delay it. Bounded recent checks do not replace the scheduled full traversal. ChatGPT file/type limits and hard-failure handling from earlier versions remain in place.

Update the same installed folder and Reload at edge://extensions. Reopen the dashboard, connect to the same account if prompted, retain Passive watcher, and press Start / resume if stopped. The queue, cache, saved files and discovery history are retained. No fresh discovery or attachment repair is required merely to install this watcher update.

Validation:

All 35 focused tests passed. Edge 154.0.4258.37 tests in isolated profiles with simulated website responses verified a server-only new chat, an existing chat changed remotely, and a completed streamed reply with an unchanged timestamp. Both affected transcripts were saved under their existing basenames, their detail bodies were fetched exactly twice (initial plus one revision), the full-scan deadline stayed fixed through small runs, and an overdue full traversal executed automatically without repeated detail downloads. Stop, Start, reload restoration, health text and a one-minute background alarm were checked. The attachment recovery test also passed.

The old 52-test suite has the same 22 failing test names on the unmodified v2.3.6 release and this release, with no newly failing tests. It is not claimed as passing. The normal user Edge profile and real account were not tested: the browser-control runtime failed to initialize with a missing-path error, including after reset.
