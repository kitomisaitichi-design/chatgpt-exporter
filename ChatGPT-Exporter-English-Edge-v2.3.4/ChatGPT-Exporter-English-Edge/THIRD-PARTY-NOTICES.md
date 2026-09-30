# Credits and source snapshots

This package is an English personal-use adaptation, with a newly implemented dashboard and persistent queue. It is not an official OpenAI or Microsoft product.

## huhusmang/ChatGPT-Exporter

- Repository: https://github.com/huhusmang/ChatGPT-Exporter
- Snapshot: `efa1f0f266d15c053af4ab4607b948a06332d9f7`
- Upstream extension version: 1.5.0
- Used as the requested functional reference for conversation, archive, workspace and project enumeration, message-tree exports, and extension packaging. The icons and bundled JSZip asset are retained from this project. The English interface and queue implementation in this package are new, not a full line-by-line translation of every upstream feature.
- The upstream README describes the project as for learning and personal use; this snapshot does not contain a conventional repository LICENSE file. This package does not relicense that project's material or imply unrestricted redistribution rights.
- Upstream credits ChatGPT Universal Exporter v8.2.0 by Alex Mercer, Hanashiro, and WenDavid.

## thiscantbeserious/chatgpt-exporter

- Repository: https://github.com/thiscantbeserious/chatgpt-exporter
- Changelog: https://github.com/thiscantbeserious/chatgpt-exporter/blob/main/CHANGELOG.md
- Snapshot: `dfafac248e54102123bf8f95f5791977192f558f`
- Reference version: 1.0.8
- Used as an architectural reference for adaptive pacing, persistent caching, continuing after partial list pages, account-scoped state, and browser navigation recovery. This package has its own implementation and does not bundle the original bookmarklet.
- MIT license, copyright (c) 2026 Simon Sanladerer. The full license is included in `licenses/reference-exporter-MIT.txt`.

## JSZip 3.10.1 and pako

The bundled `jszip.min.js` is used only when you click Save cached chats as ZIP. Regular exports write each chat directly to disk.

- JSZip: https://github.com/Stuk/jszip — copyright (c) 2009-present Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. Dual MIT/GPLv3; used here under MIT. License in `licenses/JSZip-MIT.txt`.
- JSZip includes pako: https://github.com/nodeca/pako — MIT; license in `licenses/pako-MIT.txt`.

No third-party scripts are loaded from a CDN at runtime.
