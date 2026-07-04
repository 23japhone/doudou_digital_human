export interface RuntimeEmotionModelPanelSmokeEvidence {
  buttonSubmitted: boolean;
  commandApplied: boolean | null;
  consented: boolean;
  panelVisible: boolean;
  providerCalled: boolean | null;
  statusSanitized: boolean;
  statusText: string;
}

export interface RuntimeEmotionModelTraySmokeEvidence {
  commandApplied: boolean | null;
  consented: boolean;
  menuCreated: boolean;
  menuItemVisible: boolean;
  providerCalled: boolean | null;
  requestDispatched: boolean;
  statusSanitized: boolean;
  statusText: string;
}

export interface RuntimeLive2DRendererSpikeMinimalEvidence {
  enabled: boolean;
  expressionCount: number;
  frameLoopAdvanced: boolean;
  modelLoaded: boolean;
}

export interface RuntimeLiveEmotionPanelSmokeEvidence {
  atlasLoaded: boolean;
  bundleLoaded: boolean;
  emotionModelPanel?: RuntimeEmotionModelPanelSmokeEvidence;
  live2DRendererSpike: RuntimeLive2DRendererSpikeMinimalEvidence | null;
  nonTransparentPixel: boolean;
  renderLoopAdvanced: boolean;
}

export interface RuntimeLiveEmotionTraySmokeEvidence {
  atlasLoaded: boolean;
  bundleLoaded: boolean;
  emotionModelTray?: RuntimeEmotionModelTraySmokeEvidence;
  live2DRendererSpike: RuntimeLive2DRendererSpikeMinimalEvidence | null;
  nonTransparentPixel: boolean;
  renderLoopAdvanced: boolean;
}

export function hasRuntimeEmotionModelPanelSmokeEvidence(
  panel: RuntimeEmotionModelPanelSmokeEvidence | undefined,
  options: {
    expectConsented: boolean;
  }
): boolean {
  if (!panel || !panel.panelVisible || !panel.buttonSubmitted || !panel.statusSanitized) {
    return false;
  }
  if (options.expectConsented) {
    return (
      panel.consented &&
      panel.providerCalled === true &&
      panel.commandApplied === true &&
      panel.statusText.includes("兜兜回应了") &&
      panel.statusText.includes("表情反馈")
    );
  }
  return (
    !panel.consented &&
    panel.providerCalled === false &&
    panel.commandApplied === null &&
    panel.statusText.includes("需要本次授权")
  );
}

export function hasRuntimeEmotionModelTraySmokeEvidence(
  tray: RuntimeEmotionModelTraySmokeEvidence | undefined,
  options: {
    expectConsented: boolean;
  }
): boolean {
  if (!tray || !tray.menuCreated || !tray.menuItemVisible || !tray.statusSanitized) {
    return false;
  }
  if (options.expectConsented) {
    return (
      tray.consented &&
      tray.requestDispatched &&
      tray.providerCalled === true &&
      tray.commandApplied === true &&
      tray.statusText.includes("兜兜回应了") &&
      tray.statusText.includes("表情反馈")
    );
  }
  return !tray.consented && !tray.requestDispatched;
}

export function hasRuntimeLiveEmotionPanelSmokeEvidence(
  result: RuntimeLiveEmotionPanelSmokeEvidence
): boolean {
  return Boolean(
    result.bundleLoaded &&
    result.atlasLoaded &&
    result.nonTransparentPixel &&
    result.renderLoopAdvanced &&
    result.live2DRendererSpike?.enabled &&
    result.live2DRendererSpike.modelLoaded &&
    result.live2DRendererSpike.frameLoopAdvanced &&
    result.live2DRendererSpike.expressionCount === 12 &&
    hasRuntimeEmotionModelPanelSmokeEvidence(result.emotionModelPanel, { expectConsented: true })
  );
}

export function hasRuntimeLiveEmotionTraySmokeEvidence(
  result: RuntimeLiveEmotionTraySmokeEvidence
): boolean {
  return Boolean(
    result.bundleLoaded &&
    result.atlasLoaded &&
    result.nonTransparentPixel &&
    result.renderLoopAdvanced &&
    result.live2DRendererSpike?.enabled &&
    result.live2DRendererSpike.modelLoaded &&
    result.live2DRendererSpike.frameLoopAdvanced &&
    result.live2DRendererSpike.expressionCount === 12 &&
    hasRuntimeEmotionModelTraySmokeEvidence(result.emotionModelTray, { expectConsented: true })
  );
}
