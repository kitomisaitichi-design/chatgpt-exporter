# ChatGPT Exporter 2.4.12

Local filesystem permission, security and quota errors now reach the paused worker instead of consuming Library transfer failures or delaying attachment repair for six hours. Restore folder access or free disk space, then Resume; file attempts and parked state are retained. Actual server/network failures keep the existing two-attempt policy.

Includes all v2.4.11 incremental indexes, shared SHA/native-ID/path lookup, one-time candidate classification, batched internal checkpoints and bounded background linking. Automatic linking retains physical copies; cleanup remains manual. Hold/Stop, source history, distinct versions, image preferences and the existing Viewer catalog schemas remain supported. No dependencies added.

Validation: 175 regression tests and runtime syntax checks. Isolated Edge covers the local permission pause without an attempt charge or physical-file changes, recursive folder recovery, one initial scan for two consecutive downloads, Hold/Stop, refresh and manual cleanup. Linear fixture: 199/399 opens for 100/200 files, one full hash each. The 10,000-file rendering check passed on v2.4.11; rendering code is unchanged in this follow-up. These are synthetic browser checks; live private account resume and full Viewer 1.1.10 import were not rerun.

Current Viewer: 1.1.10 (checked October 7, 2026); README links to latest. Full version history and functionality remain in README.

Reload the existing extension at edge://extensions, refresh ChatGPT and the dashboard, reconnect, select your existing backup, Rescan local folders once and Resume. Keep old/nested backups; no reset or deletion is needed.
