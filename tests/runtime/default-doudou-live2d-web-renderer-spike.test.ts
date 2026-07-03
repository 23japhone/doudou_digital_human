import { describe, expect, test } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";
import { DEFAULT_DOUDOU_EXP3_FIXTURE_DIR } from "../../src/runtime/default-doudou-exp3.js";
import {
  createDoudouWebCubismRendererSpike,
  type DoudouWebCubismRendererSpikeRuntime
} from "../../src/runtime/default-doudou-live2d-web-renderer-spike.js";
import { loadDefaultDoudouLive2DPreviewLibrary } from "../../src/runtime/default-doudou-live2d-preview.js";

describe("default doudou Web Cubism renderer spike", () => {
  test("loads default expressions and drives the official Web SDK render lifecycle", async () => {
    const runtime = createInstrumentedWebCubismRendererRuntime();
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const spike = createDoudouWebCubismRendererSpike({
      modelId: "default-doudou",
      model3Json: "default-doudou.model3.json",
      runtime
    });

    const loadResult = spike.loadDefaultModel(library);
    const playback = spike.switchExpression(library, "calm_idle", "delighted", 1200, "force");
    const firstFrame = spike.renderFrame(1000);
    const secondFrame = spike.renderFrame(1033);

    expect(loadResult).toMatchObject({
      ok: true,
      expressionCount: 12,
      model: {
        modelId: "default-doudou",
        model3Json: "default-doudou.model3.json"
      }
    });
    expect(playback).toMatchObject({
      ok: true,
      playback: {
        emotionId: "delighted",
        expressionFile: "expressions/doudou_delighted.exp3.json",
        priority: "force",
        priorityValue: 3
      }
    });
    expect(firstFrame.deltaTimeSeconds).toBe(0);
    expect(secondFrame.deltaTimeSeconds).toBeCloseTo(0.033, 3);
    expect(secondFrame.evidence).toMatchObject({
      activeEmotionId: "delighted",
      expressionOverlayApplied: true,
      frameLoopAdvanced: true,
      modelLoaded: true,
      updateMotionCalls: 2,
      modelUpdateCalls: 2,
      drawModelCalls: 2,
      expressionSwitches: 1
    });
    expect(runtime.calls).toEqual([
      "CubismExpressionMotion.create:Live2D Expression:8",
      "CubismExpressionMotion.create:Live2D Expression:9",
      "CubismExpressionMotion.create:Live2D Expression:11",
      "CubismExpressionMotion.create:Live2D Expression:9",
      "CubismExpressionMotion.create:Live2D Expression:9",
      "CubismExpressionMotion.create:Live2D Expression:11",
      "CubismExpressionMotion.create:Live2D Expression:10",
      "CubismExpressionMotion.create:Live2D Expression:11",
      "CubismExpressionMotion.create:Live2D Expression:9",
      "CubismExpressionMotion.create:Live2D Expression:10",
      "CubismExpressionMotion.create:Live2D Expression:9",
      "CubismExpressionMotion.create:Live2D Expression:9",
      "CubismMotionManager.startMotionPriority:motion:delighted:true:3",
      "CubismMotionManager.updateMotion:0.000",
      "CubismModel.update",
      "CubismRenderer.drawModel",
      "CubismMotionManager.updateMotion:0.033",
      "CubismModel.update",
      "CubismRenderer.drawModel"
    ]);
    expect(JSON.stringify(secondFrame.evidence)).not.toContain("rawPrompt");
    expect(JSON.stringify(secondFrame.evidence)).not.toContain("sourceImagePath");
  });
});

function createInstrumentedWebCubismRendererRuntime(): DoudouWebCubismRendererSpikeRuntime & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    CubismExpressionMotion: {
      create(buffer, size) {
        const expression = JSON.parse(new TextDecoder().decode(buffer.slice(0, size))) as {
          Name?: unknown;
          Parameters?: unknown;
          Type?: unknown;
        };
        const parameterCount = Array.isArray(expression.Parameters) ? expression.Parameters.length : 0;
        const emotionId = DEFAULT_DOUDOU_EMOTION_IDS[parameterCount === 0 ? 0 : calls.length] ?? "unknown";
        calls.push(`CubismExpressionMotion.create:${String(expression.Type)}:${parameterCount}`);
        return { id: `motion:${emotionId}` };
      }
    },
    expressionManager: {
      startMotionPriority(motion, autoDelete, priority) {
        calls.push(`CubismMotionManager.startMotionPriority:${(motion as { id: string }).id}:${autoDelete}:${priority}`);
      },
      updateMotion(_model, deltaTimeSeconds) {
        calls.push(`CubismMotionManager.updateMotion:${deltaTimeSeconds.toFixed(3)}`);
        return true;
      }
    },
    model: {
      update() {
        calls.push("CubismModel.update");
      }
    },
    renderer: {
      drawModel() {
        calls.push("CubismRenderer.drawModel");
      }
    }
  };
}
