import { clamp } from "./format.js";

export class TimeAxis {
  constructor(duration) {
    this.duration = Math.max(duration || 0, 0.001);
    this.minSpan = Math.min(0.25, this.duration);
    this.domain = [0, this.duration];
    this.width = 1;
    this.listeners = new Set();
  }

  get span() {
    return this.domain[1] - this.domain[0];
  }

  get isFull() {
    return this.domain[0] <= 0 && this.domain[1] >= this.duration;
  }

  setWidth(width) {
    this.width = Math.max(1, width);
  }

  scale() {
    return d3.scaleLinear().domain(this.domain).range([0, this.width]);
  }

  timeToX(t) {
    return ((t - this.domain[0]) / this.span) * this.width;
  }

  xToTime(x) {
    return this.domain[0] + (x / this.width) * this.span;
  }

  setDomain([t0, t1]) {
    let span = clamp(t1 - t0, this.minSpan, this.duration);
    let start = t0;
    if (start < 0) start = 0;
    if (start + span > this.duration) start = this.duration - span;
    const next = [start, start + span];
    if (next[0] === this.domain[0] && next[1] === this.domain[1]) return;
    this.domain = next;
    for (const fn of this.listeners) fn(this);
  }

  zoomAround(factor, t) {
    const span = clamp(this.span / factor, this.minSpan, this.duration);
    const frac = clamp((t - this.domain[0]) / this.span, 0, 1);
    this.setDomain([t - frac * span, t + (1 - frac) * span]);
  }

  setSpan(span, center) {
    const s = clamp(span, this.minSpan, this.duration);
    this.setDomain([center - s / 2, center + s / 2]);
  }

  panBy(dt) {
    this.setDomain([this.domain[0] + dt, this.domain[1] + dt]);
  }

  reset() {
    this.setDomain([0, this.duration]);
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
