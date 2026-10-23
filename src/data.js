const cache = new Map();
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TONNETZ_LABELS = ["P5 x", "P5 y", "m3 x", "m3 y", "M3 x", "M3 y"];

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadManifest() {
  const index = await fetchJson("data/index.json");
  if (index && Array.isArray(index.tracks)) return fromIndex(index);
  const legacy = await fetchJson("audio_analysis_enhanced.json");
  if (legacy && typeof legacy === "object") return fromLegacy(legacy);
  throw new Error("no-data");
}

function fromIndex(index) {
  const tracks = index.tracks.map((t) => ({
    ...t,
    features: t.features || {},
    load: (name) => fetchJson(`data/${encodeURIComponent(t.id)}/${encodeURIComponent(name)}.json`),
  }));
  return { legacy: false, tracks };
}

function slugify(name) {
  const stem = name.replace(/\.[^.]+$/, "").toLowerCase();
  return stem.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "track";
}

function hzToMel(hz) {
  const fsp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = minLogHz / fsp;
  const logstep = Math.log(6.4) / 27;
  return hz >= minLogHz ? minLogMel + Math.log(hz / minLogHz) / logstep : hz / fsp;
}

function melToHz(mel) {
  const fsp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = minLogHz / fsp;
  const logstep = Math.log(6.4) / 27;
  return mel >= minLogMel ? minLogHz * Math.exp(logstep * (mel - minLogMel)) : fsp * mel;
}

function melFrequencies(n, fmin, fmax) {
  const a = hzToMel(fmin);
  const b = hzToMel(fmax);
  return Array.from({ length: n }, (_, i) => +melToHz(a + ((b - a) * i) / (n - 1)).toFixed(1));
}

function hzLabel(hz) {
  return hz >= 1000 ? `${+(hz / 1000).toPrecision(3)}k` : `${+hz.toPrecision(3)}`;
}

function contrastLabels(rows, sr) {
  const edges = [0];
  for (let i = 0; i < rows; i++) edges.push(200 * 2 ** i);
  edges[edges.length - 1] = Math.min(edges[edges.length - 1], sr / 2);
  return edges.slice(0, -1).map((lo, i) => `${hzLabel(lo)}-${hzLabel(edges[i + 1])}`);
}

function bandIndex(key) {
  const match = /(\d+)$/.exec(key);
  return match ? Number(match[1]) : 0;
}

function legacyFeature(key, value, track) {
  if (Array.isArray(value.values)) {
    if (key === "onsets") return { kind: "events", times: value.times };
    if (Array.isArray(value.times)) return { kind: "events", times: value.times, values: value.values };
    return { kind: "series", values: value.values };
  }
  const bands = Object.keys(value).sort((a, b) => bandIndex(a) - bandIndex(b));
  const rows = bands.map((b) => value[b].values);
  const out = { kind: "matrix", rows };
  if (key === "mel_spectrogram") {
    out.row_values = melFrequencies(rows.length, 0, track.sr / 2);
    out.row_unit = "Hz";
  } else if (key === "chroma") out.row_labels = NOTE_NAMES.slice(0, rows.length);
  else if (key === "timbre") out.row_labels = rows.map((_, i) => String(i + 1));
  else if (key === "tonnetz") out.row_labels = TONNETZ_LABELS.slice(0, rows.length);
  else if (key === "spectral_contrast") {
    out.row_labels = contrastLabels(rows.length, track.sr);
    out.row_unit = "Hz";
  }
  return out;
}

function fromLegacy(all) {
  const tracks = Object.entries(all).map(([file, t]) => {
    const raw = {};
    for (const [key, value] of Object.entries(t)) {
      if (!value || typeof value !== "object") continue;
      raw[key === "tempo" ? "beats" : key] = legacyFeature(key, value, t);
    }
    const features = {};
    for (const [name, payload] of Object.entries(raw)) {
      features[name] = payload.kind === "matrix" ? { kind: "matrix", rows: payload.rows.length } : { kind: payload.kind };
    }
    return {
      id: slugify(file),
      file,
      sr: t.sr,
      hop_length: t.hop_length,
      duration: t.duration,
      frames: raw.loudness ? raw.loudness.values.length : 0,
      overall_tempo: t.overall_tempo,
      features,
      load: async (name) => raw[name] || null,
    };
  });
  return { legacy: true, tracks };
}

function toFloat32(values) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out[i] = v == null ? NaN : v;
  }
  return out;
}

function finiteExtent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== v) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : [NaN, NaN];
}

export function prepareFeature(raw, track) {
  const dt = track.hop_length / track.sr;
  if (raw.kind === "series") {
    const values = toFloat32(raw.values);
    const [min, max] = finiteExtent(values);
    return { kind: "series", values, n: values.length, dt, min, max };
  }
  if (raw.kind === "events") {
    const times = Float64Array.from(raw.times, (v) => (v == null ? NaN : v));
    const values = raw.values ? toFloat32(raw.values) : null;
    const [min, max] = values ? finiteExtent(values) : [NaN, NaN];
    return { kind: "events", times, values, n: times.length, dt, min, max };
  }
  if (raw.kind === "matrix") {
    const rows = raw.rows.length;
    const n = rows ? raw.rows[0].length : 0;
    const data = new Float32Array(rows * n);
    const rowAbsMax = new Float32Array(rows);
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < rows; r++) {
      const row = raw.rows[r];
      let absMax = 0;
      for (let i = 0; i < n; i++) {
        const v = row[i] == null ? NaN : row[i];
        data[r * n + i] = v;
        if (v !== v) continue;
        if (v < min) min = v;
        if (v > max) max = v;
        if (Math.abs(v) > absMax) absMax = Math.abs(v);
      }
      rowAbsMax[r] = absMax;
    }
    return {
      kind: "matrix",
      rows,
      n,
      data,
      dt,
      min,
      max,
      rowAbsMax,
      rowLabels: raw.row_labels || null,
      rowValues: raw.row_values || null,
      rowUnit: raw.row_unit || null,
    };
  }
  return null;
}

export function loadFeature(track, source) {
  const key = `${track.id}/${source}`;
  if (!cache.has(key)) {
    const promise = track.load(source).then((raw) => (raw ? prepareFeature(raw, track) : null));
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return cache.get(key);
}
