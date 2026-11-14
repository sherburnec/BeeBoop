import * as db from "./db.js";
import * as audio from "./audio.js";
import * as ui from "./ui.js";
import { requestPersistence } from "./storage.js";
import { PALETTE } from "./palette.js";

const state = {
  sounds: [],
  groups: [],
  settings: { overlap: true, loop: false, volume: 1, groupView: false },
  failed: new Set(),
  edit: false,
};

const $ = (id) => document.getElementById(id);
const addBtn = $("add-btn");
const fileInput = $("file-input");
const stopBtn = $("stop-btn");
const overlapBtn = $("overlap-btn");
const loopBtn = $("loop-btn");
const editBtn = $("edit-btn");
const groupViewBtn = $("groupview-btn");
const volumeInput = $("volume");

function refresh() {
  ui.refreshStates({ isPlaying: audio.isPlaying, hasBuffer: audio.hasBuffer, failed: state.failed });
}

function render() {
  ui.renderGrid(state.sounds, {
    onTap, onMove, edit: state.edit, groupView: state.settings.groupView, groups: state.groups,
  });
  ui.renderGroupsPanel(state.groups, state.edit, {
    onAdd: onGroupAdd, onRename: onGroupRename, onDelete: onGroupDelete, onMove: onGroupMove,
  });
  refresh();
}

function askGroupName(initial) {
  const name = window.prompt("Group name", initial);
  if (name === null) return null;
  if (!name.trim()) {
    ui.showMessage("Group names can't be empty.");
    return null;
  }
  return name.trim();
}

async function onGroupAdd() {
  const name = askGroupName("");
  if (!name) return;
  const order = state.groups.reduce((m, g) => Math.max(m, g.order), -1) + 1;
  const group = { id: crypto.randomUUID(), name, order };
  try {
    await db.addGroup(group);
  } catch {
    ui.showMessage("Could not create the group.");
    return;
  }
  state.groups.push(group);
  render();
}

async function onGroupRename(id) {
  const group = state.groups.find((g) => g.id === id);
  const name = askGroupName(group.name);
  if (!name) return;
  try {
    await db.updateGroup(id, { name });
  } catch {
    ui.showMessage("Could not rename the group.");
    return;
  }
  group.name = name;
  render();
}

async function onGroupDelete(id) {
  const group = state.groups.find((g) => g.id === id);
  if (!window.confirm(`Delete group "${group.name}"? Its sounds are kept and become ungrouped.`)) return;
  try {
    await db.deleteGroup(id);
  } catch {
    ui.showMessage("Could not delete the group.");
    return;
  }
  state.groups = state.groups.filter((g) => g.id !== id);
  state.sounds.forEach((s) => { if (s.groupId === id) s.groupId = null; });
  render();
}

async function onGroupMove(id, neighborId) {
  const a = state.groups.find((g) => g.id === id);
  const b = state.groups.find((g) => g.id === neighborId);
  try {
    await Promise.all([db.updateGroup(a.id, { order: b.order }), db.updateGroup(b.id, { order: a.order })]);
  } catch {
    ui.showMessage("Could not save the new group order.");
    return;
  }
  [a.order, b.order] = [b.order, a.order];
  state.groups.sort((x, y) => x.order - y.order);
  render();
}

function onTap(id) {
  if (state.edit) {
    ui.openEditSheet(state.sounds.find((s) => s.id === id), state.groups, { onSave, onDelete });
    return;
  }
  if (!audio.hasBuffer(id)) return;
  audio.toggle(id, state.settings);
}

async function onSave(id, changes) {
  try {
    await db.updateSound(id, changes);
    Object.assign(state.sounds.find((s) => s.id === id), changes);
    render();
  } catch (err) {
    ui.showMessage(db.isQuotaError(err) ? "Storage is full. Your change was not saved." : "Could not save your change.");
  }
}

async function onDelete(id) {
  try {
    await db.deleteSound(id);
  } catch {
    ui.showMessage("Could not delete that sound.");
    return;
  }
  audio.dropBuffer(id);
  state.failed.delete(id);
  state.sounds = state.sounds.filter((s) => s.id !== id);
  render();
}

// Swaps the order values of two sounds and persists both.
async function onMove(id, neighborId) {
  const a = state.sounds.find((s) => s.id === id);
  const b = state.sounds.find((s) => s.id === neighborId);
  try {
    await Promise.all([db.updateSound(a.id, { order: b.order }), db.updateSound(b.id, { order: a.order })]);
  } catch {
    ui.showMessage("Could not save the new order.");
    return;
  }
  [a.order, b.order] = [b.order, a.order];
  state.sounds.sort((x, y) => x.order - y.order);
  render();
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
  groupViewBtn.addEventListener("click", () => {
    const on = !state.settings.groupView;
    ui.setToggle(groupViewBtn, on);
    setSetting("groupView", on);
    render();
  });
  editBtn.addEventListener("click", () => {
    state.edit = !state.edit;
    ui.setToggle(editBtn, state.edit);
    render();
  });
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
  s.groupView = await db.getSetting("groupView", false);
  ui.setToggle(loopBtn, s.loop);
  ui.setToggle(groupViewBtn, s.groupView);
  volumeInput.value = Math.round(s.volume * 100);
  audio.setVolume(s.volume);
  state.sounds = await db.getAllSounds();
  state.groups = await db.getAllGroups();
  render();
  await decodeAll();
  requestPersistence();
}

init().catch((err) => {
  console.error(err);
  ui.showMessage("Could not open the sound library on this device.");
});
