# ChatGPT Exporter — English Autopilot v2.3.4

- Parks hard chat-detail failures (HTTP 400/404/410/412/422) for seven days and preserves that hold across manual/passive rescans.
- `Retry unresolved items` respects the seven-day hold. A genuinely newer server update clears it automatically.
- Removes the redundant whole-account verification loop. Only an actually incomplete discovery route is repaired.
- Productive transcript/attachment work can continue while a discovery repair is waiting for its retry window.
- Adds **Hold in place / Resume in place**, which keeps the live engine, worker tab, queue, cursors and connection in memory without restarting inventory or discovery.
- Adds a default-on **Yield while I use ChatGPT** policy: user click/key/wheel/touch/scroll activity in ChatGPT suppresses exporter network work until six minutes of inactivity.
- Uses a new v2.3.4 page bridge namespace so reloading the extension can inject the upgraded activity detector into already-open ChatGPT tabs without colliding with an older bridge.
- Successful/quiet operation steps the adaptive tier back down sooner; idle decay is six minutes per tier instead of twelve, while explicit server Retry-After remains authoritative.
