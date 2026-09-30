# v2.3.6 — resume passive watching after available work finishes

- Start enters a distinct **Passive watch active** state when discovery is done and no eligible work remains. Unresolved chats remain visible and parked; they do not prevent watching.
- Normal export completion returns to watching when Passive watcher is enabled. The job records the previous run outcome separately, so watching does not claim unresolved chats were saved.
- The dashboard shows the next scan in minutes, enables **Stop passive watch**, and identifies the watcher as active. Start does not rerun local reconciliation over and over when only parked failures remain.
- Stop suspends both active export and automatic watcher wakeups. Start reactivates watching. Held active work retains its separate Hold in place behavior.
- A watching job reconnects to the same account/workspace after dashboard reload, honoring a saved cooldown before reconnection.
- The watcher wakes for new links, newer list metadata, genuinely changed bodies, or due queued work. Already handled body observations and future retries do not repeatedly launch the engine. The periodic full scan remains on the selected schedule.
- Updating a finished v2.3.5 job with passive watching enabled restores the watcher. Deliberately paused jobs remain stopped.

Validation: five focused watcher-policy tests passed. An isolated Edge extension test confirmed watching with a parked failure, Stop preventing timer restart, Start resuming idle watching, reload reconnecting without another conversation download, and a new visible chat link automatically being downloaded before returning to watch. Website traffic was simulated and the test clock accelerated. The v2.3.5 attachment integrity and rescan checks also passed.

## Update without resetting your backup

Replace files inside the same installed extension folder, click Reload on its card at `edge://extensions`, and reopen the exporter. Keep the same installation path and browser profile to retain the queue, cache and cursors. Leave Passive watcher enabled. If it is paused, connect if needed and press Start / resume. No reset, reimport or full rescan is required for the watcher fix.

Keep Edge, the exporter dashboard and its connected ChatGPT tab open, with the computer awake. Passive watching cannot run while the browser is closed. Server limits and user-activity yielding still apply when new network work is required.
