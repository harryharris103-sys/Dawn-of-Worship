# DOW Software (Dawn of Worship) — Handoff

**Owner:** Darryl · **Business:** Mega Tag Enterprise · **Current version:** v1.13.0 · **Written:** 24 Oct 2026
**Purpose of this file:** let any new chat (or developer) pick the project up without re-reading the history.

---

## 1. What it is

A church presentation app that runs entirely in the browser — one operator window plus an output window for the congregation screen and a stage display for the worship leader. Modelled on EasyWorship.

**Deliverable = 5 static files, served from the repo root:**

| File | Role |
|---|---|
| `index.html` | The whole app (HTML + CSS + JS, ~198 KB, no build step, no framework) |
| `sw.js` | Service worker: offline copy of the app + the JSZip library |
| `manifest.webmanifest` | Install-as-app metadata |
| `icon-192.png`, `icon-512.png` | App icons |

Only external dependency: **JSZip 3.10.1** from `cdnjs.cloudflare.com` (PPTX import and ZIP export; cached by the service worker after first load).

## 2. Deployment (current)

- **Now:** Cloudflare Pages, connected to the GitHub repo — **for testing only for now**. Previously GitHub Pages.
- Every push to the repo redeploys. The repo root must contain the 5 files above.
- **Delete `niv.json` / `niv.ewb` from the repo** — since v1.13.0 the app no longer loads them, and leaving them in a public repo still publishes the text.
- **Storage is per web address.** Bibles, songs, media, PPTX decks, fonts, templates and settings live in the *browser* (IndexedDB + localStorage) and belong to one origin. Production URL, each `*.pages.dev` preview/branch URL and any custom domain are separate stores. Moving address = starting empty → use **Export tab** (library) and **Templates ⬇ Export/⬆ Import** (templates + alerts) to carry things over.
- Cloudflare tips: leave Rocket Loader and Auto-Minify **off** for this site (they rewrite inline scripts). Static assets are served over https, which the camera, screen-detection, service-worker and BroadcastChannel features all require. Optional hardening: a `_headers` file (Pages feature) with `Cache-Control: no-cache` for `/index.html` and `/sw.js`.
- The service worker version string in `sw.js` (`VERSION`) should be bumped with each release (hygiene only; `index.html` is fetched network-first).

## 3. Architecture in one page

**One file, three modes chosen by the URL hash**

| URL | Mode |
|---|---|
| `…/index.html` | Operator / control panel |
| `…/index.html#out` | Output window (congregation) — opened by the operator with `window.open` |
| `…/index.html#stage` | Stage / foldback display — opened by the operator |

**Rendering:** class `Scr` draws a 1920×1080 stage scaled to its host element. It is used for the Preview and Live thumbnails *and* the real output, so what you see is what is projected. Layers: background, dim, media, text, plus an alert layer (`.alw`).

**Cross-window messaging**
- Operator → output: `postMessage` (slides, background, display settings, fonts, site view).
- Alerts + stage state: `BroadcastChannel('dow-live')` (survives an operator refresh; windows send `{hello}` on load and the operator replies with the current state).
- Live camera: the operator opens the device and hands the same `MediaStream` to the output via `win.__dowCam(...)`; fallback = output opens the device itself (re-finding it by name if its device id differs).
- Stage window tells the opener `{sready}` so the operator can delegate fullscreen to it.

**Storage**
- IndexedDB `dow` (v2), object stores keyed by `name`: `bible`, `song`, `media`, `pptx` (parsed slides + the original `.pptx` Blob since v1.10.0), `font`.
- localStorage keys: `dow.s` display settings · `dow.d` Quick Dock · `dow.tpl` display templates · `dow.theme` · `dow.ao` auto-open · `dow.onl` Online-tab settings · `dow.draft` song-editor draft · `dow.cam` camera choices · `dow.man` media thumbnail mode · `dow.al` alerts (messages, tokens, appearance) · `dow.scr` chosen Output/Stage screens · `dow.gh` sync repository · `dow.dev` developer unlock flag.

**Code layout inside `index.html`** (search for the section comments): changelog comment block at the top (add a line per release and bump `DOW_VERSION`) → CSS → shared helpers (`Scr`, alert/token helpers, camera helper) → `if(OUT){…} else if(STG){…} else {…operator…}`. The operator branch holds Bible/songs/media/PPTX/Online panels, camera, export, search, alerts, screens, developer features, then the event wiring.

## 4. Feature inventory (by release)

- **1.0–1.4:** Bible import (JSON), quick-verse bar, song editor, display settings, templates, Quick Dock, GitHub-folder sync (🔄, now Developer Features), output window + 2nd-screen placement.
- **1.5–1.6:** Media fit + media-only projection; **Online tab** (shows scripture live from a public Bible website).
- **1.7:** Offline caching (service worker + manifest).
- **1.8:** PPTX import rebuilt to match PowerPoint rendering.
- **1.9:** EasyWorship `.ewb` Bibles; `.xml` (OpenLyrics) songs.
- **1.10:** Live camera / capture-card projection (preview, projection, background, sound option); **Export tab** (lyrics `.txt`, Bibles `.json`, original PPTX; ZIP or separate).
- **1.11:** Song search inside lyrics; scripture search by word/phrase (also from the quick-verse bar); media split into images / animated clips with names, tooltips and animated thumbnails.
- **1.12:** **Alerts** — nursery, message (auto-display / rotate), foldback (stage only), tokens (clock, countdowns, timer); **Stage display** window; template import/export.
- **1.13 (this release):** **Screens** panel (count screens, choose Output and Stage screen, Identify); **no bundled Bible** (+ 🗑 remove a Bible version); **Developer Features** (password-gated GitHub sync, works with any repository so it runs on Cloudflare).

