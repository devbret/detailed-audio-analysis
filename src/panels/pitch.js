import { LinePanel } from "./line.js";
import { visibleExtent } from "./sampling.js";
import { noteName, formatValue } from "../format.js";

const C2 = 65.40639;
const C7 = 2093.0045;

export class PitchPanel extends LinePanel {
  yDomain(axis) {
    const d = this.data;
    if (this.fitY) {
      const [vlo, vhi] = visibleExtent(d.values, d.dt, axis);
      if (vlo === vlo && vlo > 0) return [vlo / 1.12, vhi * 1.12];
    }
    let lo = C2;
    let hi = C7;
    if (d.min === d.min && d.min < lo) lo = lo / 2 ** Math.ceil(Math.log2(lo / d.min));
    if (d.max === d.max && d.max > hi) hi = hi * 2 ** Math.ceil(Math.log2(d.max / hi));
    return [lo, hi];
  }

  yScale(axis) {
    return d3.scaleLog().domain(this.yDomain(axis)).range([this.plotBottom, this.plotTop]);
  }

  yTicks(scale) {
    const [lo, hi] = scale.domain();
    const ticks = [];
    const octaves = Math.log2(hi / lo);
    const step = octaves > 2.5 ? 12 : octaves > 1 ? 4 : 1;
    const firstMidi = Math.ceil(69 + 12 * Math.log2(lo / 440));
    for (let midi = firstMidi; ; midi++) {
      if (step === 12 && midi % 12 !== 0) continue;
      if (step === 4 && midi % 4 !== 0) continue;
      const f = 440 * 2 ** ((midi - 69) / 12);
      if (f > hi * 1.0001) break;
      ticks.push(f);
    }
    return ticks;
  }

  tickFormat(v) {
    return noteName(v, false);
  }

  valueAt(time) {
    const v = this.data.values[this.frameAt(time)];
    if (v !== v) return { value: "unvoiced" };
    return { value: `${formatValue(v, this.feature.decimals)} Hz`, label: `${this.feature.label}: ${noteName(v)}` };
  }
}
