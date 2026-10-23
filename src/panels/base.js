import { tokens } from "../theme.js";
import { formatTick } from "../format.js";

export const GUTTER = 64;
export const RIGHT_PAD = 16;
export const HEAD_H = 22;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(label, ariaLabel, onClick) {
  const b = el("button", "pbtn", label);
  b.type = "button";
  if (!label) b.classList.add("close");
  b.setAttribute("aria-label", ariaLabel);
  b.addEventListener("click", onClick);
  return b;
}

export class Panel {
  constructor(feature, track) {
    this.feature = feature;
    this.track = track;
    this.data = null;
    this.error = null;
    this.tall = false;
    this.fitY = false;
    this.width = 0;
    this.onClose = null;
    this.onChange = null;
    this.el = el("section", `panel panel-${feature.panel}`);
    this.el.dataset.feature = feature.id;
    this.el.style.setProperty("--panel-hue", `var(--hue-${feature.group})`);
    this.canvas = el("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.head = this.buildHead();
    this.el.append(this.canvas, this.head);
  }

  get supportsFitY() {
    return false;
  }

  get supportsTall() {
    return true;
  }

  get baseHeight() {
    return 140;
  }

  get height() {
    return this.tall ? Math.round(this.baseHeight * 1.65) : this.baseHeight;
  }

  get plotTop() {
    return HEAD_H;
  }

  get plotBottom() {
    return this.height - 8;
  }

  get plotLeft() {
    return GUTTER;
  }

  get plotRight() {
    return this.width - RIGHT_PAD;
  }

  get plotWidth() {
    return Math.max(1, this.plotRight - this.plotLeft);
  }

  get plotHeight() {
    return Math.max(1, this.plotBottom - this.plotTop);
  }

  buildHead() {
    const head = el("div", "panel-head");
    const grab = el("button", "grab");
    grab.type = "button";
    grab.title = "Drag to reorder, or focus and use the arrow keys";
    grab.setAttribute("aria-label", `Move the ${this.feature.label} panel. Drag it, or use the up and down arrow keys.`);
    const title = el("span", "title", this.feature.label);
    title.title = this.feature.description || "";
    grab.append(el("span", "drag"), el("span", "key"), title);
    if (this.feature.units) grab.append(el("span", "units", this.feature.units));
    this.grab = grab;
    this.legend = el("span", "legend");
    head.append(grab, this.legend, el("span", "spacer"));
    if (this.supportsFitY) {
      this.fitButton = button("Fit y", `Fit the ${this.feature.label} axis to the visible window`, () => {
        this.setFitY(!this.fitY);
      });
      this.fitButton.setAttribute("aria-pressed", "false");
      head.append(this.fitButton);
    }
    if (this.supportsTall) {
      this.tallButton = button("Tall", `Toggle a taller ${this.feature.label} panel`, () => {
        this.setTall(!this.tall);
      });
      this.tallButton.setAttribute("aria-pressed", "false");
      head.append(this.tallButton);
    }
    head.append(button("", `Remove ${this.feature.label}`, () => this.onClose && this.onClose(this)));
    return head;
  }

  setFitY(value) {
    this.fitY = value;
    if (this.fitButton) this.fitButton.setAttribute("aria-pressed", String(value));
    this.changed();
  }

  setTall(value) {
    this.tall = value;
    if (this.tallButton) this.tallButton.setAttribute("aria-pressed", String(value));
    this.resize(this.width);
    this.changed();
  }

  changed() {
    if (this.onChange) this.onChange(this);
  }

  setData(data) {
    this.data = data;
    this.error = data ? null : "No data for this track";
    this.onData();
  }

  setError(message) {
    this.error = message;
    this.data = null;
  }

  onData() {}

  resize(width) {
    this.width = width;
    const dpr = window.devicePixelRatio || 1;
    this.el.style.height = `${this.height}px`;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  hue(T) {
    return T.hues[this.feature.group] || T.text2;
  }

  draw(axis, T = tokens()) {
    if (!this.width) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = `11px ${T.font}`;
    if (!this.data) {
      this.drawMessage(ctx, this.error || "Loading...", T);
      return;
    }
    this.drawPlot(ctx, axis, T);
  }

  drawPlot() {}

  drawMessage(ctx, text, T) {
    ctx.fillStyle = T.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, this.plotLeft + 8, this.plotTop + Math.max(8, this.plotHeight / 2));
  }

  drawYAxis(ctx, scale, T, ticks = scale.ticks(4), format = formatTick) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = T.grid;
    ctx.fillStyle = T.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of ticks) {
      const y = Math.round(scale(t)) + 0.5;
      if (y < this.plotTop - 1 || y > this.plotBottom + 1) continue;
      ctx.beginPath();
      ctx.moveTo(this.plotLeft, y);
      ctx.lineTo(this.plotRight, y);
      ctx.stroke();
      ctx.fillText(format(t), this.plotLeft - 8, y);
    }
    ctx.restore();
  }

  clipPlot(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.plotLeft, this.plotTop, this.plotWidth, this.plotHeight);
    ctx.clip();
  }

  frameAt(time) {
    const dt = this.data.dt;
    return Math.max(0, Math.min(this.data.n - 1, Math.round(time / dt)));
  }

  valueAt() {
    return null;
  }

  csvColumns() {
    return [];
  }
}
