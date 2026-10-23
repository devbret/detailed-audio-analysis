const THEME_KEY = "daa-theme";
const RAMP_KEY = "daa-ramp";
const listeners = new Set();
const media = window.matchMedia("(prefers-color-scheme: dark)");
const lutCache = new Map();
let cachedTokens = null;
let cachedTheme = "";

const SEQ_STOPS = {
  light: ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
  dark: ["#104281", "#1c5cab", "#3987e5", "#86b6ef", "#cde2fb"],
};
const DIV_STOPS = {
  light: ["#eb6834", "#f0efec", "#2a78d6"],
  dark: ["#d95926", "#383835", "#3987e5"],
};

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function notify() {
  cachedTokens = null;
  for (const fn of listeners) fn();
}

export function themeSetting() {
  return read(THEME_KEY, "auto");
}

export function setThemeSetting(value) {
  write(THEME_KEY, value);
  applyTheme();
  notify();
}

export function rampSetting() {
  return read(RAMP_KEY, "mono");
}

export function setRamp(value) {
  write(RAMP_KEY, value);
  notify();
}

export function effectiveTheme() {
  const setting = themeSetting();
  if (setting === "light" || setting === "dark") return setting;
  return media.matches ? "dark" : "light";
}

export function applyTheme() {
  const setting = themeSetting();
  if (setting === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = setting;
  cachedTokens = null;
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

media.addEventListener("change", notify);

export function tokens() {
  const theme = effectiveTheme();
  if (cachedTokens && cachedTheme === theme) return cachedTokens;
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  cachedTokens = {
    theme,
    surface: get("--surface"),
    page: get("--page"),
    text: get("--text"),
    text2: get("--text-2"),
    muted: get("--muted"),
    grid: get("--grid"),
    baseline: get("--baseline"),
    playhead: get("--playhead"),
    font: get("--font") || "system-ui, sans-serif",
    hues: {
      rhythm: get("--hue-rhythm"),
      energy: get("--hue-energy"),
      spectral: get("--hue-spectral"),
      pitch: get("--hue-pitch"),
      timbre: get("--hue-timbre"),
    },
  };
  cachedTheme = theme;
  return cachedTokens;
}

function interpolatorFor(kind, theme, ramp) {
  if (kind === "div") return d3.interpolateRgbBasis(DIV_STOPS[theme]);
  if (ramp === "magma")
    return theme === "dark"
      ? d3.interpolateMagma
      : (t) => d3.interpolateMagma(1 - t);
  return d3.interpolateRgbBasis([tokens().surface, ...SEQ_STOPS[theme]]);
}

export function lutKey() {
  return `${effectiveTheme()}:${rampSetting()}`;
}

export function getLut(kind) {
  const key = `${kind}:${lutKey()}`;
  if (lutCache.has(key)) return lutCache.get(key);
  const interpolate = interpolatorFor(kind, effectiveTheme(), rampSetting());
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const c = d3.rgb(interpolate(i / 255));
    lut[i * 3] = c.r;
    lut[i * 3 + 1] = c.g;
    lut[i * 3 + 2] = c.b;
  }
  lutCache.set(key, lut);
  return lut;
}

export function cssGradient(kind) {
  const lut = getLut(kind);
  const stops = [];
  for (let k = 0; k <= 8; k++) {
    const i = Math.round((k / 8) * 255);
    stops.push(`rgb(${lut[i * 3]},${lut[i * 3 + 1]},${lut[i * 3 + 2]})`);
  }
  return `linear-gradient(to right, ${stops.join(",")})`;
}
