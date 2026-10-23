import { GUTTER, RIGHT_PAD } from "./panels/index.js";
import { formatTime, clamp } from "./format.js";
import { tokens } from "./theme.js";

const AXIS_H = 28;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export class PanelStack {
  constructor({ root, axisCanvas, onSeek, onChange }) {
    this.root = root;
    this.axisCanvas = axisCanvas;
    this.axisCtx = axisCanvas.getContext("2d");
    this.onSeek = onSeek;
    this.onChange = onChange;
    this.panels = [];
    this.axis = null;
    this.unsubscribe = null;
    this.width = 0;
    this.frameDt = 512 / 22050;
    this.cursor = null;
    this.keyboardCursor = false;
    this.playTime = 0;
    this.queued = false;
    this.reordering = false;
    this.reorder = null;
    this.empty = el(
      "div",
      "empty",
      "No panels open. Choose features above to add them.",
    );
    this.crosshair = el("div", "crosshair");
    this.playhead = el("div", "playhead");
    this.readout = el("div", "readout");
    this.crosshair.hidden = true;
    this.playhead.hidden = true;
    this.readout.hidden = true;
    root.append(this.empty, this.crosshair, this.playhead, this.readout);
    this.bindPointer();
    this.bindKeyboard();
    this.bindDrag();
    new ResizeObserver(() => this.layout()).observe(root);
  }

  setAxis(axis) {
    if (this.unsubscribe) this.unsubscribe();
    this.axis = axis;
    this.unsubscribe = axis.on(() => this.requestRender());
    this.layout();
  }

  add(panel) {
    this.panels.push(panel);
    panel.onClose = (p) => this.remove(p, true);
    panel.onChange = () => this.requestRender();
    this.root.insertBefore(panel.el, this.empty);
    panel.resize(this.width);
    this.updateEmpty();
    this.requestRender();
  }

  remove(panel, notify) {
    const index = this.panels.indexOf(panel);
    if (index < 0) return;
    this.panels.splice(index, 1);
    panel.el.remove();
    this.updateEmpty();
    this.requestRender();
    if (notify && this.onChange) this.onChange("remove", panel);
  }

  clear() {
    for (const panel of [...this.panels]) this.remove(panel, false);
  }

  updateEmpty() {
    this.empty.hidden = this.panels.length > 0;
  }

  layout() {
    const width = this.root.clientWidth;
    if (!width) return;
    this.width = width;
    if (this.axis) this.axis.setWidth(width - GUTTER - RIGHT_PAD);
    for (const panel of this.panels) panel.resize(width);
    const dpr = window.devicePixelRatio || 1;
    this.axisCanvas.width = Math.round(width * dpr);
    this.axisCanvas.height = Math.round(AXIS_H * dpr);
    this.requestRender();
  }

  requestRender() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.render();
    });
  }

  render() {
    if (!this.axis) return;
    const T = tokens();
    for (const panel of this.panels) panel.draw(this.axis, T);
    this.drawTimeAxis(T);
    this.updateCursor();
    this.updatePlayhead();
  }

  drawTimeAxis(T) {
    const ctx = this.axisCtx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, AXIS_H);
    const scale = this.axis.scale();
    const ticks = scale.ticks(Math.max(2, Math.floor(this.axis.width / 110)));
    const isWhole = (t, m) => Math.abs(t * m - Math.round(t * m)) < 1e-6;
    const digits = ticks.every((t) => isWhole(t, 1))
      ? 0
      : ticks.every((t) => isWhole(t, 10))
        ? 1
        : 2;
    ctx.strokeStyle = T.baseline;
    ctx.lineWidth = 1;
    ctx.fillStyle = T.muted;
    ctx.font = `11px ${T.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of ticks) {
      const x = Math.round(GUTTER + scale(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 5);
      ctx.stroke();
      ctx.fillText(formatTime(t, digits), x, 8);
    }
  }

  timeAt(clientX) {
    if (!this.axis) return null;
    const x = clientX - this.root.getBoundingClientRect().left - GUTTER;
    if (x < 0 || x > this.axis.width) return null;
    return this.axis.xToTime(x);
  }

  panelAt(target) {
    const node = target && target.closest ? target.closest(".panel") : null;
    return node ? this.panels.find((p) => p.el === node) || null : null;
  }

  bindPointer() {
    const root = this.root;
    const pointers = new Map();
    let gesture = null;
    let pinch = null;

    root.addEventListener("pointerdown", (e) => {
      if (e.target.closest("select, input")) return;
      if (e.target.closest("button") && !e.target.closest(".grab")) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && this.axis) {
        if (gesture && gesture.kind === "reorder") this.endReorder(false);
        gesture = null;
        root.classList.remove("dragging");
        const [a, b] = [...pointers.values()];
        pinch = {
          dist: Math.abs(a.x - b.x) || 1,
          center: (a.x + b.x) / 2,
          domain: [...this.axis.domain],
        };
        return;
      }
      if (e.button !== 0 || !this.axis) return;
      gesture = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        domain: [...this.axis.domain],
        panel: this.panelAt(e.target),
        kind: e.target.closest(".panel-head") ? "header" : "pending",
        mouse: e.pointerType !== "touch",
      };
      root.setPointerCapture(e.pointerId);
    });

    root.addEventListener("pointermove", (e) => {
      if (pointers.has(e.pointerId))
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.abs(a.x - b.x) || 1;
        const center = (a.x + b.x) / 2;
        const left = root.getBoundingClientRect().left + GUTTER;
        const span0 = pinch.domain[1] - pinch.domain[0];
        const span = span0 / (dist / pinch.dist);
        const anchor =
          pinch.domain[0] + ((pinch.center - left) / this.axis.width) * span0;
        const frac = (center - left) / this.axis.width;
        this.axis.setDomain([anchor - frac * span, anchor + (1 - frac) * span]);
        return;
      }
      if (gesture && gesture.id === e.pointerId) {
        const dx = e.clientX - gesture.x0;
        const dy = e.clientY - gesture.y0;
        if (gesture.kind === "pending" || gesture.kind === "header") {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) {
            if (gesture.kind === "pending") this.updateHover(e);
            return;
          }
          const vertical =
            gesture.kind === "header" ||
            (gesture.mouse && Math.abs(dy) > Math.abs(dx));
          if (vertical && gesture.panel) {
            gesture.kind = "reorder";
            this.beginReorder(gesture.panel, gesture.y0);
          } else {
            gesture.kind = "pan";
            root.classList.add("dragging");
            this.hideCursor();
          }
        }
        if (gesture.kind === "reorder") {
          this.moveReorder(e.clientY);
          return;
        }
        const span = gesture.domain[1] - gesture.domain[0];
        const dt = -(dx / this.axis.width) * span;
        this.axis.setDomain([gesture.domain[0] + dt, gesture.domain[1] + dt]);
        return;
      }
      this.updateHover(e);
    });

    const finish = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!gesture || gesture.id !== e.pointerId) return;
      const g = gesture;
      gesture = null;
      root.classList.remove("dragging");
      if (g.kind === "reorder") {
        this.endReorder(e.type === "pointerup");
        return;
      }
      if (g.kind === "pending" && e.type === "pointerup") {
        const t = this.timeAt(e.clientX);
        if (t != null && this.onSeek) this.onSeek(t);
      }
    };
    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", finish);
    root.addEventListener("pointerleave", () => {
      if (!this.keyboardCursor) this.hideCursor();
    });

    root.addEventListener(
      "wheel",
      (e) => {
        if (!this.axis) return;
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const t = this.timeAt(e.clientX);
          const anchor =
            t == null ? (this.axis.domain[0] + this.axis.domain[1]) / 2 : t;
          this.axis.zoomAround(Math.exp(-e.deltaY * unit * 0.0025), anchor);
          return;
        }
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          this.axis.panBy(
            ((e.deltaX * unit) / this.axis.width) * this.axis.span,
          );
        }
      },
      { passive: false },
    );
  }

  beginReorder(panel, startY) {
    const index = this.panels.indexOf(panel);
    if (index < 0) return;
    this.reorder = {
      panel,
      startY,
      index,
      insertAt: index,
      tops: this.panels.map((p) => p.el.offsetTop),
      heights: this.panels.map((p) => p.el.offsetHeight),
    };
    this.reordering = true;
    this.hideCursor();
    panel.el.classList.add("dragging");
    this.root.classList.add("reordering");
  }

  moveReorder(clientY) {
    const r = this.reorder;
    if (!r) return;
    const { tops, heights, index } = r;
    const last = tops.length - 1;
    const height = heights[index];
    const offset = clamp(
      clientY - r.startY,
      -tops[index],
      tops[last] + heights[last] - tops[index] - height,
    );
    r.panel.el.style.transform = `translateY(${offset}px)`;
    const center = tops[index] + height / 2 + offset;
    let insertAt = 0;
    for (let k = 0; k < this.panels.length; k++) {
      if (k !== index && center > tops[k] + heights[k] / 2) insertAt++;
    }
    if (insertAt === r.insertAt) return;
    r.insertAt = insertAt;
    let j = 0;
    for (let k = 0; k < this.panels.length; k++) {
      if (k === index) continue;
      const current = k > index ? height : 0;
      const final = j >= insertAt ? height : 0;
      this.panels[k].el.style.transform =
        final === current ? "" : `translateY(${final - current}px)`;
      j++;
    }
  }

  endReorder(commit) {
    const r = this.reorder;
    if (!r) return;
    for (const p of this.panels) {
      p.el.style.transform = "";
      p.el.classList.remove("dragging");
    }
    this.root.classList.remove("reordering");
    this.reordering = false;
    this.reorder = null;
    if (!commit || r.insertAt === r.index) return;
    this.panels.splice(r.index, 1);
    this.panels.splice(r.insertAt, 0, r.panel);
    const next = this.panels[r.insertAt + 1];
    this.root.insertBefore(r.panel.el, next ? next.el : this.empty);
    this.requestRender();
    if (this.onChange) this.onChange("reorder");
  }

  updateHover(e) {
    if (this.reordering) return;
    const t = this.timeAt(e.clientX);
    if (t == null) {
      this.hideCursor();
      return;
    }
    const panel = this.panelAt(e.target);
    const y = panel ? e.clientY - panel.el.getBoundingClientRect().top : null;
    const rootY = e.clientY - this.root.getBoundingClientRect().top;
    this.keyboardCursor = false;
    this.setCursor(t, panel, y, rootY);
  }

  setCursor(time, panel = null, y = null, rootY = null) {
    this.cursor = { time, panel, y, rootY };
    this.updateCursor();
  }

  hideCursor() {
    this.cursor = null;
    this.keyboardCursor = false;
    this.updateCursor();
  }

  updateCursor() {
    if (!this.cursor || !this.axis || !this.panels.length) {
      this.crosshair.hidden = true;
      this.readout.hidden = true;
      return;
    }
    const x = this.axis.timeToX(this.cursor.time);
    if (x < -0.5 || x > this.axis.width + 0.5) {
      this.crosshair.hidden = true;
      this.readout.hidden = true;
      return;
    }
    const left = GUTTER + x;
    this.crosshair.style.left = `${left}px`;
    this.crosshair.hidden = false;
    this.renderReadout(left);
  }

  renderReadout(left) {
    const readout = this.readout;
    const time = el("div", "rtime", formatTime(this.cursor.time, 2));
    const table = document.createElement("table");
    for (const panel of this.panels) {
      const result = panel.data
        ? panel.valueAt(
            this.cursor.time,
            panel === this.cursor.panel ? this.cursor.y : null,
          )
        : null;
      const row = document.createElement("tr");
      const keyCell = el("td");
      const key = el("span", "k");
      key.style.background = `var(--hue-${panel.feature.group})`;
      keyCell.append(key);
      const value = result ? result.value : panel.error ? "-" : "...";
      const label = result && result.label ? result.label : panel.feature.label;
      row.append(keyCell, el("td", "v", value), el("td", "l", label));
      table.append(row);
    }
    readout.replaceChildren(time, table);
    readout.hidden = false;
    const w = readout.offsetWidth;
    const h = readout.offsetHeight;
    let x = left + 14;
    if (x + w > this.width - 4) x = left - 14 - w;
    const wantY = this.cursor.rootY == null ? 8 : this.cursor.rootY + 16;
    const y = clamp(wantY, 4, Math.max(4, this.root.clientHeight - h - 4));
    readout.style.left = `${Math.max(4, x)}px`;
    readout.style.top = `${y}px`;
  }

  setPlayTime(t) {
    this.playTime = t;
    this.updatePlayhead();
  }

  updatePlayhead() {
    if (!this.axis || !this.panels.length || !(this.playTime > 0)) {
      this.playhead.hidden = true;
      return;
    }
    const x = this.axis.timeToX(this.playTime);
    if (x < 0 || x > this.axis.width) {
      this.playhead.hidden = true;
      return;
    }
    this.playhead.style.left = `${GUTTER + x - 1}px`;
    this.playhead.hidden = false;
  }

  bindKeyboard() {
    this.root.addEventListener("keydown", (e) => {
      if (!this.axis || e.target !== this.root) return;
      const axis = this.axis;
      const center = (axis.domain[0] + axis.domain[1]) / 2;
      const current = this.cursor ? this.cursor.time : center;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        const step = e.shiftKey ? 1 : this.frameDt;
        const t = clamp(current + direction * step, 0, axis.duration);
        if (t < axis.domain[0]) axis.panBy(t - axis.domain[0]);
        else if (t > axis.domain[1]) axis.panBy(t - axis.domain[1]);
        this.keyboardCursor = true;
        const c = this.cursor || {};
        this.setCursor(
          t,
          c.panel || null,
          c.y == null ? null : c.y,
          c.rootY == null ? null : c.rootY,
        );
        e.preventDefault();
      } else if (e.key === "Escape") {
        this.hideCursor();
      } else if (e.key === "+" || e.key === "=") {
        axis.zoomAround(1.5, current);
        e.preventDefault();
      } else if (e.key === "-" || e.key === "_") {
        axis.zoomAround(1 / 1.5, current);
        e.preventDefault();
      } else if (e.key === "0") {
        axis.reset();
        e.preventDefault();
      } else if (e.key === "Enter" && this.cursor && this.onSeek) {
        this.onSeek(this.cursor.time);
        e.preventDefault();
      }
    });
  }

  bindDrag() {
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.reorder) {
        this.endReorder(false);
        return;
      }
      const handle = e.target.closest ? e.target.closest(".grab") : null;
      const panel = handle ? this.panelAt(handle) : null;
      if (!panel) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      this.moveBy(panel, e.key === "ArrowUp" ? -1 : 1);
      panel.grab.focus();
    });
  }

  moveBy(panel, direction) {
    const from = this.panels.indexOf(panel);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= this.panels.length) return;
    this.move(panel, this.panels[to], direction < 0);
    if (this.onChange) this.onChange("reorder");
  }

  move(panel, target, before) {
    const from = this.panels.indexOf(panel);
    if (from < 0) return;
    this.panels.splice(from, 1);
    const at = this.panels.indexOf(target) + (before ? 0 : 1);
    this.panels.splice(at, 0, panel);
    this.root.insertBefore(
      panel.el,
      before ? target.el : target.el.nextSibling,
    );
    this.requestRender();
  }

  exportCsv(track) {
    if (!this.axis || !track) return;
    const dt = track.hop_length / track.sr;
    const [t0, t1] = this.axis.domain;
    const frames = track.frames || Math.ceil(track.duration / dt);
    const i0 = Math.max(0, Math.ceil(t0 / dt));
    const i1 = Math.min(frames - 1, Math.floor(t1 / dt));
    const columns = this.panels.flatMap((p) => (p.data ? p.csvColumns() : []));
    const quote = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [
      ["time_s", ...columns.map((c) => c.name)].map(quote).join(","),
    ];
    for (let i = i0; i <= i1; i++) {
      const row = [(i * dt).toFixed(4)];
      for (const column of columns) {
        const v = column.at(i);
        row.push(
          v == null || v !== v
            ? ""
            : typeof v === "number"
              ? String(+v.toFixed(6))
              : quote(v),
        );
      }
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = (t) => formatTime(t).replace(":", "m") + "s";
    a.href = url;
    a.download = `${track.id}_${stamp(t0)}-${stamp(t1)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