## 5. v1.13.0 details worth knowing

**Screens (🖵 button next to Open Output)**
- Uses the browser Window Management API (`getScreenDetails`) — Chrome/Edge over https, permission "Window management". Other browsers get a simple "1 / 2+ screens" label and a manual-placement note.
- Output and Stage screens are chosen from the detected list; saved in `dow.scr` by screen position+size (falls back to the screen name). "Automatic" = Output → first screen that isn't the operator's; Stage → another free screen.
- **Identify** opens a short-lived marker window on a screen showing its number/name/role. Live updates on plug/unplug (`screenschange`). Warns if both roles share a screen or a saved screen is missing.
- Windows open at the chosen screen's available area; Output uses the existing fullscreen hand-off; Stage requests fullscreen via the `sready` handshake.

**No bundled Bible.** `boot()` no longer fetches `niv.ewb`/`niv.json`. The app starts empty and tells the user to import their own `.ewb`/`.json`. Bibles already stored in someone's browser are untouched (remove with 🗑).

**Developer Features** — link at the bottom of the right-hand panel. Contents: GitHub sync (repository `owner/name`, optional folder and branch, "sync automatically at start-up", Sync now) and a Lock button. Gate = SHA-256 of `salt + password` compared in the browser; the password is **not** in the source in plain text; flag stored in `dow.dev`. **Sync (manual and automatic) only runs while unlocked.** On `*.github.io` the repository is auto-detected; on any other host (Cloudflare) it must be entered. Uses the unauthenticated GitHub API (≈60 requests/hour per IP; private repos cannot be read).

> **Security reality check:** this lock is a convenience, not security. All code is delivered to the browser, so anyone can read it, remove the check, or brute-force a guessable password (an email address is guessable). Do not rely on it to protect paid features or content.

## 6. Commercialization — context for the other chat

Stated by Darryl; **not built yet**:
- Plan to commercialize as a **secured web application** with paid access to enhanced features (comparable services mentioned: Canva, Clipchamp). To be designed in a separate chat in this project.
- Earlier-stated related plans: a demo version for controlled beta testing and a full commercial version; packaging as an installable Windows `.exe`; the commercial build ships **without** a preinstalled Bible, users import their own `.ewb`/`.json` to reduce copyright risk.

Things the architecture means for that work:
1. **Everything is client-side.** To actually protect paid features you need a server: user accounts, a licence/entitlement check, and ideally premium logic or data served from an API after sign-in. Minifying/obfuscating the HTML slows copying but is not protection.
2. **Content licensing** deserves a proper review (ideally with a lawyer): `.ewb` import of users' own EasyWorship Bibles, the **Online tab** (displays third-party Bible sites inside the app), imported fonts, and the sample/default content.
3. **Data lives in the user's browser** (IndexedDB/localStorage), per address. A commercial product needs a decision on cloud sync/backup, and on what happens when the address changes.
4. **Entitlements/payments:** a hosted provider (e.g. Stripe or Paddle) plus a small backend (Cloudflare Workers/Pages Functions would fit the current host) is the usual shape.
5. The Developer-Features gate and the GitHub sync should be removed or moved server-side in a commercial build.

## 7. Requested but NOT yet built

Asked for earlier in this project and still open:
- **Type-your-own scrolling message** along the bottom of the screen, with a choice of direction (right→left or left→right). *(Today: alert text can scroll right→left in a top/bottom bar via Alerts → Message → Appearance → Motion; no direction option and no quick "type & run" box.)*
- **Time settings** (clock format, seconds, time zone / adjustment) and **pre-made, customisable timers** for the "time check" feature (today: clock/countdown/timer tokens exist but there are no presets and tokens can't be edited after creation).

## 8. Known limitations / gotchas

- Screen detection and window placement: Chrome/Edge only; fullscreen always needs a user gesture (the app delegates it from a click).
- Stage display needs `BroadcastChannel` (all current browsers).
- Alerts are intentionally **not** persisted across a reload (saved messages, tokens and appearance are).
- PPTX decks imported before v1.10.0 have no original file stored → re-import once to export them.
- `.wmv` video usually won't play in browsers — convert to `.mp4`.
- Camera/screen/audio all need https (Cloudflare provides it) and the user's permission.
- GitHub sync downloads whole files into IndexedDB; large repositories take time and storage.

## 9. How it was tested (so the next chat can repeat it)

Each release was verified with **Playwright + headless Chromium**: a local `python -m http.server`, a test copy of `index.html` with a small `window.__T = {…}` hook object injected just before the start-up line (never shipped), Chromium flags `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` for camera tests, a mocked `getScreenDetails` for multi-monitor tests, `--host-resolver-rules` to imitate `*.github.io` / `*.pages.dev` addresses, and a mocked GitHub API. Suites covered: camera + export, song/Bible search + media tab, alerts + stage + templates transfer, screens + developer features + sync. Not tested on real hardware: projector/second monitor, real capture cards, phones, Safari/Firefox.

## 10. Starting prompt for a new chat

> I'm continuing DOW Software (Dawn of Worship). Read `handoff.md`, then I'll upload the current `index.html`, `sw.js`, `manifest.webmanifest` and the two icons (v1.13.0). Deliver each release as the full set of 5 files, bump `DOW_VERSION` and `sw.js` `VERSION`, and add a line to the changelog at the top of `index.html`.
