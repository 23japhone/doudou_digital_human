export interface DoudouOfficialLive2DRendererRuntimeSmokeEvidence {
  activeEmotionId: string;
  canvasLayerVisible: boolean;
  canvasNonTransparentPixel: boolean;
  drawCalls: number;
  expressionAppliedAfterFrame: boolean;
  expressionCanvasChangedAfterFrame: boolean;
  expressionCount: number;
  expressionEmotionIdsObserved: string[];
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelLoaded: boolean;
  pendingExpressionSwitches: number;
  rendererAssetProbe: string;
  runtimeFailureReason: string | null;
  runtimeLifecycle: {
    drawCalls: number;
    expressionLoadCalls: number;
    expressionSetCalls: number;
    modelUpdateCalls: number;
    updateMotionCalls: number;
  };
  runtimeModuleProbe: string;
  updateCalls: number;
}

export interface DoudouOfficialLive2DRendererSmokeEvidenceSet {
  fixtureBundle?: DoudouOfficialLive2DRendererRuntimeSmokeEvidence;
  generatedBundle?: DoudouOfficialLive2DRendererRuntimeSmokeEvidence;
}

export type DoudouOfficialLive2DRendererSmokeFailureCategory =
  | "asset"
  | "canvas"
  | "expression"
  | "frameLoop"
  | "missing"
  | "model"
  | "runtime";

export type DoudouOfficialLive2DRendererSmokeFailureSummary = Partial<
  Record<DoudouOfficialLive2DRendererSmokeFailureCategory, string[]>
>;

export function parseDoudouOfficialLive2DRendererSmokeEvidence(
  output: string
): DoudouOfficialLive2DRendererSmokeEvidenceSet {
  return {
    fixtureBundle: parseDoudouOfficialLive2DRendererSmokeLine(output, "runtime smoke fixture bundle: "),
    generatedBundle: parseDoudouOfficialLive2DRendererSmokeLine(output, "runtime smoke generated bundle: ")
  };
}

export function doudouOfficialLive2DRendererSmokeEvidenceFailures(
  evidence: DoudouOfficialLive2DRendererSmokeEvidenceSet
): string[] {
  return [
    ...doudouOfficialLive2DRendererRuntimeEvidenceFailures("fixtureBundle", evidence.fixtureBundle),
    ...doudouOfficialLive2DRendererRuntimeEvidenceFailures("generatedBundle", evidence.generatedBundle)
  ];
}

export function doudouOfficialLive2DRendererSmokeFailureSummary(
  failedChecks: readonly string[]
): DoudouOfficialLive2DRendererSmokeFailureSummary {
  const grouped = new Map<DoudouOfficialLive2DRendererSmokeFailureCategory, string[]>();
  for (const failedCheck of failedChecks) {
    const category = smokeFailureCategory(failedCheck);
    const checks = grouped.get(category) ?? [];
    checks.push(failedCheck);
    grouped.set(category, checks);
  }
  const summary: DoudouOfficialLive2DRendererSmokeFailureSummary = {};
  for (const category of FAILURE_CATEGORY_ORDER) {
    const checks = grouped.get(category);
    if (checks && checks.length > 0) {
      summary[category] = checks;
    }
  }
  return summary;
}

