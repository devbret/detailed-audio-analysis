import { Panel } from "./base.js";
import { getLut, lutKey, cssGradient } from "../theme.js";
import { formatValue, formatHz } from "../format.js";

const TILE = 4096;
const HZ_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

export class HeatmapPanel extends Panel {
  constructor(feature, track) {
    super(feature, track);
    this.tiles = null;
    this.tileKey = "";
  }

  get baseHeight() {
    return 220;
  }

  get lutKind() {
    return this.feature.diverging ? "div" : "seq";
  }

  valueDomain() {
    const f = this.feature;
    const d = this.data;
    if (f.domain) return f.domain;
    if (f.diverging) {
      const m = Math.max(Math.abs(d.min), Math.abs(d.max)) || 1;
      return [-m, m];
    }
    return d.max > d.min ? [d.min, d.max] : [d.min - 1, d.max + 1];
  }

  onData() {
    this.tiles = null;
    this.updateLegend();
  }

  updateLegend() {
    if (!this.data) return;
    const f = this.feature;
    const [lo, hi] = this.valueDomain();
    const ramp = document.createElement("span");
    ramp.className = "ramp";
    ramp.style.background = cssGradient(this.lutKind);
    const units = f.units ? ` ${f.units}` : "";
    const left = f.rowNormalize ? "row low" : formatValue(lo, f.decimals) + units;
    const right = f.rowNormalize ? "row high" : formatValue(hi, f.decimals) + units;
    this.legend.replaceChildren(document.createTextNode(left), ramp, document.createTextNode(right));
  }

