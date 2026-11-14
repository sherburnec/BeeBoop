let ctx = null;
let master = null;
let volume = 1;
let onChange = () => {};

const buffers = new Map();
const playing = new Map(); // sound id -> AudioBufferSourceNode

export function setOnChange(fn) {
  onChange = fn;
}

function resumeIfNeeded() {
  if (ctx && ctx.state !== "running" && ctx.state !== "closed") {
    ctx.resume().catch(() => {});
  }
}

function getContext() {
  if (!ctx) {
    // iOS: "playback" lets audio play with the silent switch on.
    if ("audioSession" in navigator) {
      try { navigator.audioSession.type = "playback"; } catch { /* unsupported value */ }
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    // iOS moves the context to "interrupted" after calls, Siri, app switches.
    ctx.onstatechange = resumeIfNeeded;
  }
  return ctx;
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resumeIfNeeded();
});

// Call from a user tap handler.
export function unlock() {
  getContext();
  resumeIfNeeded();
}

export function decode(arrayBuffer) {
  const c = getContext();
  return new Promise((resolve, reject) => {
    // Older Safari only supports the callback form; the returned promise
    // would otherwise log an unhandled rejection.
    const p = c.decodeAudioData(arrayBuffer, resolve, reject);
    if (p && p.catch) p.catch(() => {});
  });
}

export async function loadSound(id, blob) {
  const buf = await decode(await blob.arrayBuffer());
  buffers.set(id, buf);
}

export function cacheBuffer(id, buf) {
  buffers.set(id, buf);
}

export function hasBuffer(id) {
  return buffers.has(id);
}

export function dropBuffer(id) {
  stop(id);
  buffers.delete(id);
}

export function clearBuffers() {
  stopAll();
  buffers.clear();
}

export function isPlaying(id) {
  return playing.has(id);
}

export function toggle(id, { loop, overlap }) {
  unlock();
  if (playing.has(id)) {
    stop(id);
    return;
  }
  const buf = buffers.get(id);
  if (!buf) return;
  if (!overlap) stopAll();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  src.connect(master);
  src.onended = () => {
    if (playing.get(id) === src) {
      playing.delete(id);
      onChange();
    }
  };
  playing.set(id, src);
  src.start(0);
  onChange();
}

export function stop(id) {
  const src = playing.get(id);
  if (!src) return;
  playing.delete(id);
  try { src.stop(); } catch { /* already stopped */ }
  onChange();
}

export function stopAll() {
  [...playing.keys()].forEach(stop);
}

export function setLoop(loop) {
  playing.forEach((src) => { src.loop = loop; });
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}
