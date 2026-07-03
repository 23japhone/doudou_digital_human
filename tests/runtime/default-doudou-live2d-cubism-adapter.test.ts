import { describe, expect, test } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";
import { DEFAULT_DOUDOU_EXP3_FIXTURE_DIR } from "../../src/runtime/default-doudou-exp3.js";
import {
  createDoudouLive2DCubismAdapter,
  createMockDoudouCubismExpressionBackend
} from "../../src/runtime/default-doudou-live2d-cubism-adapter.js";
import {
  createDoudouLive2DPreviewState,
  loadDefaultDoudouLive2DPreviewLibrary,
  switchDoudouLive2DPreviewExpression
} from "../../src/runtime/default-doudou-live2d-preview.js";

describe("default doudou Live2D Cubism runtime adapter stub", () => {
  test("loads every Stage D request through the CubismExpressionMotion boundary", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const backend = createMockDoudouCubismExpressionBackend();
    const adapter = createDoudouLive2DCubismAdapter(backend);

    const loadResult = adapter.loadExpressions(library.loadRequests);

    expect(loadResult).toMatchObject({
      ok: true,
      expressionCount: DEFAULT_DOUDOU_EMOTION_IDS.length,
      loadedExpressionFiles: DEFAULT_DOUDOU_EMOTION_IDS.map((emotionId) => `expressions/doudou_${emotionId}.exp3.json`)
    });
    expect(loadResult.handlesByEmotion.delighted).toMatchObject({
      backendExpressionId: "mock-expression:delighted",
      emotionId: "delighted",
      expressionFile: "expressions/doudou_delighted.exp3.json",
      sdkClassName: "CubismExpressionMotion"
    });
    expect(backend.calls[0]).toEqual({
      sdkCall: "CubismExpressionMotion.create",
      backendExpressionId: "mock-expression:calm_idle",
      emotionId: "calm_idle",
      expressionFile: "expressions/doudou_calm_idle.exp3.json",
      jsonType: "Live2D Expression",
      parameterCount: 8
    });
    expect(backend.calls.filter((call) => call.sdkCall === "CubismExpressionMotion.create")).toHaveLength(
      DEFAULT_DOUDOU_EMOTION_IDS.length
    );
  });

  test("starts a loaded transition through the Cubism motion manager boundary", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const previewState = createDoudouLive2DPreviewState(library, "calm_idle");
    const switchResult = switchDoudouLive2DPreviewExpression(library, previewState, "delighted", 1280);
    const backend = createMockDoudouCubismExpressionBackend();
    const adapter = createDoudouLive2DCubismAdapter(backend);
    adapter.loadExpressions(library.loadRequests);

    const playback = adapter.applyTransition(switchResult.transition, { priority: "normal" });

    expect(playback).toEqual({
      ok: true,
      playback: {
        playbackId: "mock-playback:delighted:1280",
        backendExpressionId: "mock-expression:delighted",
        expressionFile: "expressions/doudou_delighted.exp3.json",
        emotionId: "delighted",
        sdkCall: "CubismMotionManager.startMotionPriority",
        priority: "normal",
        priorityValue: 2,
        autoDelete: true,
        fadeInTime: 0.28,
        fadeOutTime: 0.4,
        startedAtMs: 1280
      }
    });
    expect(backend.calls.at(-1)).toEqual({
      sdkCall: "CubismMotionManager.startMotionPriority",
      playbackId: "mock-playback:delighted:1280",
      backendExpressionId: "mock-expression:delighted",
      emotionId: "delighted",
      expressionFile: "expressions/doudou_delighted.exp3.json",
      priority: "normal",
      priorityValue: 2,
      autoDelete: true,
      fadeInTime: 0.28,
      fadeOutTime: 0.4,
      startedAtMs: 1280
    });
    expect(JSON.stringify(playback)).not.toContain("rawPrompt");
    expect(JSON.stringify(playback)).not.toContain("sourceImagePath");
  });

  test("keeps the backend replaceable and refuses transitions before load", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const previewState = createDoudouLive2DPreviewState(library, "calm_idle");
    const switchResult = switchDoudouLive2DPreviewExpression(library, previewState, "sleepy", 1600);
    const backend = createMockDoudouCubismExpressionBackend();
    const adapter = createDoudouLive2DCubismAdapter(backend);

    const playback = adapter.applyTransition(switchResult.transition, { priority: "force" });

    expect(playback).toEqual({
      ok: false,
      reason: "expression_not_loaded",
      expressionFile: "expressions/doudou_sleepy.exp3.json",
      emotionId: "sleepy"
    });
    expect(backend.calls).toEqual([]);
  });
});
