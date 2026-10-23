import { LinePanel } from "./line.js";
import { PitchPanel } from "./pitch.js";
import { StepPanel } from "./step.js";
import { EventsPanel } from "./events.js";
import { HeatmapPanel } from "./heatmap.js";

export { GUTTER, RIGHT_PAD } from "./base.js";

const KINDS = {
  line: LinePanel,
  pitch: PitchPanel,
  step: StepPanel,
  events: EventsPanel,
  heatmap: HeatmapPanel,
};

export function createPanel(feature, track) {
  const Kind = KINDS[feature.panel] || LinePanel;
  return new Kind(feature, track);
}
