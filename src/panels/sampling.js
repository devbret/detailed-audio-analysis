export function sampleSeries(values, dt, axis, x0, width) {
  const [t0, t1] = axis.domain;
  const span = t1 - t0;
  const framesPerPx = span / dt / width;
  if (framesPerPx <= 1.5) {
    const i0 = Math.max(0, Math.floor(t0 / dt) - 1);
    const i1 = Math.min(values.length - 1, Math.ceil(t1 / dt) + 1);
    const xs = [];
    const ys = [];
    for (let i = i0; i <= i1; i++) {
      xs.push(x0 + ((i * dt - t0) / span) * width);
      ys.push(values[i]);
    }
    return { dense: false, xs, ys };
  }
  const n = Math.ceil(width);
  const mins = new Float32Array(n).fill(NaN);
  const maxs = new Float32Array(n).fill(NaN);
  const means = new Float32Array(n).fill(NaN);
  const last = values.length - 1;
  for (let px = 0; px < n; px++) {
    const ta = t0 + (px / width) * span;
    const tb = t0 + ((px + 1) / width) * span;
    const ia = Math.max(0, Math.ceil(ta / dt));
    const ib = Math.min(last, Math.ceil(tb / dt) - 1);
    if (ib < ia) continue;
    let mn = Infinity;
    let mx = -Infinity;
    let sum = 0;
    let count = 0;
    for (let i = ia; i <= ib; i++) {
      const v = values[i];
      if (v !== v) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sum += v;
      count++;
    }
    if (!count) continue;
    mins[px] = mn;
    maxs[px] = mx;
    means[px] = sum / count;
  }
  return { dense: true, x0, mins, maxs, means };
}

export function visibleExtent(values, dt, axis) {
  const [t0, t1] = axis.domain;
  const i0 = Math.max(0, Math.floor(t0 / dt));
  const i1 = Math.min(values.length - 1, Math.ceil(t1 / dt));
  let min = Infinity;
  let max = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const v = values[i];
    if (v !== v) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : [NaN, NaN];
}

export function drawSampled(ctx, sample, y, color, { washAlpha = 0.22, lineWidth = 2 } = {}) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  if (!sample.dense) {
    const { xs, ys } = sample;
    const sparse = xs.length > 1 && xs[1] - xs[0] > 14;
    ctx.beginPath();
    let open = false;
    for (let k = 0; k < xs.length; k++) {
      const v = ys[k];
      if (v !== v) {
        open = false;
        continue;
      }
      if (open) ctx.lineTo(xs[k], y(v));
      else ctx.moveTo(xs[k], y(v));
      open = true;
    }
    ctx.stroke();
    if (sparse) {
      for (let k = 0; k < xs.length; k++) {
        const v = ys[k];
        if (v !== v) continue;
        ctx.beginPath();
        ctx.arc(xs[k], y(v), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  const { x0, mins, maxs, means } = sample;
  const n = mins.length;
  let k = 0;
  while (k < n) {
    if (mins[k] !== mins[k]) {
      k++;
      continue;
    }
    let e = k;
    while (e < n && mins[e] === mins[e]) e++;
    if (e - k === 1) {
      ctx.fillRect(x0 + k, Math.min(y(maxs[k]), y(mins[k])) - 1, 1.5, Math.abs(y(mins[k]) - y(maxs[k])) + 2);
      k = e;
      continue;
    }
    ctx.globalAlpha = washAlpha;
    ctx.beginPath();
    for (let i = k; i < e; i++) ctx.lineTo(x0 + i + 0.5, y(maxs[i]));
    for (let i = e - 1; i >= k; i--) ctx.lineTo(x0 + i + 0.5, y(mins[i]));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let i = k; i < e; i++) ctx.lineTo(x0 + i + 0.5, y(means[i]));
    ctx.stroke();
    k = e;
  }
}
