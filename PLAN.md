# PLAN: BeeBoop (PWA Soundboard)

Follow milestones in order. Tick checkboxes when done. Each milestone ends with a binary "Done when" check. Requirement IDs refer to PRD.md.

## Proposed Structure

```
/
  index.html
  manifest.webmanifest
  sw.js
  css/
    app.css
  js/
    main.js          # entry: wires modules, event handlers
    db.js            # IndexedDB wrapper (sounds, settings)
    audio.js         # AudioContext, buffer cache, play/stop, volume
    ui.js            # render grid, dialogs, messages
    backup.js        # export / import
    storage.js       # persist(), estimate(), quota handling
  icons/
    icon-180.png
    icon-192.png
    icon-512.png
    icon-maskable-512.png
  PRD.md
  PLAN.md
  CLAUDE.md
```

Files appear only in the milestone that needs them. Keep files small.

**Storage schema (v1):** IndexedDB database `soundboard`, version 1.
- Store `sounds`: key `id` (string). Fields: `id`, `name`, `color`, `emoji`, `order`, `groupId` (null = ungrouped), `mime`, `blob`, `size`, `createdAt`.
- Store `groups`: key `id` (string). Fields: `id`, `name`, `order`.
- Store `settings`: key `key`. Fields: `key`, `value`. Holds `overlap`, `loop`, `groupView`, `volume`, `lastBackupAt`.

**Backup format (v1):** one `.json` file: `{ "app": "beeboop", "version": 1, "exportedAt": ..., "settings": {...}, "groups": [{ id, name, order }], "sounds": [{ id, name, color, emoji, order, groupId, mime, dataBase64 }] }`.

---

## Milestone 1: Static shell and manifest
- [x] Complete

**Goal:** An installable-looking empty app that loads on a phone.

**Files touched:** `index.html`, `manifest.webmanifest`, `css/app.css`, `js/main.js`, `icons/*`

**Tasks:**
- [x] `index.html` with viewport meta (`viewport-fit=cover`), title, manifest link, `apple-touch-icon`, `apple-mobile-web-app-capable`, status bar meta, and a `<main>` for the grid plus a toolbar.
- [x] `manifest.webmanifest`: name, short_name, `display: standalone`, `start_url`, `scope`, theme and background colors, icons (192, 512, maskable).
- [ ] Icons: the user supplies the PNGs (`icon-180`, `icon-192`, `icon-512`, `icon-maskable-512`). Do not generate them. Reference the paths and wait; use a temporary blank file only if told to.
- [x] App name "BeeBoop" in the manifest `name` and `short_name`, `<title>`, and `apple-mobile-web-app-title`.
- [x] `css/app.css`: mobile-first grid, 44px minimum targets, `env(safe-area-inset-*)` padding, portrait and landscape layouts.
- [x] `js/main.js` loaded as `type="module"`, logs on load.
- [x] Relative paths throughout so the app works under a GitHub Pages subpath.

**Done when:** Served over localhost, the page loads with no console errors; the manifest parses in DevTools Application panel with all icons resolving; layout shows no content inside safe areas in a 390px-wide emulated viewport in both orientations.

---

## Milestone 2: IndexedDB layer
- [x] Complete

**Goal:** Persistent storage API for sounds and settings.

**Files touched:** `js/db.js`, `js/storage.js`, `js/main.js`

**Tasks:**
- [x] `db.js`: open DB, create stores per schema. Functions: `addSound`, `getSound`, `getAllSounds` (sorted by `order`), `updateSound`, `deleteSound`, `addGroup`, `getAllGroups`, `updateGroup`, `deleteGroup`, `getSetting`, `setSetting`, `clearAll`.
- [x] Wrap IndexedDB requests in promises. Surface `QuotaExceededError` distinctly.
- [x] `storage.js`: `requestPersistence()` and `getUsage()` using `navigator.storage`, with feature checks.
- [x] Temporary dev check in `main.js`: write a test record, read it back, delete it. Remove after verifying.

**Done when:** In DevTools, the `soundboard` DB shows all three stores (`sounds`, `groups`, `settings`); add, read, update, delete round-trip a test record with a Blob intact (size matches); data remains after page reload; dev check code is removed.

