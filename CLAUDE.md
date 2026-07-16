# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MedConnect (branded in-app as "Klinik Kasih Anugerah Prima") is a multi-role healthcare PWA for a clinic: doctor, patient, pharmacy, and admin/superadmin portals in one app. It's a static, no-build vanilla JS site — no npm build step, no bundler, no framework compiler. Pages are plain JS files loaded as ES modules directly by the browser.

All UI copy, form labels, and most code comments are in **Bahasa Indonesia** — match that when adding user-facing text.

## Commands

There is no build/lint/test tooling in this repo (`package.json` has no `scripts` block, and there are no test files). Development is:

```bash
node serve.mjs          # static file server on http://localhost:3000, no-cache headers, SPA fallback to index.html
```

`npm install` only pulls in `puppeteer`, used by local, gitignored scratch scripts (`screenshot*.mjs`, `explore-all.mjs`, `test-*.mjs`) that are not committed to the repo — they're personal dev tools, not a test suite.

```bash
node setup-auth.mjs      # one-off script: provisions the 10 demo accounts in Supabase Auth and links them to existing `profiles` rows by hardcoded UUID
```

The `supabase-*.sql` files at the repo root are manual migrations — paste them into the Supabase SQL editor in the order implied by their names (setup → auth-setup → auth-fix → certificates → homecare-setup → ...); there's no migration runner.

Deployed as a static site behind the custom domain in `CNAME` (`myprima.id`) — just serve the repo root, no build artifact to produce.

## Architecture

### Data layer: dual-mode Store (`js/store.js`)

Everything reads/writes through the `store` singleton (also exposed as `window.__store` in `js/app.js`). Its behavior is controlled by `CONFIG.DEMO_MODE` in `js/config.js`:

- **Demo mode** (`DEMO_MODE: true`): all data lives in `localStorage` (`medconnect_db`), seeded from the `DEMO_DATA` object on first load. No network calls.
- **Live mode** (`DEMO_MODE: false`, the current setting): `store.loadFromSupabase()` bulk-fetches every table in parallel on app start into `store.data` (same shape as `DEMO_DATA`), so reads are still synchronous against the in-memory cache. Writes are local-first: mutate `store.data`, call `this._save()` (persists to `localStorage` as a mirror/fallback), then fire-and-forget the same write to Supabase via `supabase.insert/update/delete` — failures are swallowed (`.catch(() => {})` or `console.warn`), so the UI never blocks on network.
- Client-generated local IDs (`generateId()`, e.g. `id_abc123`) aren't valid Postgres UUIDs — `_syncInsert` strips `id` from the payload before inserting so Postgres assigns a real UUID, then patches it back onto the local record so later update/delete calls (keyed off `.id`) hit the right row.
- Some flows (certificates, home care claims, chat/consultations, bookings) call Supabase directly with `await` instead of fire-and-forget, because the UI needs the server-assigned id or a fetched result before proceeding — look at the existing method for the entity you're touching before adding a new one, and match its read/write style rather than inventing a third pattern.

### `js/supabase.js` — hand-rolled REST client

There's no `@supabase/supabase-js` SDK. This module is a thin `fetch` wrapper around the Supabase REST/Auth endpoints (`select`/`insert`/`update`/`delete`/`deleteWhere`/`rpc`, plus `signUp`/`signIn`/`signOut`/`resetPassword`), with a hard 6s timeout so a bad connection falls back fast. Auth uses `sessionStorage.getItem('sb_token')`, falling back to the anon key for unauthenticated reads. Extend this file's query-builder style (`query.eq`, `query.order`, etc.) rather than writing raw fetches elsewhere — a few page files (auth, password reset) do call the Supabase HTTP API directly inline because they need to run before a profile/store exists yet; that's an intentional exception, not something to generalize.

### Routing (`js/router.js` + `js/app.js`)

A minimal hand-written hash router (`Router` class): routes are registered with `router.add('/path/:param', handler)`, matched against `location.hash` by segment count, dynamic segments via `:name`. There is no nested-route or layout concept — every route handler calls `render()` which fully replaces `#app`'s innerHTML and re-runs `Alpine.destroyTree`/`initTree` over it.

All routes and the role-based auth guard live in `js/app.js`:
- `router.beforeEach` gates every navigation: public paths (`/`, `/login`, `/register`, `/verify/:id`, `/artikel/:id`, `/booking-tamu`) are always reachable; everything else requires a `sessionStorage['medconnect_user']` and role match (`/admin` → `superadmin`/`owner`, `/doctor` → `doctor`/`owner`, `/patient` → `patient`, `/pharmacy` → `pharmacy`).
- `owner` is a combined SuperAdmin+Doctor account type (see `store.getProfile`) — it must pass both the `/admin` and `/doctor` guards so it can switch views without logging out. Keep this in mind when changing role checks.
- `render()` is the one chokepoint every navigation passes through, so it's also where any page-level `setInterval` polling gets torn down: pages that poll (chat, admin bookings/consultations, patient dashboard, home care) stash their interval id on `window.__pagePollInterval`, and `render()` clears it unconditionally before mounting the next page. If you add polling to a new page, follow this exact pattern — reuse the same global — or it'll leak intervals across navigations.

### Page modules (`js/pages/*.js`)

One file per role/area (`admin.js`, `doctor.js`, `patient.js`, `pharmacy.js`, `auth.js`, `chat.js`, `homecare.js`, `landing.js`, `notifications.js`, `verify.js`). Each exported function returns a big template-literal HTML string, styled with Tailwind utility classes (loaded via CDN in `index.html`, configured inline there — custom `teal`/`primary`/`accent` colors, `Plus Jakarta Sans`/`Inter` fonts, Material Symbols icon font) and wired up with **Alpine.js** `x-data` objects embedded directly in the string (state, `async` handlers calling into `store`/`supabase`, etc.) — there are no separate component files or a template compiler. When editing a page, the state/behavior lives inline in that returned string, not in a separate script.

`js/config.js` (`CONFIG`) centralizes cross-cutting constants pages rely on: Supabase URL/key, `DEMO_MODE`, role enum, prescription status enum + Indonesian labels, signa/dosage option lists, drug units, visit types, clinic contact info, and the published Google Sheet CSV URL used for home-care BMHP/Jasa pricing (parsed by `parseHomeCarePriceCsv` in `store.js`).

`js/icd10.js` is a static lookup table for the ICD-10 diagnosis autocomplete in the EMR forms.

### Certificates

`window.__generateVaxCert` in `js/app.js` builds a full standalone HTML document (inlined styles, QR code via `api.qrserver.com`, A4 print layout) for a vaccination certificate and writes it into a `window.open('', '_blank')` popup — opened synchronously on click (before any `await`) so popup blockers don't intervene, then filled in once the cert number/log lookups resolve. Certificate numbers are sequential per year (`store.getNextCertNumber`, `NNNN/SKV/KP/YY`) and re-downloading the same patient+vaccine reuses the existing certificate record/number instead of minting a new one (`store.getCertificateForPatientVaccine`).

### Service worker (`sw.js`)

Cache-first for a hardcoded `STATIC_ASSETS` list — if you add/rename a `js/pages/*.js` file, update this list too, or the cached bundle will go stale for offline users. Registration is skipped entirely on `localhost`/`127.0.0.1` (see `js/app.js`) specifically to avoid serving stale `app.js` during local development.
