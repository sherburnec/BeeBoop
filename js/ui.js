import { PALETTE } from "./palette.js";

const grid = document.getElementById("grid");
const messageEl = document.getElementById("message");

export function showMessage(text) {
  messageEl.replaceChildren();
  const span = document.createElement("span");
  span.textContent = text;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Dismiss";
  close.addEventListener("click", () => { messageEl.hidden = true; });
  messageEl.append(span, close);
  messageEl.hidden = false;
}

function soundButton(sound, onTap, edit) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sound";
  btn.dataset.id = sound.id;
  if (sound.color) btn.style.backgroundColor = sound.color;
  if (edit) btn.setAttribute("aria-label", `Edit ${sound.name}`);
  if (sound.emoji) {
    const e = document.createElement("span");
    e.className = "emoji";
    e.textContent = sound.emoji;
    e.setAttribute("aria-hidden", "true");
    btn.append(e);
  }
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = sound.name;
  btn.append(label);
  btn.addEventListener("click", () => onTap(sound.id));
  return btn;
}

function moveButton(text, label, disabled, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "move";
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function tile(sound, siblings, i, { onTap, onMove, edit }) {
  const btn = soundButton(sound, onTap, edit);
  if (!edit) return btn;
  const prev = siblings[i - 1];
  const next = siblings[i + 1];
  const moves = document.createElement("div");
  moves.className = "moves";
  moves.append(
    moveButton("◀", `Move ${sound.name} earlier`, !prev, () => onMove(sound.id, prev.id)),
    moveButton("▶", `Move ${sound.name} later`, !next, () => onMove(sound.id, next.id)),
  );
  const wrap = document.createElement("div");
  wrap.className = "tile";
  wrap.append(btn, moves);
  return wrap;
}

function section(title, sounds, opts) {
  const sec = document.createElement("section");
  sec.className = "group";
  const h = document.createElement("h2");
  h.textContent = title;
  const inner = document.createElement("div");
  inner.className = "section-grid";
  inner.append(...sounds.map((s, i) => tile(s, sounds, i, opts)));
  sec.append(h, inner);
  return sec;
}

// opts: { onTap(id), onMove(id, neighborId), edit, groupView, groups }
// `sounds` is already sorted by order. Move neighbors are within the same section.
export function renderGrid(sounds, opts) {
  grid.classList.toggle("editing", opts.edit);
  grid.classList.toggle("grouped", opts.groupView);
  if (!opts.groupView) {
    grid.replaceChildren(...sounds.map((s, i) => tile(s, sounds, i, opts)));
    return;
  }
  const sections = [];
  for (const g of opts.groups) {
    const members = sounds.filter((s) => s.groupId === g.id);
    if (members.length || opts.edit) sections.push(section(g.name, members, opts));
  }
  const ungrouped = sounds.filter((s) => !s.groupId);
  if (ungrouped.length || !sections.length) sections.push(section("Ungrouped", ungrouped, opts));
  grid.replaceChildren(...sections);
}

const groupsPanel = document.getElementById("groups-panel");
const groupsList = document.getElementById("groups-list");

// handlers: { onAdd, onRename(id), onDelete(id), onMove(id, neighborId) }
export function renderGroupsPanel(groups, visible, handlers) {
  groupsPanel.hidden = !visible;
  if (!visible) return;
  groupsList.replaceChildren(...groups.map((g, i) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "group-name";
    name.textContent = g.name;
    const mk = (text, label, fn, disabled = false) => {
      const b = moveButton(text, label, disabled, fn);
      b.classList.remove("move");
      return b;
    };
    li.append(
      name,
      mk("▲", `Move group ${g.name} up`, () => handlers.onMove(g.id, groups[i - 1].id), i === 0),
      mk("▼", `Move group ${g.name} down`, () => handlers.onMove(g.id, groups[i + 1].id), i === groups.length - 1),
      mk("Rename", `Rename group ${g.name}`, () => handlers.onRename(g.id)),
      mk("Delete", `Delete group ${g.name}`, () => handlers.onDelete(g.id)),
    );
    return li;
  }));
  document.getElementById("group-add").onclick = handlers.onAdd;
}