export function doudouOfficialLive2DRendererRuntimeEvidenceFailures(
  label: string,
  evidence: DoudouOfficialLive2DRendererRuntimeSmokeEvidence | undefined
): string[] {
  if (!evidence) {
    return [`${label}.missing`];
  }
  const failures: string[] = [];
  if (evidence.rendererAssetProbe !== "model3_fetched") {
    failures.push(`${label}.rendererAssetProbe`);
  }
  if (evidence.runtimeModuleProbe !== "loaded") {
    failures.push(`${label}.runtimeModuleProbe`);
  }
  if (evidence.runtimeModuleProbe === "loaded" && evidence.runtimeFailureReason !== null) {
    failures.push(`${label}.runtimeFailureReason`);
  }
  if (!evidence.modelLoaded) {
    failures.push(`${label}.modelLoaded`);
  }
  if (!evidence.canvasLayerVisible) {
    failures.push(`${label}.canvasLayerVisible`);
  }
  if (!evidence.canvasNonTransparentPixel) {
    failures.push(`${label}.canvasNonTransparentPixel`);
  }
  if (evidence.expressionCount !== 12) {
    failures.push(`${label}.expressionCount`);
  }
  if (evidence.expressionSwitches <= 0) {
    failures.push(`${label}.expressionSwitches`);
  }
  if (!evidence.expressionAppliedAfterFrame) {
    failures.push(`${label}.expressionAppliedAfterFrame`);
  }
  if (!evidence.expressionCanvasChangedAfterFrame) {
    failures.push(`${label}.expressionCanvasChangedAfterFrame`);
  }
  if (evidence.pendingExpressionSwitches > 0) {
    failures.push(`${label}.pendingExpressionSwitches`);
  }
  if (new Set(evidence.expressionEmotionIdsObserved.filter((emotionId) => emotionId !== "calm_idle")).size < 2) {
    failures.push(`${label}.expressionEmotionIdsObserved`);
  }
  if (evidence.runtimeLifecycle.expressionLoadCalls < 12) {
    failures.push(`${label}.runtimeLifecycle.expressionLoadCalls`);
  }
  if (evidence.runtimeLifecycle.expressionSetCalls < 2) {
    failures.push(`${label}.runtimeLifecycle.expressionSetCalls`);
  }
  if (evidence.runtimeLifecycle.updateMotionCalls < 2) {
    failures.push(`${label}.runtimeLifecycle.updateMotionCalls`);
  }
  if (evidence.runtimeLifecycle.modelUpdateCalls < 2) {
    failures.push(`${label}.runtimeLifecycle.modelUpdateCalls`);
  }
  if (evidence.runtimeLifecycle.drawCalls < 2) {
    failures.push(`${label}.runtimeLifecycle.drawCalls`);
  }
  if (!evidence.frameLoopAdvanced) {
    failures.push(`${label}.frameLoopAdvanced`);
  }
  if (evidence.drawCalls < 2) {
    failures.push(`${label}.drawCalls`);
  }
  if (evidence.updateCalls < 2) {
    failures.push(`${label}.updateCalls`);
  }
  if (evidence.activeEmotionId.length === 0 || evidence.activeEmotionId === "calm_idle") {
    failures.push(`${label}.activeEmotionId`);
  }
  return failures;
}

export function hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(
  evidence: DoudouOfficialLive2DRendererRuntimeSmokeEvidence | undefined
): boolean {
  return doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence).length === 0;
}

export function sanitizeDoudouOfficialLive2DRendererRuntimeSmokeEvidence(
  value: unknown
): DoudouOfficialLive2DRendererRuntimeSmokeEvidence | undefined {
  if (!isRecord(value) || !isRecord(value.live2DRendererSpike)) {
    return undefined;
  }
  const officialRuntime = value.live2DRendererSpike.officialRuntime;
  if (!isRecord(officialRuntime) || !isRecord(officialRuntime.runtimeModule)) {
    return undefined;
  }
  const runtimeModule = officialRuntime.runtimeModule;
  if (
    !isRecord(runtimeModule.runtimeLifecycle) ||
    typeof officialRuntime.canvasLayerVisible !== "boolean" ||
    typeof officialRuntime.canvasNonTransparentPixel !== "boolean" ||
    typeof officialRuntime.rendererAssetProbe !== "string" ||
    typeof runtimeModule.activeEmotionId !== "string" ||
    typeof runtimeModule.drawCalls !== "number" ||
    typeof runtimeModule.expressionAppliedAfterFrame !== "boolean" ||
    typeof runtimeModule.expressionCanvasChangedAfterFrame !== "boolean" ||
    typeof runtimeModule.expressionCount !== "number" ||
    !isStringArray(runtimeModule.expressionEmotionIdsObserved) ||
    typeof runtimeModule.expressionSwitches !== "number" ||
    typeof runtimeModule.frameLoopAdvanced !== "boolean" ||
    typeof runtimeModule.modelLoaded !== "boolean" ||
    typeof runtimeModule.pendingExpressionSwitches !== "number" ||
    typeof runtimeModule.runtimeModuleProbe !== "string" ||
    typeof runtimeModule.updateCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.drawCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.expressionLoadCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.expressionSetCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.modelUpdateCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.updateMotionCalls !== "number"
  ) {
    return undefined;
  }
  const runtimeFailureReason = sanitizeRuntimeFailureReason(runtimeModule.runtimeFailureReason);
  return {
    activeEmotionId: runtimeModule.activeEmotionId,
    canvasLayerVisible: officialRuntime.canvasLayerVisible,
    canvasNonTransparentPixel: officialRuntime.canvasNonTransparentPixel,
    drawCalls: runtimeModule.drawCalls,
    expressionAppliedAfterFrame: runtimeModule.expressionAppliedAfterFrame,
    expressionCanvasChangedAfterFrame: runtimeModule.expressionCanvasChangedAfterFrame,
    expressionCount: runtimeModule.expressionCount,
    expressionEmotionIdsObserved: runtimeModule.expressionEmotionIdsObserved,
    expressionSwitches: runtimeModule.expressionSwitches,
    frameLoopAdvanced: runtimeModule.frameLoopAdvanced,
    modelLoaded: runtimeModule.modelLoaded,
    pendingExpressionSwitches: runtimeModule.pendingExpressionSwitches,
    rendererAssetProbe: officialRuntime.rendererAssetProbe,
    runtimeFailureReason,
    runtimeLifecycle: {
      drawCalls: runtimeModule.runtimeLifecycle.drawCalls,
      expressionLoadCalls: runtimeModule.runtimeLifecycle.expressionLoadCalls,
      expressionSetCalls: runtimeModule.runtimeLifecycle.expressionSetCalls,
      modelUpdateCalls: runtimeModule.runtimeLifecycle.modelUpdateCalls,
      updateMotionCalls: runtimeModule.runtimeLifecycle.updateMotionCalls
    },
    runtimeModuleProbe: runtimeModule.runtimeModuleProbe,
    updateCalls: runtimeModule.updateCalls
  };
}

