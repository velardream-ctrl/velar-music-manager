> **Project continuity (2026-11-11):** [Russian engineering log](docs/WORK_ACTIVITY_LOG_RU.md) · [handoff runbook](docs/PROJECT_HANDOFF_RU.md) · [reusable-site template blueprint](docs/REUSABLE_SITE_TEMPLATE_RU.md). Earlier setup prose below is historical, not current operational status. See open PRs and CI before working on the private Studio.

# VELARDREAM RECORDS — velardream.com

Independent music label website and planned private VMM workspace. GitHub Pages deploys the public landing page from `main`.

**Public website:** Artists / releases / genres / about. The owner-approved branding includes a crystal mark, wordmark and CSS star field. `noindex` stays in place until a public launch decision.

**Private Studio (staged):** `/studio/` has a **publicly inspectable code shell, NOT private content**. There is intentionally no navigation link on the landing page. The future workspace requires Google Firebase Authentication **and** a server-enforced `vmm_admins/{uid}` allowlist. Until a separate VELAR Firebase project's web config is set up, sign-in is **disabled** and no private data can be read. Firestore rules are committed for review, not deployed.

**Backups:** the owner's original Google Sheet has been copied privately into the project archive. No song lyrics, contacts, secret keys or private records are committed here.

See [Russian setup instructions](docs/PRIVATE_STUDIO_SETUP_RU.md) and [Russian project status](README_RU.md). Full VMM migration, A4 Lyrics Studio parity and offline-first cross-device syncing are future tasks.

> GitHub Pages is public. Keeping a link unlisted or setting `noindex` does not restrict access. Firestore security rules must protect all private data.
