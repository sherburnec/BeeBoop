# BeeBoop

A soundboard Progressive Web App for iPhone Safari. Import your own audio files, then tap large buttons to play them with low latency. Everything is stored on the device and the app works fully offline once installed.

## Features

- Import audio from the Files app (mp3, m4a, wav and other formats iOS can decode). Files that can't be decoded are skipped with a message.
- Tap a sound to play it; tap it again to stop it. Plays with the silent switch on (where iOS supports it).
- Global toggles: **Overlap**, **Loop**, **Group view**. Plus a volume slider and **Stop all**.
- Edit mode: rename, recolor (8 pastel colors), add an emoji, reorder, delete.
- Optional groups, shown as sections when Group view is on.
- Export and import a single-file JSON backup (audio included as base64), with Replace or Merge on import.
- Installs via Safari **Share > Add to Home Screen**. No accounts, no backend, no network calls after first load.

## Tech

Vanilla HTML, CSS and JavaScript (ES modules). No framework, no build step, no dependencies. Audio is decoded with the Web Audio API; sounds and settings live in IndexedDB.

```
index.html, manifest.webmanifest, sw.js
css/app.css
js/  main.js  db.js  audio.js  ui.js  backup.js  storage.js  palette.js
icons/
```

## Run locally

From the project root:

```
python -m http.server 8080
```

Open `http://localhost:8080`. Real-device testing (audio unlock, silent switch, Files picker, install, service worker) needs HTTPS; see "Testing on a Real iPhone" in [PLAN.md](PLAN.md).

## Deploy

Static hosting only (GitHub Pages or Netlify). All paths are relative, so it works under a subpath such as `/<repo>/`. Steps are in [PLAN.md](PLAN.md).

When any app file changes, bump `CACHE_VERSION` in [sw.js](sw.js). A new version takes effect on the next app launch.

## Status

Milestones 1-7 are implemented and were checked in desktop Edge. Milestone 8 (iPhone testing against every item in [PRD.md](PRD.md) section 7) is outstanding. The files in `icons/` are blank placeholders until the real artwork is added.

## Project docs

- [PRD.md](PRD.md): requirements and acceptance criteria
- [PLAN.md](PLAN.md): milestones, storage schema, backup format, testing and deployment
- [CLAUDE.md](CLAUDE.md): project conventions
