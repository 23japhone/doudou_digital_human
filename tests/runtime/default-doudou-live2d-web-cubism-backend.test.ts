import { describe, expect, test } from "vitest";
import { DEFAULT_DOUDOU_EXP3_FIXTURE_DIR } from "../../src/runtime/default-doudou-exp3.js";
import { createDoudouLive2DCubismAdapter } from "../../src/runtime/default-doudou-live2d-cubism-adapter.js";
import {
  createDoudouLive2DPreviewState,
  loadDefaultDoudouLive2DPreviewLibrary,
  switchDoudouLive2DPreviewExpression
} from "../../src/runtime/default-doudou-live2d-preview.js";
import { createDoudouWebCubismExpressionBackend } from "../../src/runtime/default-doudou-live2d-web-cubism-backend.js";

describe("default doudou Live2D Web Cubism backend facade", () => {
  test("creates Web SDK expression motions from Stage D load requests", async () => {
    const sdk = createFakeWebCubismSdk();
    const backend = createDoudouWebCubismExpressionBackend(sdk);
    const adapter = createDoudouLive2DCubismAdapter(backend);
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);

    const loadResult = adapter.loadExpressions([library.byEmotion.delighted]);

    expect(loadResult).toMatchObject({
      ok: true,
      expressionCount: 1,
      loadedExpressionFiles: ["expressions/doudou_delighted.exp3.json"],
      handlesByEmotion: {
        delighted: {
          backendExpressionId: "web-expression:delighted",
          emotionId: "delighted",
          expressionFile: "expressions/doudou_delighted.exp3.json",
          sdkClassName: "CubismExpressionMotion"
        }
      }
    });
    expect(sdk.calls).toEqual([
      {
        sdkCall: "CubismExpressionMotion.create",
        jsonType: "Live2D Expression",
        size: expect.any(Number),
        parameterCount: 11
      }
    ]);
    expect(sdk.decodedExpressionJson.at(-1)?.Type).toBe("Live2D Expression");
    expect(sdk.decodedExpressionJson.at(-1)).not.toHaveProperty("rawPrompt");
    expect(sdk.decodedExpressionJson.at(-1)).not.toHaveProperty("sourceImagePath");
  });

  test("starts Web SDK expression motions through startMotionPriority without changing the Stage E adapter", async () => {
    const sdk = createFakeWebCubismSdk();
    const backend = createDoudouWebCubismExpressionBackend(sdk);
    const adapter = createDoudouLive2DCubismAdapter(backend);
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const previewState = createDoudouLive2DPreviewState(library, "calm_idle");
    const switchResult = switchDoudouLive2DPreviewExpression(library, previewState, "sleepy", 4200);
    adapter.loadExpressions(library.loadRequests);

    const playback = adapter.applyTransition(switchResult.transition, { priority: "force" });

    expect(playback).toEqual({
      ok: true,
      playback: {
        playbackId: "web-playback:sleepy:4200",
        backendExpressionId: "web-expression:sleepy",
        expressionFile: "expressions/doudou_sleepy.exp3.json",
        emotionId: "sleepy",
        sdkCall: "CubismMotionManager.startMotionPriority",
        priority: "force",
        priorityValue: 3,
        autoDelete: true,
        fadeInTime: 0.28,
        fadeOutTime: 0.4,
        startedAtMs: 4200
      }
    });
    expect(sdk.calls.at(-1)).toEqual({
      sdkCall: "CubismMotionManager.startMotionPriority",
      motionId: "web-sdk-motion:10",
      autoDelete: true,
      priority: 3
    });
  });
});

function createFakeWebCubismSdk(): {
  CubismExpressionMotion: {
    create: (buffer: ArrayBuffer, size: number) => object;
  };
  motionManager: {
    startMotionPriority: (motion: object, autoDelete: boolean, priority: number) => { playbackId: string };
  };
  calls: unknown[];
  decodedExpressionJson: Array<Record<string, unknown>>;
} {
  const calls: unknown[] = [];
  const decodedExpressionJson: Array<Record<string, unknown>> = [];
  return {
    calls,
    decodedExpressionJson,
    CubismExpressionMotion: {
      create(buffer, size) {
        const expressionJson = JSON.parse(new TextDecoder().decode(buffer)) as Record<string, unknown>;
        decodedExpressionJson.push(expressionJson);
        const motionId = `web-sdk-motion:${decodedExpressionJson.length - 1}`;
        calls.push({
          sdkCall: "CubismExpressionMotion.create",
          jsonType: expressionJson.Type,
          size,
          parameterCount: Array.isArray(expressionJson.Parameters) ? expressionJson.Parameters.length : 0
        });
        return {
          id: motionId
        };
      }
    },
    motionManager: {
      startMotionPriority(motion, autoDelete, priority) {
        const motionId = (motion as { id: string }).id;
        calls.push({
          sdkCall: "CubismMotionManager.startMotionPriority",
          motionId,
          autoDelete,
          priority
        });
        return { playbackId: `entry:${motionId}:${priority}` };
      }
    }
  };
}
