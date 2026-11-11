> **NEW CANONICAL ENTRYPOINT (11.11.2026):** [Complete project map / cross-chat recovery (RU)](docs/MASTER_PROJECT_MAP_AND_HANDOFF_RU.md) · [Rebuild and safe reuse guide (RU)](docs/INSTALLATION_AND_MIGRATION_RU.md). Verify the actual main HEAD, PR, CI, Pages and the latest work journal before modifying anything. The older status text below is historical.

> **Project continuity (2026-11-11):** [Engineering log (RU)](docs/WORK_ACTIVITY_LOG_RU.md) · [Handoff runbook](docs/PROJECT_HANDOFF_RU.md) · [Reusable-site blueprint](docs/REUSABLE_SITE_TEMPLATE_RU.md). The older setup prose below is historical. Consult recent PRs, CI and on-device tests.

# VELARDREAM RECORDS — velardream.com

Independent music label website and planned private VMM workspace. GitHub Pages deploys the public landing page from `main`.

**Public website:** Artists / releases / genres / about. The owner-approved branding includes a crystal mark, wordmark and CSS star field. `noindex` stays in place until a public launch decision.

**Private Studio (staged):** `/studio/` has a **publicly inspectable code shell, NOT private content**. There is intentionally no navigation link on the landing page. The future workspace requires Google Firebase Authentication **and** a server-enforced `vmm_admins/{uid}` allowlist. Until a separate VELAR Firebase project's web config is set up, sign-in is **disabled** and no private data can be read. Firestore rules are committed for review, not deployed.

**Backups:** the owner's original Google Sheet has been copied privately into the project archive. No song lyrics, contacts, secret keys or private records are committed here.

See [Russian setup instructions](docs/PRIVATE_STUDIO_SETUP_RU.md) and [Russian project status](README_RU.md). Full VMM migration, A4 Lyrics Studio parity and offline-first cross-device syncing are future tasks.

> GitHub Pages is public. Keeping a link unlisted or setting `noindex` does not restrict access. Firestore security rules must protect all private data.
