import { loadManifest, loadFeature } from "./data.js";
import { FEATURE_BY_ID, DEFAULT_OPEN } from "./features.js";
import { TimeAxis } from "./time-axis.js";
import { PanelStack } from "./panel-stack.js";
import { Overview } from "./overview.js";
import { Player } from "./player.js";
import { createPanel } from "./panels/index.js";
import {
  applyTheme,
  onThemeChange,
  themeSetting,
  setThemeSetting,
  rampSetting,
  setRamp,
} from "./theme.js";
import { readHash, writeHash } from "./hash.js";
import { buildChips, setChipPressed } from "./chips.js";

const $ = (selector) => document.querySelector(selector);
const state = {
  manifest: null,
  track: null,
  axis: null,
  open: [],
  panels: new Map(),
  follow: true,
};

applyTheme();

const stack = new PanelStack({
  root: $("#stack"),
  axisCanvas: $("#time-axis"),
  onSeek: (t) => player.seek(t),
  onChange: (kind, panel) => {
    if (kind === "remove") {
      state.panels.delete(panel.feature.id);
      setChipPressed($("#chips"), panel.feature.id, false);
    }
    state.open = stack.panels.map((p) => p.feature.id);
    syncHash();
  },
});
const overview = new Overview($("#overview"));
const player = new Player({
  audio: $("#audio"),
  button: $("#play"),
  timeEl: $("#time"),
  volume: $("#volume"),
  onTime: handleTime,
});

function showStatus(html, isError) {
  const status = $("#status");
  status.innerHTML = html;
  status.classList.toggle("error", !!isError);
  status.hidden = false;
}

function hideStatus() {
  $("#status").hidden = true;
}

function syncHash() {
  if (!state.track || !state.axis) return;
  writeHash({
    track: state.track.id,
    panels: stack.panels.map((p) => p.feature.id),
    view: state.axis.isFull
      ? null
      : state.axis.domain.map((v) => +v.toFixed(3)),
  });
}

function openPanel(id) {
  const feature = FEATURE_BY_ID.get(id);
  const track = state.track;
  if (
    !feature ||
    !track ||
    !track.features[feature.source] ||
    state.panels.has(id)
  )
    return false;
  const panel = createPanel(feature, track);
  state.panels.set(id, panel);
  stack.add(panel);
  loadFeature(track, feature.source)
    .then((data) => {
      if (state.track !== track) return;
      panel.setData(data);
      stack.requestRender();
    })
    .catch((error) => {
      panel.setError(error && error.message ? error.message : "Failed to load");
      stack.requestRender();
    });
  return true;
}

function closePanel(id) {
  const panel = state.panels.get(id);
  if (!panel) return;
  state.panels.delete(id);
  stack.remove(panel, false);
  state.open = stack.panels.map((p) => p.feature.id);
  syncHash();
}

function togglePanel(id, pressed) {
  if (pressed) openPanel(id);
  else closePanel(id);
  state.open = stack.panels.map((p) => p.feature.id);
  syncHash();
}

function resetPanels() {
  stack.clear();
  state.panels.clear();
  state.open = [...DEFAULT_OPEN];
  buildChips($("#chips"), state.track, state.open, togglePanel, resetPanels);
  for (const id of state.open) openPanel(id);
  syncHash();
}

function selectTrack(track, view) {
  state.track = track;
  $("#track-select").value = track.id;
  stack.clear();
  state.panels.clear();
  state.axis = new TimeAxis(track.duration);
  state.axis.on(syncHash);
  stack.frameDt = track.hop_length / track.sr;
  stack.setAxis(state.axis);
  overview.setAxis(state.axis);
  player.load(`audio/${encodeURIComponent(track.file)}`, track.duration);
  loadFeature(track, "loudness")
    .then((data) => {
      if (state.track === track && data) overview.setEnvelope(data);
    })
    .catch(() => {});
  buildChips($("#chips"), track, state.open, togglePanel, resetPanels);
  for (const id of state.open) openPanel(id);
  if (view) state.axis.setDomain(view);
  syncHash();
}

