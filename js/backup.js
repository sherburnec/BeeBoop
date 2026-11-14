import * as db from "./db.js";
import * as audio from "./audio.js";

export class BackupError extends Error {}

const SETTING_TYPES = { overlap: "boolean", loop: "boolean", groupView: "boolean", volume: "number" };

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Builds the file as chunks (one per sound) so the whole library is never
// held as a single string.
export async function buildBackup() {
  const [sounds, groups] = await Promise.all([db.getAllSounds(), db.getAllGroups()]);
  const settings = {};
  for (const key of Object.keys(SETTING_TYPES)) {
    const value = await db.getSetting(key, undefined);
    if (value !== undefined) settings[key] = value;
  }
  const exportedAt = new Date().toISOString();
  const parts = [
    `{"app":"beeboop","version":1,"exportedAt":${JSON.stringify(exportedAt)},` +
    `"settings":${JSON.stringify(settings)},"groups":${JSON.stringify(groups)},"sounds":[`,
  ];
  for (let i = 0; i < sounds.length; i++) {
    const s = sounds[i];
    const entry = {
      id: s.id, name: s.name, color: s.color, emoji: s.emoji, order: s.order,
      groupId: s.groupId, mime: s.mime, dataBase64: await blobToBase64(s.blob),
    };
    parts.push((i ? "," : "") + JSON.stringify(entry));
  }
  parts.push("]}");
  return new File(parts, `beeboop-backup-${exportedAt.slice(0, 10)}.json`, { type: "application/json" });
}

// Returns "shared", "downloaded" or "cancelled".
export async function deliverBackup(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if (err.name === "AbortError") return "cancelled";
      // e.g. NotAllowedError when building took longer than the tap's validity: download instead.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "downloaded";
}

const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function validate(d) {
  const bad = (why) => { throw new BackupError(`This is not a valid BeeBoop backup (${why}).`); };
  if (!isObj(d)) bad("wrong structure");
  if (d.app !== "beeboop") bad("wrong app");
  if (d.version !== 1) bad("unsupported version");
  if (!Array.isArray(d.groups) || !Array.isArray(d.sounds)) bad("missing lists");
  if (!isObj(d.settings)) bad("missing settings");
  for (const [k, type] of Object.entries(SETTING_TYPES)) {
    if (k in d.settings && typeof d.settings[k] !== type) bad(`setting ${k}`);
  }
  const groupIds = new Set();
  for (const g of d.groups) {
    if (!isObj(g) || !isStr(g.id) || !g.id || !isStr(g.name) || !isNum(g.order) || groupIds.has(g.id)) bad("group entry");
    groupIds.add(g.id);
  }
  const soundIds = new Set();
  for (const s of d.sounds) {
    if (!isObj(s) || !isStr(s.id) || !s.id || soundIds.has(s.id)) bad("sound entry");
    if (!isStr(s.name) || !isStr(s.color) || !isStr(s.emoji) || !isNum(s.order) || !isStr(s.mime)) bad("sound fields");
    if (s.groupId !== null && !groupIds.has(s.groupId)) bad("unknown group");
    if (!isStr(s.dataBase64) || !s.dataBase64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s.dataBase64)) bad("audio data");
    soundIds.add(s.id);
  }
}

// Parses and validates without touching the database.
export async function readBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new BackupError("This file is not a valid backup (it could not be read as JSON).");
  }
  validate(data);
  return data;
}

// Decodes everything first, then writes in one transaction. Any failure
// leaves the existing library untouched.
export async function restoreBackup(data, mode) {
  const replace = mode === "replace";
  const existingSounds = replace ? [] : await db.getAllSounds();
  const existingGroups = replace ? [] : await db.getAllGroups();
  const usedSoundIds = new Set(existingSounds.map((s) => s.id));
  const usedGroupIds = new Set(existingGroups.map((g) => g.id));
  const soundBase = existingSounds.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  const groupBase = existingGroups.reduce((m, g) => Math.max(m, g.order), -1) + 1;

  const groupIdMap = new Map();
  const groups = [...data.groups].sort((a, b) => a.order - b.order).map((g, i) => {
    const id = usedGroupIds.has(g.id) ? crypto.randomUUID() : g.id;
    groupIdMap.set(g.id, id);
    return { id, name: g.name, order: groupBase + i };
  });

  const sounds = [];
  const buffers = new Map();
  const sorted = [...data.sounds].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    let blob;
    let buffer;
    try {
      blob = base64ToBlob(s.dataBase64, s.mime);
      buffer = await audio.decode(await blob.arrayBuffer());
    } catch {
      throw new BackupError(`The audio for "${s.name}" in this backup could not be read. Nothing was changed.`);
    }
    const id = usedSoundIds.has(s.id) ? crypto.randomUUID() : s.id;
    buffers.set(id, buffer);
    sounds.push({
      id, name: s.name, color: s.color, emoji: s.emoji, order: soundBase + i,
      groupId: s.groupId === null ? null : groupIdMap.get(s.groupId),
      mime: s.mime, blob, size: blob.size, createdAt: Date.now(),
    });
  }

  const settings = [];
  if (replace) {
    for (const key of Object.keys(SETTING_TYPES)) {
      if (key in data.settings) settings.push({ key, value: data.settings[key] });
    }
    const last = await db.getSetting("lastBackupAt", undefined);
    if (last !== undefined) settings.push({ key: "lastBackupAt", value: last });
  }

  await db.writeLibrary({ sounds, groups, settings }, replace);

  if (replace) audio.clearBuffers();
  buffers.forEach((buf, id) => audio.cacheBuffer(id, buf));
}
