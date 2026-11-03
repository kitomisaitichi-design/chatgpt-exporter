# ChatGPT Exporter 2.4.25

- Added the per-account Library toggle **Prioritize archives up to 125 MB**. ZIP, RAR, 7z, TAR and common compressed variants qualify by filename. The decimal 125 MB limit is inclusive and the toggle starts off.
- Eligible archives get earlier file turns. Chat scheduling, an oldest-first Library turn every fourth file, request pacing and shared failure limits still apply.
- Enabling the toggle requeues eligible size skips. Turning it off puts unsaved oversized archives back in the manual list and keeps saved copies available.
