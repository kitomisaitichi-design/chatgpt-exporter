# 2.4.24 — automatic folder setup after account switches

- Explicit Connect searches matching archives first. If the permitted search finishes without a match, prepare that account’s own `chatgpt-backup-<key>` folder inside an already accessible remembered backup location. No repeated folder picker or request to remember a path.
- Never adopt another account’s root or import its job. Preserve existing matches and data; reuse an empty interrupted setup; reject occupied unverified names. Ambiguous results, truncated searches and access faults never trigger automatic creation.
- Explicit Connect can renew one saved prompt-state directory grant before waiting for the network. Refusal is respected and no additional prompts or picker follow. Background/Viewer reconnects neither prompt nor create folders.
- First-ever extension setup still requires a folder grant. Browser-only discovery is limited to already permitted trees; no new native host, dependencies, browser permissions or catalog schema.

Verification: 262 Node regressions and isolated Edge A/B/C switching, new-account folder setup, exact existing-job preservation, repeat Connect/refresh without nesting, and zero conversation requests/page errors. Existing Viewer integration retained. Live activation and a full current Viewer import remain unrun.
