d3.formatDefaultLocale({ decimal: ".", thousands: ",", grouping: [3], currency: ["$", ""], minus: "-" });

const compactSI = d3.format("~s");
const general = d3.format(".3~g");
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function formatValue(v, decimals) {
  if (v == null || Number.isNaN(v)) return "-";
  if (decimals != null) return v.toFixed(decimals);
  return formatTick(v);
}

export function formatTick(v) {
  if (v === 0) return "0";
  return Math.abs(v) >= 1000 ? compactSI(v) : general(v);
}

export function formatTime(seconds, fractionDigits = 0) {
  if (!Number.isFinite(seconds)) return "0:00";
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs - m * 60;
  const whole = Math.floor(s);
  let out = `${sign}${m}:${String(whole).padStart(2, "0")}`;
  if (fractionDigits > 0) {
    const frac = Math.floor((s - whole) * 10 ** fractionDigits);
    out += `.${String(frac).padStart(fractionDigits, "0")}`;
  }
  return out;
}

export function formatHz(hz) {
  if (hz >= 1000) return `${+(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`;
  return `${Math.round(hz)}`;
}

export function noteName(hz, withCents = true) {
  if (!(hz > 0)) return "";
  const midi = 69 + 12 * Math.log2(hz / 440);
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  if (!withCents) return `${name}${octave}`;
  const cents = Math.round((midi - rounded) * 100);
  const sign = cents > 0 ? "+" : "";
  return `${name}${octave} ${sign}${cents}c`;
}

export function bisectLeft(arr, x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function bisectRight(arr, x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
