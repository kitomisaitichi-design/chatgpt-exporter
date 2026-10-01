# v2.3.9 — clearer backup dashboard

October 1, 2026.

The dashboard now puts live progress and run controls first, with account/folder setup alongside them on wide screens. Backup settings, watcher settings, recovery tools, portable state and activity are grouped into distinct panels.

- More readable dark layout with clearer spacing, compact navigation and consistent controls.
- Six labeled counters, saved-chat totals and percentage, and an attention highlight for unresolved items.
- Explicit headings and colors for exporting, watching, waiting, paused, held, completed and error states.
- Visible Connecting feedback during a manual connection attempt; its button is temporarily disabled while that existing request runs.
- Account/folder readiness indicators, with long account identifiers moved to the connection tooltip.
- Separate recent-check and full-discovery selectors, watcher enable/off feedback and a visible operating reminder.
- Recovery, local originals, portable-state transfer and manual links remain available in labeled groups.
- Responsive layouts, keyboard focus indicators, form labels and reduced-motion support.

Export retrieval, bridge injection, attachment handling, account/workspace checks, adaptive pacing, saved-state database and watcher scheduling retain the v2.3.8 behavior. An upgrade in the same installed folder retains queue/cache/cursors and folder selections.

Validation: focused exporter tests and isolated Edge browser checks cover connection, file selection, watching, revisions, Stop/Start/reload, attachment repair, presentation states and responsive overflow. Website responses in the browser checks are simulated; this does not establish behavior or attachment availability for a particular live account.
