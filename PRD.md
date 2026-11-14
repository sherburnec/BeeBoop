# PRD: BeeBoop (PWA Soundboard)

## 1. Problem Statement and Goals

**Problem:** There is no simple, offline, free way to keep a personal set of audio clips on an iPhone and trigger them instantly with one tap. Existing apps are ad-supported, need accounts, or ship fixed sound sets.

**Goals:**
- Let the user import their own audio files and play them from large buttons.
- Play with low latency, including when the iPhone is on silent.
- Work fully offline after first load, installed to the Home Screen.
- Protect the user's library against Safari data eviction with a backup file.

## 2. Target User and Use Cases

**User:** A single iPhone owner (iPhone 17, latest iOS, Safari) who wants a personal soundboard.

**Primary use cases:**
1. Import a batch of audio files from the Files app and get a button for each.
2. Tap a button to play a sound immediately.
3. Organize buttons: rename, recolor, add an emoji, reorder, delete.
4. Play sounds with no network connection.
5. Back up the library to a file and restore it later (new device, or after eviction).

## 3. Functional Requirements

Each requirement is testable on a real iPhone.

**Add sounds**
- FR-1: A single "Add sounds" control opens the iOS Files picker (`<input type="file" accept="audio/*" multiple>`).
- FR-2: Selecting N files creates N buttons. Each default name is the filename without extension.
- FR-3: Each imported file is decoded and stored in IndexedDB (blob + metadata). After an app restart, the sound is still present and playable.
- FR-4: If a file cannot be decoded, no button is created and the user sees a message naming the file. Other files in the same batch still import.

**Edit**
- FR-5: The user can rename a sound. The new name persists after restart. Empty names are rejected.
- FR-6: The user can delete a sound after a confirmation. Its blob and metadata are removed from IndexedDB.
- FR-7: The user can reorder buttons. The order persists after restart.
- FR-8: The user can set a color per button from a fixed palette of light pastel colors, and an optional emoji. Both persist after restart. Button text is dark so it meets contrast (NFR-12).

**Playback**
- FR-9: Tapping a button plays that sound from the start via Web Audio (decoded AudioBuffer).
- FR-10: **Retrigger behavior: stop.** Tapping a button that is already playing stops it. Tapping it again plays it from the start. This is fixed, not a setting.
- FR-11: A global "Overlap" toggle. On: multiple sounds play at once. Off: starting a sound stops any other playing sound. The setting persists. Default: on.
- FR-12: A volume control sets master output level from 0 to 100%. The setting persists.
- FR-13: A global "Stop all" control stops every playing sound.
- FR-14: The AudioContext is created or resumed on the first user tap. `navigator.audioSession.type = "playback"` is set where supported.
- FR-15: A button shows a visible playing state while its sound plays.

**Loop and groups**
- FR-22: A global "Loop" toggle. On: every sound repeats until stopped by tapping it again or by "Stop all". Off: sounds play once. The setting persists. Default: off.
- FR-23: By default all sounds show in one flat grid (no groups).
- FR-24: The user can create, rename, reorder and delete groups. Deleting a group keeps its sounds and makes them ungrouped.
- FR-25: The user can assign a sound to one group, or to none, from its edit sheet. Assignment persists after restart.
- FR-26: A global "Group view" toggle. Off (default): flat grid, groups ignored. On: sounds appear under their group's heading, with ungrouped sounds under "Ungrouped". The setting persists. Sound order within a group follows the sound's order.

**Backup**
- FR-16: "Export backup" produces one JSON file containing all sounds (base64 audio + names, colors, emoji, order, group), all groups, and settings, and offers it via the iOS share sheet or download.
- FR-17: "Import backup" reads such a file and restores the library. The user chooses Replace or Merge before it is applied. The exact format is defined in PLAN.md.
- FR-18: Import of an invalid or corrupt backup file changes nothing and shows an error.

**Offline / install**
- FR-19: The app installs via Safari "Add to Home Screen" and launches standalone with its own icon and name.
- FR-20: After first load, the app launches and plays all stored sounds with the device in airplane mode.
- FR-21: The app makes no network requests after first load, other than the service worker checking for updated app files.

## 4. Non-Functional Requirements

**Latency**
- NFR-1: Tap-to-sound target is 50 ms or less on iPhone 17 once the AudioContext is running. Measured by comparing a recorded tap and waveform start, or by a timestamped log from touch event to `start()`.
- NFR-2: Buffers for all sounds are decoded and ready before the first tap where possible. A sound that is not yet decoded shows a loading state instead of silently failing.

**Storage**
- NFR-3: The app requests persistent storage (`navigator.storage.persist()`) where supported.
- NFR-4: The app shows current usage and quota (`navigator.storage.estimate()`) in a settings area.
- NFR-4a: The app enforces no maximum file size, duration, or sound count. The only limit is device storage and memory.
- NFR-5: If a write fails due to quota, the import stops for that file, the user sees a clear "storage full" message, and existing sounds are untouched. No partial or corrupt records are left.
- NFR-6: No audio data is stored in localStorage. localStorage holds only small UI preferences.

