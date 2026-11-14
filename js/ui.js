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

// handlers: { onTap(id), onMove(id, neighborId) }
export function renderGrid(sounds, { onTap, onMove, edit }) {
  grid.classList.toggle("editing", edit);
  grid.replaceChildren(...sounds.map((sound, i) => {
    const btn = soundButton(sound, onTap, edit);
    if (!edit) return btn;
    const prev = sounds[i - 1];
    const next = sounds[i + 1];
    const moves = document.createElement("div");
    moves.className = "moves";
    moves.append(
      moveButton("◀", `Move ${sound.name} earlier`, !prev, () => onMove(sound.id, prev.id)),
      moveButton("▶", `Move ${sound.name} later`, !next, () => onMove(sound.id, next.id)),
    );
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.append(btn, moves);
    return tile;
  }));
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

// handlers: { onSave(id, changes), onDelete(id) }
export function openEditSheet(sound, handlers) {
  current = { sound, ...handlers };
  nameInput.value = sound.name;
  emojiInput.value = sound.emoji || "";
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
  });
});

document.getElementById("edit-cancel").addEventListener("click", () => dialog.close());

document.getElementById("edit-delete").addEventListener("click", () => {
  const { sound, onDelete } = current;
  if (!window.confirm(`Delete "${sound.name}"? This cannot be undone.`)) return;
  dialog.close();
  onDelete(sound.id);
});
