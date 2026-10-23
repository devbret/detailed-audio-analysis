import { Panel } from "./base.js";
import { bisectRight, formatValue } from "../format.js";

export class StepPanel extends Panel {
  get supportsFitY() {
    return true;
  }

  intervalEnd(k) {
    const d = this.data;
    if (k + 1 < d.n) return d.times[k + 1];
    const bpm = d.values[k];
    return d.times[k] + (bpm > 0 ? 60 / bpm : 0);
  }

  yDomain(axis) {
    const d = this.data;
    let lo = d.min;
    let hi = d.max;
    if (this.fitY) {
      const [t0, t1] = axis.domain;
      let vlo = Infinity;
      let vhi = -Infinity;
      for (let k = 0; k < d.n; k++) {
        if (this.intervalEnd(k) < t0 || d.times[k] > t1) continue;
        const v = d.values[k];
        if (v !== v) continue;
        if (v < vlo) vlo = v;
        if (v > vhi) vhi = v;
      }
      if (vlo <= vhi) [lo, hi] = [vlo, vhi];
    }
    const overall = this.track.overall_tempo;
    if (Number.isFinite(overall) && !this.fitY) {
      lo = Math.min(lo, overall);
      hi = Math.max(hi, overall);
    }
    if (!(lo === lo)) [lo, hi] = [60, 180];
    const mid = (lo + hi) / 2;
    lo = Math.min(lo, mid - 3);
    hi = Math.max(hi, mid + 3);
    const pad = (hi - lo) * 0.1;
    return [lo - pad, hi + pad];
  }

  drawPlot(ctx, axis, T) {
    const d = this.data;
    if (!d.values || d.n < 2) {
      this.drawMessage(ctx, "Not enough beats to estimate tempo", T);
      return;
    }
    const y = d3.scaleLinear().domain(this.yDomain(axis)).range([this.plotBottom, this.plotTop]);
    this.drawYAxis(ctx, y, T);
    const [t0, t1] = axis.domain;
    const overall = this.track.overall_tempo;
    this.clipPlot(ctx);
    if (Number.isFinite(overall)) {
      const oy = Math.round(y(overall)) + 0.5;
      ctx.strokeStyle = T.baseline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.plotLeft, oy);
      ctx.lineTo(this.plotRight, oy);
      ctx.stroke();
      ctx.fillStyle = T.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${overall.toFixed(1)} BPM overall`, this.plotRight - 4, oy - 2);
    }
    let k = Math.max(0, bisectRight(d.times, t0) - 1);
    ctx.strokeStyle = this.hue(T);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let open = false;
    for (; k < d.n && d.times[k] <= t1; k++) {
      const v = d.values[k];
      if (v !== v) {
        open = false;
        continue;
      }
      const xa = this.plotLeft + axis.timeToX(d.times[k]);
      const xb = this.plotLeft + axis.timeToX(this.intervalEnd(k));
      const py = y(v);
      if (open) ctx.lineTo(xa, py);
      else ctx.moveTo(xa, py);
      ctx.lineTo(xb, py);
      open = true;
    }
    ctx.stroke();
    ctx.restore();
  }

  bpmAt(time) {
    const d = this.data;
    const k = bisectRight(d.times, time) - 1;
    if (k < 0 || time > this.intervalEnd(k)) return NaN;
    return d.values[k];
  }

  valueAt(time) {
    const v = this.bpmAt(time);
    return { value: v === v ? `${formatValue(v, this.feature.decimals)} BPM` : "-" };
  }

  csvColumns() {
    const dt = this.data.dt;
    return [{ name: "tempo_bpm", at: (i) => this.bpmAt(i * dt) }];
  }
}
