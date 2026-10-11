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
