# VELAR Music Manager — velardream.com

Repository of the future music-label website **VELAR DREAM**.

**Current status:** safe public starter **committed**, CI static tests passed. GitHub Pages, Cloudflare DNS and HTTPS still require setup; no live domain deployment has been verified. The original Google Apps Script music manager remains separate and unchanged.

- Public landing page and `/app/` placeholder contain **no private catalogue, lyrics, contacts or credentials**.
- `sw.js` caches public assets only. Personal offline editing / sync are **not implemented yet**.
- Initial `firestore.rules` is **deny-all**; Firebase itself is not provisioned.
- Private catalogue will be migrated only after protected authentication and read/write rules are tested.
- Planned: multi-artist label pages, releases, genre/tag filters and playlists. See [architecture](docs/MUSIC_DOMAIN_MODEL_RU.md).
- CI: `npm test`; local checks `node --check main.js && node --check sw.js`.

Developer reference in Russian: [README_RU.md](README_RU.md). The project activity log and private backups are stored outside this public repository.

> `noindex` is not an access restriction. Anyone can inspect published GitHub Pages files, so never commit private data.