---

## Milestone 3: Import and playback
- [ ] Complete

**Goal:** Add sounds from the Files picker and play them. Covers FR-1 to FR-4, FR-9 to FR-15, NFR-2.

**Files touched:** `index.html`, `js/audio.js`, `js/ui.js`, `js/main.js`, `css/app.css`

**Tasks:**
- [x] File input `accept="audio/*" multiple` behind an "Add sounds" button.
- [x] On import: for each file, read to ArrayBuffer, test with `decodeAudioData`, store blob and metadata in IndexedDB, create button. On decode failure, skip and collect the filename for the message.
- [x] `audio.js`: create or resume AudioContext on the first user tap; resume on `visibilitychange` and when state is `suspended` or `interrupted`; set `navigator.audioSession.type = "playback"` if present.
- [x] Master `GainNode` for volume. Per-play `AudioBufferSourceNode`.
- [x] Buffer cache: decode on load, mark buttons as loading until ready.
- [x] Tap behavior: if the sound is playing, stop it; otherwise play it from the start.
- [x] Overlap toggle, Loop toggle (sets `source.loop`), and volume slider, all persisted via `settings` store. Stop all control.
- [x] Playing-state class on buttons, cleared on `ended`.
- [x] Render grid from DB on load.

**Done when:** On a real iPhone, importing three files (one each of mp3, m4a, wav) creates three buttons that play on tap; an undecodable file shows an error without blocking the others; sounds and settings survive closing and reopening Safari; sound plays with the silent switch on; overlap on/off both behave per FR-11; a second tap stops a playing sound; with Loop on a sound repeats until tapped or Stop all.

---

## Milestone 4: Edit, delete, reorder, color/emoji
- [ ] Complete

**Goal:** Manage the library. Covers FR-5 to FR-8.

**Files touched:** `js/ui.js`, `js/db.js` (only if a missing function is needed), `js/main.js`, `css/app.css`, `index.html`

**Tasks:**
- [x] "Edit" mode toggle in the toolbar. In edit mode, tapping a button opens an edit sheet instead of playing.
- [x] Edit sheet: name field, color choice from fixed palette, emoji field, delete button.
- [x] Reject empty names.
- [x] Delete with confirmation; remove from DB and buffer cache.
- [x] Reorder in edit mode using explicit move controls (up and down or left and right). Touch drag-and-drop is not used by default because it is unreliable on iOS; ask before adding it.
- [x] Persist `order` after each move.
- [x] Fixed palette of light pastel colors (exactly 8) with dark button text, chosen to meet AA contrast.

**Done when:** On iPhone, rename, recolor, set emoji, move and delete a sound; after a full app relaunch every change is still present; deleting a sound removes its record from IndexedDB (verified in Safari Web Inspector).

---

## Milestone 5: Groups
- [ ] Complete

**Goal:** Optional grouping, flat by default. Covers FR-23 to FR-26.

**Files touched:** `js/ui.js`, `js/main.js`, `js/db.js` (only if needed), `css/app.css`, `index.html`

**Tasks:**
- [x] In edit mode: create, rename, reorder (move controls) and delete groups. Deleting a group sets `groupId` to null on its sounds.
- [x] Group picker in the sound edit sheet (one group or none).
- [x] "Group view" toggle persisted in `settings`. Off: flat grid by `order`. On: sections per group in group order, then "Ungrouped".
- [x] Section headings are real headings; sections work in portrait and landscape.

**Done when:** On iPhone, create two groups, assign sounds, switch Group view on and off and see grouped then flat display; after a full relaunch groups, assignments and the toggle are unchanged; deleting a group leaves its sounds playable under Ungrouped.

---

## Milestone 6: Backup export and import
- [ ] Complete

**Goal:** Survive eviction and move libraries. Covers FR-16 to FR-18, NFR-4, NFR-5.

**Files touched:** `js/backup.js`, `js/storage.js`, `js/ui.js`, `js/main.js`, `index.html`

