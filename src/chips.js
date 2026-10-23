import { GROUPS, FEATURES } from "./features.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function buildChips(container, track, openIds, onToggle, onReset) {
  container.replaceChildren();
  for (const group of GROUPS) {
    const wrap = el("div", "chip-group");
    wrap.append(el("span", "group-label", group.label));
    for (const feature of FEATURES) {
      if (feature.group !== group.id) continue;
      const chip = el("button", "chip");
      chip.type = "button";
      chip.dataset.feature = feature.id;
      chip.style.setProperty("--chip-hue", `var(--hue-${group.id})`);
      chip.title = feature.description || feature.label;
      chip.append(el("span", "key"), document.createTextNode(feature.label));
      const available = !!(track && track.features[feature.source]);
      chip.disabled = !available;
      chip.setAttribute(
        "aria-pressed",
        String(available && openIds.includes(feature.id)),
      );
      chip.addEventListener("click", () => {
        const next = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", String(next));
        onToggle(feature.id, next);
      });
      wrap.append(chip);
    }
    container.append(wrap);
  }
  const reset = el("button", "btn chip-reset", "Default panels");
  reset.type = "button";
  reset.addEventListener("click", onReset);
  container.append(reset);
}

export function setChipPressed(container, id, pressed) {
  const chip = container.querySelector(`[data-feature="${id}"]`);
  if (chip) chip.setAttribute("aria-pressed", String(pressed));
}
