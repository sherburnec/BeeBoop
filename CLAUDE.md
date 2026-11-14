# CLAUDE.md

## Project
BeeBoop, a soundboard PWA for iPhone Safari. Users import their own audio files via the iOS Files picker and tap large buttons to play them with low latency. Everything is stored on-device in IndexedDB. It installs via Add to Home Screen and works fully offline. Requirements are in PRD.md; the build order is in PLAN.md.

## Locked decisions (do not revisit)
- Vanilla HTML, CSS, JavaScript (ES modules). No framework, no build step, no npm dependencies.
- Static hosting only (GitHub Pages or Netlify). No backend, no accounts, no network calls after first load.
- Install via Safari Add to Home Screen: `manifest.webmanifest`, icons, service worker.
- Import with `<input type="file" accept="audio/*" multiple>`.
- Audio blobs and sound metadata live in IndexedDB. Never put audio in localStorage. localStorage is for tiny UI prefs only.
- Playback uses the Web Audio API with decoded AudioBuffers. Create or resume the AudioContext on the first user tap. Set `navigator.audioSession.type = "playback"` where supported.
- Export backup and Import backup (single file containing the audio) are required.
- Target is iOS Safari on iPhone only. Mobile-first, 44px minimum touch targets, safe-area insets, portrait and landscape.
- Tapping a playing sound stops it. Loop is a global toggle. Sounds are a flat grid by default, with optional groups (global "Group view" toggle).
- Button colors come from a fixed light pastel palette of 8 colors.
- With Overlap off, starting any sound stops the others, including looping ones.
- The user supplies icon PNGs. Do not generate icons.
- No maximum file size is enforced.
- Backup is one JSON file with base64 audio.

## Code conventions
- Plain ES modules. Small files, one responsibility each.
- Use relative paths everywhere (the site is served from a subpath on GitHub Pages).
- Comments only where the reason is not obvious (iOS quirks, workarounds).
- Use real `<button>` elements and accessible names.

## Rules
- Only make changes directly requested. Do not add extra files, abstractions, frameworks, or features.
- Follow PLAN.md milestones in order.
- Update PLAN.md checkboxes when a milestone is complete.
- A milestone is complete only when its "Done when" check passes. Report what was actually verified and what was not.
- If something is not specified, ask. Do not guess.

## Stop and ask before
- Adding any dependency (npm, CDN script, font, library).
- Deleting any file.
- Changing the IndexedDB schema or the backup file format.
- Deviating from PRD.md.

## How to run locally
Not yet set up. Planned: from the project root run `python -m http.server 8080` and open `http://localhost:8080`. Real-device testing needs HTTPS (tunnel or deploy); see PLAN.md "Testing on a Real iPhone". Update this section once confirmed.

## Testing
No automated test setup. Verify manually in a browser and on a real iPhone per each milestone's "Done when". Add no test framework without asking.
