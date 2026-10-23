export function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const panels = (params.get("panels") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const view = (params.get("view") || "").split("-").map(Number);
  return {
    track: params.get("track") || null,
    panels: params.has("panels") ? panels : null,
    view:
      view.length === 2 && view.every(Number.isFinite) && view[1] > view[0]
        ? view
        : null,
  };
}

let timer = 0;

export function writeHash({ track, panels, view }) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const params = new URLSearchParams();
    if (track) params.set("track", track);
    params.set("panels", panels.join(","));
    if (view) params.set("view", `${view[0]}-${view[1]}`);
    const next = `#${params.toString()}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }, 150);
}
