import { Panel } from "./base.js";
import { sampleSeries, visibleExtent, drawSampled } from "./sampling.js";
import { formatValue, formatTick } from "../format.js";

export class LinePanel extends Panel {
  get supportsFitY() {
    return true;
  }

  yDomain(axis) {
    const f = this.feature;
    const d = this.data;
    if (f.domain) return f.domain;
    let [lo, hi] = [d.min, d.max];
    if (this.fitY) {
      const [vlo, vhi] = visibleExtent(d.values, d.dt, axis);
      if (vlo === vlo) [lo, hi] = [vlo, vhi];
    }
    if (!(lo === lo) || !(hi === hi)) [lo, hi] = [0, 1];
    if (f.min != null) lo = Math.min(lo, f.min);
    if (f.baseline != null) {
      const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
      lo = -m;
      hi = m;
    }
    if (hi - lo <= 0) hi = lo + 1;
    const pad = (hi - lo) * 0.06;
    const lowPad = f.min != null && lo <= f.min ? 0 : pad;
    return [lo - lowPad, hi + pad];
  }

  yScale(axis) {
    return d3.scaleLinear().domain(this.yDomain(axis)).range([this.plotBottom, this.plotTop]);
  }

  yTicks(scale) {
    return scale.ticks(4);
  }

  tickFormat(v) {
    return formatTick(v);
  }

  drawPlot(ctx, axis, T) {
    const y = this.yScale(axis);
    this.drawYAxis(ctx, y, T, this.yTicks(y), (v) => this.tickFormat(v));
    if (this.feature.baseline != null) {
      const by = Math.round(y(this.feature.baseline)) + 0.5;
      ctx.strokeStyle = T.baseline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.plotLeft, by);
      ctx.lineTo(this.plotRight, by);
      ctx.stroke();
    }
    const sample = sampleSeries(this.data.values, this.data.dt, axis, this.plotLeft, this.plotWidth);
    this.clipPlot(ctx);
    drawSampled(ctx, sample, y, this.hue(T));
    ctx.restore();
  }

  valueAt(time) {
    const v = this.data.values[this.frameAt(time)];
    const units = this.feature.units ? ` ${this.feature.units}` : "";
    return { value: v === v ? `${formatValue(v, this.feature.decimals)}${units}` : "-" };
  }

  csvColumns() {
    const values = this.data.values;
    return [{ name: this.feature.id, at: (i) => (i < values.length ? values[i] : NaN) }];
  }
}
