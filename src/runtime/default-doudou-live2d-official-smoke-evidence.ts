export interface DoudouOfficialLive2DRendererRuntimeSmokeEvidence {
  activeEmotionId: string;
  canvasLayerVisible: boolean;
  canvasNonTransparentPixel: boolean;
  drawCalls: number;
  expressionAppliedAfterFrame: boolean;
  expressionCount: number;
  expressionEmotionIdsObserved: string[];
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelLoaded: boolean;
  rendererAssetProbe: string;
  runtimeLifecycle: {
    drawCalls: number;
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
  if (new Set(evidence.expressionEmotionIdsObserved.filter((emotionId) => emotionId !== "calm_idle")).size < 2) {
    failures.push(`${label}.expressionEmotionIdsObserved`);
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
    typeof runtimeModule.expressionCount !== "number" ||
    !isStringArray(runtimeModule.expressionEmotionIdsObserved) ||
    typeof runtimeModule.expressionSwitches !== "number" ||
    typeof runtimeModule.frameLoopAdvanced !== "boolean" ||
    typeof runtimeModule.modelLoaded !== "boolean" ||
    typeof runtimeModule.runtimeModuleProbe !== "string" ||
    typeof runtimeModule.updateCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.drawCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.modelUpdateCalls !== "number" ||
    typeof runtimeModule.runtimeLifecycle.updateMotionCalls !== "number"
  ) {
    return undefined;
  }
  return {
    activeEmotionId: runtimeModule.activeEmotionId,
    canvasLayerVisible: officialRuntime.canvasLayerVisible,
    canvasNonTransparentPixel: officialRuntime.canvasNonTransparentPixel,
    drawCalls: runtimeModule.drawCalls,
    expressionAppliedAfterFrame: runtimeModule.expressionAppliedAfterFrame,
    expressionCount: runtimeModule.expressionCount,
    expressionEmotionIdsObserved: runtimeModule.expressionEmotionIdsObserved,
    expressionSwitches: runtimeModule.expressionSwitches,
    frameLoopAdvanced: runtimeModule.frameLoopAdvanced,
    modelLoaded: runtimeModule.modelLoaded,
    rendererAssetProbe: officialRuntime.rendererAssetProbe,
    runtimeLifecycle: {
      drawCalls: runtimeModule.runtimeLifecycle.drawCalls,
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