**Tasks:**
- [ ] Settings area with Export, Import, storage usage, and last backup date.
- [ ] Export: build the backup file per format v1, offer via `navigator.share` with a file where supported, else download link fallback.
- [ ] Import: file input, parse and validate (`app`, `version`, field types) before touching the DB.
- [ ] Ask Replace or Merge. Replace clears and writes; merge adds with new ids on collision (remap `groupId` accordingly).
- [ ] Write in a way that a failure leaves existing data intact (validate and decode everything first).
- [ ] Handle `QuotaExceededError` with a clear message.
- [ ] Store `lastBackupAt`.

**Done when:** Export then clear site data then Import restores every sound with identical playback, names, colors, emoji, order, groups and settings; a hand-corrupted file is rejected with an error and the library is unchanged; storage usage displays.

---

## Milestone 7: Service worker and offline
- [ ] Complete

**Goal:** Full offline use. Covers FR-19 to FR-21, NFR-7.

**Files touched:** `sw.js`, `js/main.js`

**Tasks:**
- [ ] `sw.js`: versioned cache name; precache every app file listed in an explicit array; cache-first fetch for same-origin GET; delete old caches on `activate`.
- [ ] Register the service worker from `main.js` after load, with a relative path and scope.
- [ ] Do not cache audio; it lives in IndexedDB.
- [ ] Do not call `skipWaiting` automatically in a way that breaks a running session; new version applies on next launch.

**Done when:** After one online load, with DevTools "Offline" on (desktop) the app reloads and plays stored sounds; on iPhone in airplane mode the Home Screen app launches and plays sounds; bumping the cache version and reloading online replaces old caches.

---

## Milestone 8: Polish and iOS testing
- [ ] Complete

**Goal:** Meet all PRD acceptance criteria on a real device.

**Files touched:** any file, only to fix issues found.

**Tasks:**
- [ ] Walk through every item in PRD.md section 7 on the iPhone. Fix failures.
- [ ] Measure tap-to-sound latency.
- [ ] Test interruptions: phone call, Siri, app switch, lock screen.
- [ ] Test portrait and landscape, notch and home indicator.
- [ ] VoiceOver pass over every control.
- [ ] Test storage-full handling as far as is practical.
- [ ] Empty state message when no sounds exist.
- [ ] Confirm the user's final icon artwork is in place and displays correctly on the Home Screen.

**Done when:** Every checkbox in PRD.md section 7 is ticked after testing on a real iPhone, and no console errors appear in Safari Web Inspector during the run.

---

## Testing on a Real iPhone

Audio unlock, the silent switch, the Files picker, and Home Screen install only behave correctly on a real device. Service workers need HTTPS (localhost is exempt on desktop only).

**Option A: HTTPS tunnel (simplest)**
1. Serve the folder locally: `python -m http.server 8080` (run from the project root).
2. Start a tunnel to port 8080 (for example `cloudflared tunnel --url http://localhost:8080`, or ngrok). Open the `https://` URL on the iPhone.

**Option B: Local HTTPS on the same Wi-Fi**
1. Generate a local certificate with `mkcert`, install its root CA on the iPhone, and trust it in Settings > General > About > Certificate Trust Settings.
2. Serve over HTTPS and open `https://<computer-ip>:<port>` on the iPhone.

**Debugging:** Connect the iPhone by cable, enable Settings > Safari > Advanced > Web Inspector, then use Safari on a Mac. Without a Mac, test by deploying and checking on-screen messages.

**Install test:** Deploy (below), open the site in Safari, Share > Add to Home Screen, launch from the icon, then test in airplane mode. Test installs from the tunnel URL are separate from the deployed one; delete the test icon before installing the real one.

## Deployment (GitHub Pages)

1. Create a GitHub repository and push `main`.
2. Repo Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
3. Wait for the build. The site is at `https://<user>.github.io/<repo>/`.
4. Confirm all paths in `index.html`, `manifest.webmanifest`, and `sw.js` are relative so they work under `/<repo>/`.
5. Open the URL in iPhone Safari, then Share > Add to Home Screen.
6. To release an update: bump the cache version in `sw.js`, push, wait for Pages to rebuild, then open the app online twice (first load fetches the new worker, next launch uses it).
