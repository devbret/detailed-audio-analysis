import { GUTTER, RIGHT_PAD } from "./panels/index.js";
import { sampleSeries } from "./panels/sampling.js";
import { tokens } from "./theme.js";

export class Overview {
  constructor(root) {
    this.root = root;
    this.axis = null;
    this.envelope = null;
    this.unsubscribe = null;
    this.width = 0;
    this.height = 56;
    this.playTime = 0;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    root.append(this.canvas);
    this.svg = d3.select(root).append("svg");
    this.brush = d3.brushX().on("brush end", (event) => this.onBrush(event));
    this.brushG = this.svg.append("g").attr("class", "brush");
    this.playhead = document.createElement("div");
    this.playhead.className = "playhead";
    this.playhead.hidden = true;
    root.append(this.playhead);
    new ResizeObserver(() => this.layout()).observe(root);
  }

  get plotWidth() {
    return Math.max(1, this.width - GUTTER - RIGHT_PAD);
  }

  setAxis(axis) {
    if (this.unsubscribe) this.unsubscribe();
    this.axis = axis;
    this.envelope = null;
    this.unsubscribe = axis.on(() => this.syncBrush());
    this.layout();
  }

  setEnvelope(series) {
    this.envelope = series;
    this.draw();
  }

  layout() {
    const width = this.root.clientWidth;
    if (!width) return;
    this.width = width;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.svg.attr("width", width).attr("height", this.height);
    this.brush.extent([
      [GUTTER, 0],
      [GUTTER + this.plotWidth, this.height],
    ]);
    this.brushG.call(this.brush);
    this.syncBrush();
    this.draw();
  }

  xOfTime(t) {
    return GUTTER + (t / this.axis.duration) * this.plotWidth;
  }

  timeOfX(x) {
    return ((x - GUTTER) / this.plotWidth) * this.axis.duration;
  }

  onBrush(event) {
    if (!event.sourceEvent || !this.axis) return;
    const selection = event.selection;
    if (!selection) {
      if (event.type === "end") this.axis.reset();
      return;
    }
    this.axis.setDomain([this.timeOfX(selection[0]), this.timeOfX(selection[1])]);
  }

  syncBrush() {
    if (!this.axis || !this.width) return;
    const [t0, t1] = this.axis.domain;
    this.brushG.call(this.brush.move, [this.xOfTime(t0), this.xOfTime(t1)]);
    this.updatePlayhead();
  }

  draw() {
    const T = tokens();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `11px ${T.font}`;
    ctx.fillStyle = T.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Overview", 8, this.height / 2);
    if (!this.axis || !this.envelope) return;
    const full = { domain: [0, this.axis.duration] };
    const sample = sampleSeries(this.envelope.values, this.envelope.dt, full, GUTTER, this.plotWidth);
    const max = this.envelope.max > 0 ? this.envelope.max : 1;
    const top = 6;
    const bottom = this.height - 6;
    ctx.fillStyle = T.text2;
    ctx.globalAlpha = 0.5;
    if (sample.dense) {
      for (let px = 0; px < sample.maxs.length; px++) {
        const v = sample.maxs[px];
        if (v !== v) continue;
        const h = Math.max(1, (v / max) * (bottom - top));
        ctx.fillRect(GUTTER + px, bottom - h, 1, h);
      }
    } else {
      for (let k = 0; k < sample.xs.length; k++) {
        const v = sample.ys[k];
        if (v !== v) continue;
        const h = Math.max(1, (v / max) * (bottom - top));
        ctx.fillRect(sample.xs[k] - 1, bottom - h, 2, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  setPlayTime(t) {
    this.playTime = t;
    this.updatePlayhead();
  }

  updatePlayhead() {
    if (!this.axis || !this.width || !(this.playTime > 0)) {
      this.playhead.hidden = true;
      return;
    }
    this.playhead.style.left = `${this.xOfTime(this.playTime) - 1}px`;
    this.playhead.hidden = false;
  }
}