// Updates playing/loading/error classes without rebuilding the grid.
export function refreshStates({ isPlaying, hasBuffer, failed }) {
  const editing = grid.classList.contains("editing");
  grid.querySelectorAll(".sound").forEach((btn) => {
    const id = btn.dataset.id;
    const playing = isPlaying(id);
    const bad = failed.has(id);
    const loading = !bad && !hasBuffer(id);
    btn.classList.toggle("playing", playing);
    btn.classList.toggle("loading", loading);
    btn.classList.toggle("error", bad);
    if (editing) {
      btn.removeAttribute("aria-pressed");
      btn.removeAttribute("aria-busy");
      btn.disabled = false;
    } else {
      btn.setAttribute("aria-pressed", String(playing));
      btn.setAttribute("aria-busy", String(loading));
      btn.disabled = bad;
    }
  });
}

export function setToggle(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
}

const dialog = document.getElementById("edit-dialog");
const form = document.getElementById("edit-form");
const nameInput = document.getElementById("edit-name");
const emojiInput = document.getElementById("edit-emoji");
const errorEl = document.getElementById("edit-error");
const colorsEl = document.getElementById("edit-colors");
let current = null; // { sound, onSave, onDelete }

function firstGrapheme(text) {
  const t = text.trim();
  if (!t) return "";
  if (window.Intl && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)][0].segment;
  }
  return Array.from(t)[0];
}

const groupSelect = document.getElementById("edit-group");

// handlers: { onSave(id, changes), onDelete(id) }
export function openEditSheet(sound, groups, handlers) {
  current = { sound, ...handlers };
  nameInput.value = sound.name;
  emojiInput.value = sound.emoji || "";
  groupSelect.replaceChildren(
    new Option("No group", ""),
    ...groups.map((g) => new Option(g.name, g.id)),
  );
  groupSelect.value = sound.groupId || "";
  errorEl.hidden = true;
  nameInput.removeAttribute("aria-invalid");
  colorsEl.replaceChildren(...PALETTE.map((c) => {
    const label = document.createElement("label");
    label.className = "swatch";
    label.style.backgroundColor = c.hex;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "edit-color";
    radio.value = c.hex;
    radio.checked = c.hex === sound.color;
    const text = document.createElement("span");
    text.textContent = c.name;
    label.append(radio, text);
    return label;
  }));
  dialog.showModal();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    errorEl.hidden = false;
    nameInput.setAttribute("aria-invalid", "true");
    nameInput.focus();
    return;
  }
  const picked = form.querySelector('input[name="edit-color"]:checked');
  const { sound, onSave } = current;
  dialog.close();
  onSave(sound.id, {
    name,
    color: picked ? picked.value : sound.color,
    emoji: firstGrapheme(emojiInput.value),
    groupId: groupSelect.value || null,
  });
});

document.getElementById("edit-cancel").addEventListener("click", () => dialog.close());

document.getElementById("edit-delete").addEventListener("click", () => {
  const { sound, onDelete } = current;
  if (!window.confirm(`Delete "${sound.name}"? This cannot be undone.`)) return;
  dialog.close();
  onDelete(sound.id);
});

const settingsDialog = document.getElementById("settings-dialog");
const statusEl = document.getElementById("backup-status");
const importDialog = document.getElementById("import-dialog");

export function openSettings() {
  statusEl.textContent = "";
  settingsDialog.showModal();
}

export function setSettingsInfo({ usageText, lastBackupText }) {
  document.getElementById("storage-info").textContent = usageText;
  document.getElementById("backup-info").textContent = lastBackupText;
}

export function setBackupStatus(text) {
  statusEl.textContent = text;
}

export function setBackupBusy(busy) {
  document.getElementById("export-btn").disabled = busy;
  document.getElementById("import-btn").disabled = busy;
}

document.getElementById("settings-close").addEventListener("click", () => settingsDialog.close());

// Resolves "replace", "merge" or null (cancelled).
export function askImportMode({ sounds, groups }) {
  document.getElementById("import-summary").textContent =
    `This backup has ${sounds} sound${sounds === 1 ? "" : "s"} and ${groups} group${groups === 1 ? "" : "s"}.`;
  return new Promise((resolve) => {
    const done = (value) => {
      importDialog.close();
      resolve(value);
    };
    document.getElementById("import-replace").onclick = () => done("replace");
    document.getElementById("import-merge").onclick = () => done("merge");
    document.getElementById("import-cancel").onclick = () => done(null);
    importDialog.oncancel = () => resolve(null);
    importDialog.showModal();
  });
}