function parseDoudouOfficialLive2DRendererSmokeLine(
  output: string,
  prefix: string
): DoudouOfficialLive2DRendererRuntimeSmokeEvidence | undefined {
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(line.slice(prefix.length)) as unknown;
    return sanitizeDoudouOfficialLive2DRendererRuntimeSmokeEvidence(parsed);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sanitizeRuntimeFailureReason(value: unknown): string | null {
  if (
    value === "core_or_module_load_failed" ||
    value === "model_or_expression_load_failed" ||
    value === "expression_switch_rejected" ||
    value === "frame_failed"
  ) {
    return value;
  }
  return null;
}

const FAILURE_CATEGORY_ORDER: DoudouOfficialLive2DRendererSmokeFailureCategory[] = [
  "asset",
  "canvas",
  "expression",
  "frameLoop",
  "missing",
  "model",
  "runtime"
];

function smokeFailureCategory(failedCheck: string): DoudouOfficialLive2DRendererSmokeFailureCategory {
  if (failedCheck.endsWith(".missing")) {
    return "missing";
  }
  if (failedCheck.endsWith(".rendererAssetProbe")) {
    return "asset";
  }
  if (
    failedCheck.endsWith(".canvasLayerVisible") ||
    failedCheck.endsWith(".canvasNonTransparentPixel")
  ) {
    return "canvas";
  }
  if (
    failedCheck.endsWith(".modelLoaded")
  ) {
    return "model";
  }
  if (
    failedCheck.endsWith(".frameLoopAdvanced") ||
    failedCheck.endsWith(".drawCalls") ||
    failedCheck.endsWith(".updateCalls") ||
    failedCheck.endsWith(".runtimeLifecycle.updateMotionCalls") ||
    failedCheck.endsWith(".runtimeLifecycle.modelUpdateCalls") ||
    failedCheck.endsWith(".runtimeLifecycle.drawCalls")
  ) {
    return "frameLoop";
  }
  if (
    failedCheck.endsWith(".activeEmotionId") ||
    failedCheck.endsWith(".expressionAppliedAfterFrame") ||
    failedCheck.endsWith(".expressionCanvasChangedAfterFrame") ||
    failedCheck.endsWith(".expressionCount") ||
    failedCheck.endsWith(".expressionEmotionIdsObserved") ||
    failedCheck.endsWith(".expressionSwitches") ||
    failedCheck.endsWith(".pendingExpressionSwitches") ||
    failedCheck.endsWith(".runtimeLifecycle.expressionLoadCalls") ||
    failedCheck.endsWith(".runtimeLifecycle.expressionSetCalls")
  ) {
    return "expression";
  }
  return "runtime";
}