function handleTime(t) {
  stack.setPlayTime(t);
  overview.setPlayTime(t);
  const axis = state.axis;
  if (!axis || !state.follow || !player.playing || axis.isFull) return;
  const [d0, d1] = axis.domain;
  const span = axis.span;
  if (t > d1 - span * 0.02 || t < d0)
    axis.setDomain([t - span * 0.1, t + span * 0.9]);
}

function viewCenter() {
  const axis = state.axis;
  const t = player.time;
  if (t > 0 && t >= axis.domain[0] && t <= axis.domain[1]) return t;
  return (axis.domain[0] + axis.domain[1]) / 2;
}

function updateThemeButton() {
  const setting = themeSetting();
  $("#theme").textContent =
    `Theme: ${setting[0].toUpperCase()}${setting.slice(1)}`;
}

function wireControls() {
  $("#track-select").addEventListener("change", (e) => {
    const track = state.manifest.tracks.find((t) => t.id === e.target.value);
    if (track) selectTrack(track);
  });
  for (const button of document.querySelectorAll("[data-span]")) {
    button.addEventListener("click", () => {
      if (!state.axis) return;
      const span = button.dataset.span;
      if (span === "full") state.axis.reset();
      else state.axis.setSpan(Number(span), viewCenter());
    });
  }
  $("#zoom-in").addEventListener(
    "click",
    () => state.axis && state.axis.zoomAround(1.5, viewCenter()),
  );
  $("#zoom-out").addEventListener(
    "click",
    () => state.axis && state.axis.zoomAround(1 / 1.5, viewCenter()),
  );
  $("#follow").addEventListener("change", (e) => {
    state.follow = e.target.checked;
  });
  $("#ramp").value = rampSetting();
  $("#ramp").addEventListener("change", (e) => setRamp(e.target.value));
  updateThemeButton();
  $("#theme").addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    setThemeSetting(order[(order.indexOf(themeSetting()) + 1) % order.length]);
    updateThemeButton();
  });
  $("#export").addEventListener("click", () => stack.exportCsv(state.track));
  onThemeChange(() => {
    stack.requestRender();
    overview.draw();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.code !== "Space" ||
      e.target.closest("input, select, textarea, button, [contenteditable]")
    )
      return;
    e.preventDefault();
    player.toggle();
  });
  window.addEventListener("hashchange", () => {
    const hash = readHash();
    if (hash.track && state.track && hash.track !== state.track.id) {
      const track = state.manifest.tracks.find((t) => t.id === hash.track);
      if (track) selectTrack(track, hash.view);
    }
  });
}

async function init() {
  let manifest;
  try {
    manifest = await loadManifest();
  } catch {
    showStatus(
      "No analysis data found. Add audio files to <code>audio/</code>, run <code>python3 app.py</code> to create <code>data/index.json</code>, then reload this page from a local HTTP server such as <code>python3 -m http.server</code>.",
      true,
    );
    return;
  }
  state.manifest = manifest;
  if (!manifest.tracks.length) {
    showStatus(
      "The analysis index lists no tracks. Add audio files to <code>audio/</code> and run <code>python3 app.py</code> again.",
      true,
    );
    return;
  }
  if (manifest.legacy) {
    showStatus(
      "Loaded the legacy <code>audio_analysis_enhanced.json</code>. Run <code>python3 app.py</code> to generate the per-feature files in <code>data/</code>, which load far faster.",
      false,
    );
  } else {
    hideStatus();
  }
  const select = $("#track-select");
  select.replaceChildren();
  for (const track of manifest.tracks) {
    const option = document.createElement("option");
    option.value = track.id;
    option.textContent = track.file;
    select.append(option);
  }
  const hash = readHash();
  const track =
    manifest.tracks.find((t) => t.id === hash.track) || manifest.tracks[0];
  state.open = hash.panels
    ? hash.panels.filter((id) => FEATURE_BY_ID.has(id))
    : [...DEFAULT_OPEN];
  wireControls();
  selectTrack(track, hash.view);
}

init();
