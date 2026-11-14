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

function soundButton(sound, onTap) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sound";
  btn.dataset.id = sound.id;
  if (sound.color) btn.style.backgroundColor = sound.color;
  btn.setAttribute("aria-pressed", "false");
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

// handlers: { onTap(id) }
export function renderGrid(sounds, handlers) {
  grid.replaceChildren(...sounds.map((s) => soundButton(s, handlers.onTap)));
}

// Updates playing/loading/error classes without rebuilding the grid.
export function refreshStates({ isPlaying, hasBuffer, failed }) {
  grid.querySelectorAll(".sound").forEach((btn) => {
    const id = btn.dataset.id;
    const playing = isPlaying(id);
    const bad = failed.has(id);
    const loading = !bad && !hasBuffer(id);
    btn.classList.toggle("playing", playing);
    btn.classList.toggle("loading", loading);
    btn.classList.toggle("error", bad);
    btn.setAttribute("aria-pressed", String(playing));
    btn.setAttribute("aria-busy", String(loading));
    btn.disabled = bad;
  });
}

export function setToggle(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
}
