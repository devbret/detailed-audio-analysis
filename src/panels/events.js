import { Panel } from "./base.js";
import { bisectLeft, bisectRight, formatTime } from "../format.js";

export class EventsPanel extends Panel {
  get supportsTall() {
    return false;
  }

  get baseHeight() {
    return 50;
  }

  get plotBottom() {
    return this.height - 6;
  }

  drawPlot(ctx, axis, T) {
    const times = this.data.times;
    const [t0, t1] = axis.domain;
    const k0 = bisectLeft(times, t0);
    const k1 = bisectRight(times, t1);
    const wide = axis.span < 20;
    const spacing = this.plotWidth / Math.max(1, k1 - k0);
    ctx.fillStyle = this.hue(T);
    ctx.globalAlpha = spacing < 3 ? 0.45 : 1;
    let lastPx = -1;
    for (let k = k0; k < k1; k++) {
      const px = Math.round(this.plotLeft + axis.timeToX(times[k]));
      if (px === lastPx) continue;
      lastPx = px;
      ctx.fillRect(
        px - (wide ? 1 : 0),
        this.plotTop,
        wide ? 2 : 1,
        this.plotHeight,
      );
    }
    ctx.globalAlpha = 1;
    const label = `${k1 - k0} in view`;
    const labelWidth = ctx.measureText(label).width + 10;
    ctx.fillStyle = T.surface;
    ctx.fillRect(
      this.plotRight - labelWidth,
      this.plotTop,
      labelWidth,
      this.plotHeight,
    );
    ctx.fillStyle = T.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, this.plotRight - 4, this.plotTop + this.plotHeight / 2);
  }

  nearest(time) {
    const times = this.data.times;
    if (!times.length) return -1;
    const k = bisectLeft(times, time);
    const candidates = [k - 1, k].filter((i) => i >= 0 && i < times.length);
    let best = -1;
    let bestDist = Infinity;
    for (const i of candidates) {
      const dist = Math.abs(times[i] - time);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    }
    return best;
  }

  valueAt(time) {
    const k = this.nearest(time);
    if (k < 0) return { value: "-" };
    const t = this.data.times[k];
    if (Math.abs(t - time) > Math.max(0.25, this.data.dt * 2))
      return { value: "-" };
    const bpm = this.data.values ? this.data.values[k] : NaN;
    return {
      value: formatTime(t, 2) + (bpm === bpm ? `, ${bpm.toFixed(1)} BPM` : ""),
    };
  }

  csvColumns() {
    const { times, dt } = this.data;
    return [
      {
        name: this.feature.id,
        at: (i) =>
          bisectLeft(times, (i + 0.5) * dt) - bisectLeft(times, (i - 0.5) * dt),
      },
    ];
  }
}