**Offline**
- NFR-7: All app files (HTML, CSS, JS, icons, manifest) are precached by the service worker. A new version of the app takes effect on a later launch without breaking stored data.

**Layout and accessibility**
- NFR-8: All tappable controls are at least 44x44 px.
- NFR-9: Safe-area insets are respected. No content sits under the notch, Dynamic Island, or home indicator.
- NFR-10: The layout works in portrait and landscape.
- NFR-11: Every control has an accessible name (label or `aria-label`). Buttons are real `<button>` elements. VoiceOver can reach and activate every control.
- NFR-12: Text and button colors meet WCAG AA contrast (4.5:1 for text). The palette is chosen to satisfy this.
- NFR-13: Respects the user's Reduce Motion setting.

## 5. Out of Scope

- User accounts or login
- Cloud sync or any backend
- In-app audio recording
- App Store / native build
- Platforms other than iPhone Safari (Android, desktop, iPad are not targeted)
- Audio editing (trim, fade, effects)
- Loading sounds from URLs

## 6. Known iOS Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Silent switch** mutes Web Audio by default | Set `navigator.audioSession.type = "playback"` where supported. Document in Settings help text if it still mutes on a given iOS version. |
| **Audio unlock:** AudioContext starts suspended and needs a user gesture | Create or resume the AudioContext inside the first tap handler. Resume again if state becomes `suspended` or `interrupted` (e.g. after a call or app switch). |
| **Storage eviction:** Safari can delete site data for unused sites; Home Screen installs are less affected but not immune | Request persistent storage. Provide Export/Import backup. Show "last backup" date in Settings. |
| **Storage quota** | Show usage. Handle write failures per NFR-5. |
| **Unsupported formats:** iOS Safari decodes mp3, m4a/AAC, wav, and generally caf/aiff. Some ogg/opus and flac files fail or behave inconsistently. | Rely on decode check at import. Reject undecodable files with a clear message (FR-4). Tell the user to convert unsupported files to mp3, m4a or wav. |
| **Large files** use a lot of memory once decoded to AudioBuffer | No limit is enforced. If decoding fails (e.g. out of memory), treat it as an undecodable file (FR-4) and show the message. |
| **Service worker cache staleness** | Version the cache name. Delete old caches on activate. |
| **Backup file size** equals the full library size | Build the backup in a streaming or chunked way where feasible. Report errors instead of failing silently. |

## 7. Acceptance Criteria

- [ ] Installs to the Home Screen from Safari and opens standalone with the correct icon and name.
- [ ] Add sounds opens the Files picker and imports multiple mp3, m4a and wav files in one go.
- [ ] An undecodable file is rejected with a message and does not block the rest of the batch.
- [ ] Sounds, names, colors, emoji and order all survive a full app close and relaunch.
- [ ] Rename, delete (with confirmation), reorder, color and emoji all work.
- [ ] Tap plays the sound; tapping it again while playing stops it.
- [ ] Overlap toggle behaves as specified in both states.
- [ ] Loop toggle repeats sounds until stopped, and persists.
- [ ] Groups can be created, renamed, reordered and deleted; sounds can be assigned; Group view on/off switches between grouped and flat display, and persists.
- [ ] Fixed pastel palette is used for button colors, and text meets contrast.
- [ ] Volume control changes loudness and persists.
- [ ] Stop all stops every playing sound.
- [ ] Sound plays with the iPhone silent switch on.
- [ ] Sound plays after switching away from the app and back, and after a phone call or Siri interruption.
- [ ] Airplane mode: app launches and plays all sounds.
- [ ] Export backup produces a single file. Importing it on a cleared install restores every sound with identical audio and metadata.
- [ ] Corrupt backup import changes nothing and shows an error.
- [ ] Storage-full case shows a clear message and loses no existing data.
- [ ] Tap-to-sound latency is 50 ms or less in manual measurement.
- [ ] All controls are at least 44x44 px.
- [ ] No content is obscured by safe areas in portrait or landscape.
- [ ] VoiceOver can operate every control.
- [ ] No audio data in localStorage. No network requests after first load.

## 8. Open Questions

Resolved: stop on second tap; JSON with base64 backup; Replace/Merge by user choice; no size limit; fixed pastel palette; GitHub Pages; global loop toggle; flat by default with optional groups.

Also resolved: app name is **BeeBoop** (used in `manifest.webmanifest`, `<title>`, and under the Home Screen icon); the user supplies the icon PNGs; the palette has 8 pastel colors; group rules as written in FR-24 to FR-26 are confirmed (one group per sound, deleting a group ungroups its sounds, global Group view toggle).

Still open: none.