  buildTiles(T) {
    const key = `${lutKey()}`;
    if (this.tiles && this.tileKey === key) return;
    this.tileKey = key;
    this.updateLegend();
    const lut = getLut(this.lutKind);
    const { rows, n, data, rowAbsMax } = this.data;
    const [lo, hi] = this.valueDomain();
    const range = hi - lo || 1;
    const normalize = !!this.feature.rowNormalize;
    const surface = d3.rgb(T.surface);
    const tiles = [];
    for (let start = 0; start < n; start += TILE) {
      const w = Math.min(TILE, n - start);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = rows;
      const ctx = canvas.getContext("2d");
      const image = ctx.createImageData(w, rows);
      const px = image.data;
      for (let r = 0; r < rows; r++) {
        const yrow = rows - 1 - r;
        const base = r * n + start;
        const scale = normalize ? 1 / (rowAbsMax[r] || 1) : 1;
        for (let i = 0; i < w; i++) {
          const v = data[base + i];
          const o = (yrow * w + i) * 4;
          if (v !== v) {
            px[o] = surface.r;
            px[o + 1] = surface.g;
            px[o + 2] = surface.b;
            px[o + 3] = 255;
            continue;
          }
          const t = normalize ? (v * scale + 1) / 2 : (v - lo) / range;
          const idx = Math.max(0, Math.min(255, Math.round(t * 255))) * 3;
          px[o] = lut[idx];
          px[o + 1] = lut[idx + 1];
          px[o + 2] = lut[idx + 2];
          px[o + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      tiles.push({ start, w, canvas });
    }
    this.tiles = tiles;
  }

  drawPlot(ctx, axis, T) {
    this.buildTiles(T);
    const { rows, dt } = this.data;
    const [t0, t1] = axis.domain;
    const span = t1 - t0;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.ceil(this.plotWidth * dpr));
    const scratch = this.scratch || (this.scratch = document.createElement("canvas"));
    if (scratch.width !== width || scratch.height !== rows) {
      scratch.width = width;
      scratch.height = rows;
    }
    const sctx = scratch.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = T.surface;
    sctx.fillRect(0, 0, width, rows);
    const pxPerFrame = (dt / span) * this.plotWidth * dpr;
    sctx.imageSmoothingEnabled = pxPerFrame < 1;
    sctx.imageSmoothingQuality = "high";
    for (const tile of this.tiles) {
      const i0 = Math.max(tile.start, Math.floor(t0 / dt + 0.5) - 1);
      const i1 = Math.min(tile.start + tile.w - 1, Math.ceil(t1 / dt + 0.5) + 1);
      if (i1 < i0) continue;
      const sx = i0 - tile.start;
      const sw = i1 - i0 + 1;
      const dx = axis.timeToX((i0 - 0.5) * dt) * dpr;
      const dw = ((sw * dt) / span) * this.plotWidth * dpr;
      sctx.drawImage(tile.canvas, sx, 0, sw, rows, dx, 0, dw, rows);
    }
    this.clipPlot(ctx);
    ctx.imageSmoothingEnabled = rows > 48;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(scratch, 0, 0, width, rows, this.plotLeft, this.plotTop, this.plotWidth, this.plotHeight);
    ctx.restore();
    this.drawRowAxis(ctx, T);
  }

  rowHeight() {
    return this.plotHeight / this.data.rows;
  }

  rowCenterY(r) {
    return this.plotBottom - (r + 0.5) * this.rowHeight();
  }

  yForRowValue(value) {
    const rv = this.data.rowValues;
    const rows = this.data.rows;
    if (value <= rv[0]) return this.rowCenterY(0);
    for (let r = 0; r < rows - 1; r++) {
      if (value >= rv[r] && value <= rv[r + 1]) {
        const frac = (value - rv[r]) / (rv[r + 1] - rv[r] || 1);
        return this.rowCenterY(r) - frac * this.rowHeight();
      }
    }
    return this.rowCenterY(rows - 1);
  }

  drawRowAxis(ctx, T) {
    const { rows, rowLabels, rowValues } = this.data;
    const rh = this.rowHeight();
    ctx.fillStyle = T.muted;
    ctx.strokeStyle = T.baseline;
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (rowValues) {
      let lastY = Infinity;
      for (const hz of HZ_TICKS) {
        if (hz < rowValues[0] || hz > rowValues[rows - 1]) continue;
        const y = this.yForRowValue(hz);
        if (lastY - y < 14 || y < this.plotTop + 5) continue;
        lastY = y;
        const py = Math.round(y) + 0.5;
        ctx.beginPath();
        ctx.moveTo(this.plotLeft - 4, py);
        ctx.lineTo(this.plotLeft, py);
        ctx.stroke();
        ctx.fillText(formatHz(hz), this.plotLeft - 8, y);
      }
      return;
    }
    if (!rowLabels) return;
    const step = rh >= 12 ? 1 : Math.ceil(12 / rh);
    for (let r = 0; r < rows; r += step) {
      ctx.fillText(rowLabels[r], this.plotLeft - 8, this.rowCenterY(r));
    }
  }

  rowLabel(r) {
    const d = this.data;
    if (d.rowValues) return `${formatHz(d.rowValues[r])} ${d.rowUnit || ""}`.trim();
    if (d.rowLabels) return d.rowUnit ? `${d.rowLabels[r]} ${d.rowUnit}` : d.rowLabels[r];
    return `row ${r + 1}`;
  }

  rowAtY(y) {
    if (y == null || y < this.plotTop || y > this.plotBottom) return -1;
    return Math.max(0, Math.min(this.data.rows - 1, Math.floor((this.plotBottom - y) / this.rowHeight())));
  }

  valueAt(time, pointerY) {
    const d = this.data;
    const i = this.frameAt(time);
    let r = this.rowAtY(pointerY);
    let prefix = "";
    if (r < 0) {
      let best = -Infinity;
      r = 0;
      for (let k = 0; k < d.rows; k++) {
        const v = d.data[k * d.n + i];
        if (v === v && v > best) {
          best = v;
          r = k;
        }
      }
      prefix = "peak ";
    }
    const v = d.data[r * d.n + i];
    const units = this.feature.units ? ` ${this.feature.units}` : "";
    return {
      value: v === v ? `${formatValue(v, this.feature.decimals)}${units}` : "-",
      label: `${this.feature.label}: ${prefix}${this.rowLabel(r)}`,
    };
  }

  csvColumns() {
    const d = this.data;
    const columns = [];
    for (let r = 0; r < d.rows; r++) {
      columns.push({ name: `${this.feature.id}:${this.rowLabel(r)}`, at: (i) => (i < d.n ? d.data[r * d.n + i] : NaN) });
    }
    return columns;
  }
}
