# Package A: Patch timeline loads only what is asked for

Client: main orchestrator thread 7527792f-cf62-4867-93c7-6c1ee7559516 (also main orchestrator ID). Role: leaf worker. Do not start further T3 threads or orchestrators; native subagents only for the gate fix loop.
Worktree: `/home/nathanael/.worktrees/Website-patch-timeline-paging`, branch `fix/patch-timeline-paging-20261012` (from origin/main 218c685).

## Problem (measured 2026-10-12)
`GET /api/public/patch-timeline` (`builds/backend-rust/src/routes/public.rs:6`) loads all 33,355 rows of `brain.patch_events` on every request, builds a full serde_json tree and returns 17.6 MB in about 5 s. Each call adds roughly 200 MB RSS to `ddc-website-backend` (9 MB to 534 MB after 26 calls); after 10 days it was at 1.1 GB. Frontend: `dl-patch/src/patch.js` (live at https://deutsche-deadlock-community.de/patch/), which loads everything up front.

## Goal (user's words)
The page should only load what it is asked for. Overview parts (summary tiles, balance timeline per patch, hotspot entities) are cached server-side and rebuilt only when patch data changes. The detail parts (the sources / change feed for a selected entity, patch or search) load on demand: first 20 entries, then a "50 weitere laden" button for the next 50.

## Scope
- Backend: split into a cached overview endpoint (no `events` array) and a paged events endpoint with filters matching the existing UI (search text, entity type, change type, source, entity, patch), `limit` (default 20, max 50) and cursor or offset. Cache invalidation via a cheap change marker (for example `max(id)`/`count` or the latest ingest timestamp), not a fixed long TTL. Keep `/api/public/patch-notes` unchanged.
- Frontend `dl-patch`: use the overview endpoint on load, fetch events only for the current selection/search, show 20, button "50 weitere laden". Keep the existing look. German UI text with real umlauts.
- Caddy already routes `/api/public/patch-timeline` and `/api/public/patch-notes` to 8772; if a new path is needed, keep it under `/api/public/patch-timeline/...` so the existing route matcher can be extended minimally, and name the needed Caddy change in the handover (do not edit live Caddy).

## Acceptance
1. Overview response well under 1 MB; warm request under 100 ms.
2. Events request returns at most 50 rows.
3. Release binary RSS after 30 overview + 30 event requests stays under 100 MB (measure against a locally started binary on a free port, not the live service).
4. Page in Moli: tiles, timeline, hotspots, selecting Shiv shows 20 feed entries, button loads 50 more, search works. Screenshots checked.
5. Existing backend tests and dl-patch tests pass; cargo fmt/clippy clean. Builds via `cargo-slot ... --jobs 3`.
6. `gate_hook.py --review` ALLOW on the final SHA (fix loop yourself with fresh native subagent fixers).

## Rules
No code comments. No `.unwrap()` in production paths. No new SQLite, no secrets in output. Commit and push the branch; do not merge to main and do not deploy. Report in at most 5 lines: SHA, gate verdict, measurements, needed Caddy change, open points. Then `t3-thread.py settle --selbst`.

## Verification evidence (2026-10-12)

- Implementation: instance-local serialized overview cache, repeatable-read change-marker snapshot, filtered `/api/public/patch-timeline/events`, default 20 rows and hard cap 50. Existing patch-notes handler unchanged. Overview tiles remain global when the feed is filtered.
- Frontend: entity, patch and search load bounded pages; appending preserves loaded rows, errors retain the retry offset, stale requests cannot overwrite the latest selection, and pagination restores keyboard focus. Overview initialization preserves filters chosen during loading.
- Dataset: 33,355 actual public patch events copied read-only into this package's disposable PostgreSQL/TimescaleDB container; 353 patches and 741 named entities. No production writes.
- Local release PID 1656232: executable is this worktree's `builds/backend-rust/target/release/ddc-website-backend`, without `(deleted)`. Bound to `127.0.0.1:18772`, isolated database, maintenance scrim mode, role synchronization disabled, no inherited production credentials. Startup log contains no errors.
- HTTP measurement: overview 371,388 bytes; cold 668.59 ms; 30 warm overview requests median 29.81 ms, maximum 62.33 ms; 30 event requests median 23.65 ms. Initial page 20, additional page 50, disjoint IDs; excessive limit capped to 50.
- Memory: initial RSS 10,092 KiB, final RSS 13,724 KiB, peak RSS 15,020 KiB (14.67 MiB). The measurement includes the cold overview and pagination checks before the 30+30 warm loop. Evidence: `/tmp/website-patch-paging-evidence/runtime.json`.
- Release build: `cargo-slot build --manifest-path builds/backend-rust/Cargo.toml --release --locked --jobs 3`, exit 0, compilation 44.91 s. Clippy: same manifest/profile/lock/jobs with `--all-targets -- -D warnings`, exit 0. `cargo fmt --check` and `git diff --check` passed.
- Backend suite: 166 passed, 0 failed, 0 ignored, 0 filtered; release compilation 4m 52s, test execution 485.12 s. Frontend: `npm --prefix dl-patch test`, 6 passed, 0 failed, 0 skipped; `npm --prefix dl-patch run build` and `node --check dl-patch/src/patch.js` passed. Built JS: `index-DKyxMfNI.js`.
- Moli functional pass: four KPI cards, timeline and hotspots; Shiv 20 rows then 70; search `damage` returns 20 matching rows, nonsense search returns none, patch selection reaches the server as a filter. One overview request and eight bounded event requests. No page errors; mobile document and viewport both 390 px. Evidence: `/tmp/website-patch-paging-evidence/browser.json`.
- Moli automation limitation: native Playwright scrolling had stale geometry; interactions used DOM clicks inside the isolated Moli session, with explicit screenshot layout refreshes. Feed screenshots show the 20-row state; the 70-row state was checked in the DOM and request log. No other browser or personal profile was used.
- Visual inspection: opened the desktop/mobile overview, feed and pagination-control PNGs. The existing dark/gold presentation, Shiv detail card and responsive event rows are preserved; the new button is readable and contained at both widths. Impeccable detector returned no findings.
- Integration requirement: add the exact path `/api/public/patch-timeline/events` to the existing Caddy public patch API matcher forwarding to the website backend. Preserve `/api/public/patch-timeline` and `/api/public/patch-notes`. No live Caddy edit, merge, restart or deployment occurred.
- Existing dependency advisory: npm audit reports source-map-js GHSA-68fv-2mgg-jv7q; frontend dependency files were not changed. This package does not claim that advisory is fixed.
- Gate round 1: `[gpt-6.1-sol] ALLOW` on `8bc5017`, with a non-blocking finding that the patch-notes fallback did not rerender control changes. Fresh native fixer commit `1f146aa` was integrated as `bf2df06` with an English commit message. The isolated fixer worktree was `/home/nathanael/.worktrees/Website-patch-paging-fallback-fixer-20261012`, branch `fix/patch-paging-fallback-20261012`; no extra T3 thread was created.
- Fallback runtime proof: Moli reproduced the old bundle's broken selection (zero selected bars after clicking). With the final rebuilt bundle and an explicit overview-503/two-patch-notes fixture, selecting the first patch, switching to the second and toggling selection off all work. No events request and no page error. Evidence: `/tmp/website-patch-paging-evidence/fallback-browser.json`.
- Gate verdict for the final handover SHA is supplied separately. Branch/worktree remain for the integrator. Disposable database containers were stopped and removed without deleting Docker volumes; own backend, preview and Moli processes were stopped after verification.

TESTNACHWEIS[TW-1]: 172 passed, 0 ignored | Baseline: 1 rot (new fallback regression before fix)
WIRKUNGSPRUEFUNG[WP-1]: 0 Befunde | Zwillingssuche: grep-belegt | Fremddienst-Pfade: 2/2 geprüft
TEXTNACHWEIS[DR-1]: Gedankenstriche 0 | ae/oe/ue/ss-Ersatz 0 | Absolutwörter 1 belegt | Senke: dashboard labels and API validation message
SICHTPRUEFUNG[SP-1]: 6 Aufnahmen | 0 mit Befund | Bilder unter /tmp/website-patch-paging-evidence | angesehen: desktop-overview.png, desktop-feed.png, desktop-pagination.png, mobile-overview.png, mobile-feed.png, mobile-pagination.png

The new fallback contract was reproduced failing before its fix; no unrelated pre-existing suite failure is claimed. The row-cap statement is enforced in `patch_timeline_events` by `clamp(1, 50)` and `.take(limit)`.
