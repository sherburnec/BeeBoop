import * as db from "./db.js";
import * as audio from "./audio.js";
import * as ui from "./ui.js";
import { requestPersistence } from "./storage.js";
import { PALETTE } from "./palette.js";

const state = {
  sounds: [],
  settings: { overlap: true, loop: false, volume: 1 },
  failed: new Set(),
};

const $ = (id) => document.getElementById(id);
const addBtn = $("add-btn");
const fileInput = $("file-input");
const stopBtn = $("stop-btn");
const overlapBtn = $("overlap-btn");
const loopBtn = $("loop-btn");
const volumeInput = $("volume");

function refresh() {
  ui.refreshStates({ isPlaying: audio.isPlaying, hasBuffer: audio.hasBuffer, failed: state.failed });
}

function render() {
  ui.renderGrid(state.sounds, { onTap });
  refresh();
}

function onTap(id) {
  if (!audio.hasBuffer(id)) return;
  audio.toggle(id, state.settings);
}

async function decodeAll() {
  // One at a time to keep peak memory down.
  for (const sound of state.sounds) {
    if (audio.hasBuffer(sound.id)) continue;
    try {
      await audio.loadSound(sound.id, sound.blob);
    } catch {
      state.failed.add(sound.id);
      ui.showMessage(`Could not load "${sound.name}". It may be in an unsupported format.`);
    }
    refresh();
  }
}

function stripExtension(name) {
  return name.replace(/\.[^./\\]+$/, "") || name;
}

async function importFiles(files) {
  const rejected = [];
  let order = state.sounds.reduce((m, s) => Math.max(m, s.order), -1);
  for (const file of files) {
    let bytes;
    let buffer;
    try {
      bytes = await file.arrayBuffer();
      buffer = await audio.decode(bytes.slice(0)); // decode consumes its input
    } catch {
      rejected.push(file.name);
      continue;
    }
    const sound = {
      id: crypto.randomUUID(),
      name: stripExtension(file.name),
      color: PALETTE[0].hex,
      emoji: "",
      order: ++order,
      groupId: null,
      mime: file.type,
      blob: new Blob([bytes], { type: file.type }),
      size: file.size,
      createdAt: Date.now(),
    };
    try {
      await db.addSound(sound);
    } catch (err) {
      if (db.isQuotaError(err)) {
        ui.showMessage(`Storage is full. Import stopped at "${file.name}". Existing sounds are untouched.`);
        render();
        return;
      }
      rejected.push(file.name);
      continue;
    }
    audio.cacheBuffer(sound.id, buffer);
    state.sounds.push(sound);
    render();
  }
  if (rejected.length) {
    ui.showMessage(`Could not import: ${rejected.join(", ")}. Convert unsupported files to mp3, m4a or wav.`);
  }
}

async function setSetting(key, value) {
  state.settings[key] = value;
  try {
    await db.setSetting(key, value);
  } catch {
    ui.showMessage("Could not save that setting.");
  }
}

function wireToolbar() {
  addBtn.addEventListener("click", () => {
    audio.unlock();
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (files.length) {
      await importFiles(files);
      requestPersistence();
    }
  });
  stopBtn.addEventListener("click", () => audio.stopAll());
  overlapBtn.addEventListener("click", () => {
    const on = !state.settings.overlap;
    ui.setToggle(overlapBtn, on);
    setSetting("overlap", on);
  });
  loopBtn.addEventListener("click", () => {
    const on = !state.settings.loop;
    ui.setToggle(loopBtn, on);
    audio.setLoop(on);
    setSetting("loop", on);
  });
  volumeInput.addEventListener("input", () => audio.setVolume(volumeInput.value / 100));
  volumeInput.addEventListener("change", () => setSetting("volume", volumeInput.value / 100));
}

async function init() {
  wireToolbar();
  audio.setOnChange(refresh);
  const s = state.settings;
  s.overlap = await db.getSetting("overlap", true);
  s.loop = await db.getSetting("loop", false);
  s.volume = await db.getSetting("volume", 1);
  ui.setToggle(overlapBtn, s.overlap);
  ui.setToggle(loopBtn, s.loop);
  volumeInput.value = Math.round(s.volume * 100);
  audio.setVolume(s.volume);
  state.sounds = await db.getAllSounds();
  render();
  await decodeAll();
  requestPersistence();
}

init().catch((err) => {
  console.error(err);
  ui.showMessage("Could not open the sound library on this device.");
});
