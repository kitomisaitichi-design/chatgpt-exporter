# ChatGPT Exporter 2.4.19

- Fix repeated backup loops caused by treating every successful conversation PATCH, DELETE or other metadata write as a completed reply. Reply completion tracking now listens for conversation POSTs.
- Track stable authored conversation revisions separately from raw full-JSON checksums. Ignore changing server envelopes, timestamps and message delivery status when deciding whether to overwrite an existing chat backup.
- Before skipping a repeat export, verify that the unchanged earlier conversation is still present on disk. Real new messages, branches, titles, attachment references and content edits continue to overwrite the JSON and Markdown backups.
- Restore revision information from the existing saved JSON or cache when upgrading older backup indexes; no forced full re-export or loss of existing raw checksums.
- Update the visible Edge version in the top navigation and footer to 2.4.19. Place the Library and Activity directly below the watcher in the main reading column; the sidebar is free to grow without leaving a blank middle row. Refresh the Backup tools card with compact file-type download buttons, clear labels, accent borders, and subtle hover treatment while retaining all existing actions.
- Verified with Node regression tests for repeated unchanged responses, metadata-only changes, actual replies, renamed chats, missing backup recovery and browser-native POST/PATCH detection.
