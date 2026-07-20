const WITHOUT_SIZE_CONTROLS = new Set(["client", "mobile"]);
const WITHOUT_SCALING_CONTROLS = new Set([
  ...WITHOUT_SIZE_CONTROLS,
  "model-monitoring",
  "llm-observability",
]);

export const hasSizeControls = (archetype: string) =>
  !WITHOUT_SIZE_CONTROLS.has(archetype);

export const hasScalingControls = (archetype: string) =>
  !WITHOUT_SCALING_CONTROLS.has(archetype);
