import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";
import {
  doudouLive2DExpressionForEmotion,
  type DoudouModelEmotionSuggestion
} from "../../src/runtime/default-doudou-live2d.js";
import {
  DEFAULT_DOUDOU_EXP3_FIXTURE_DIR,
  toDoudouLive2DExp3Json
} from "../../src/runtime/default-doudou-exp3.js";
import {
  applyDoudouLive2DArbitratedPreviewSwitch,
  createDoudouLive2DPreviewState,
  loadDefaultDoudouLive2DPreviewLibrary,
  switchDoudouLive2DPreviewExpression
} from "../../src/runtime/default-doudou-live2d-preview.js";
import { runDoudouLive2DPreviewCli } from "../../src/cli/doudou-live2d-preview.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("default doudou Live2D preview adapter spike", () => {
  test("loads the committed exp3 fixtures as Cubism expression load requests", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);

    expect(library.expressionCount).toBe(DEFAULT_DOUDOU_EMOTION_IDS.length);
    expect(library.loadRequests.map((request) => request.emotionId)).toEqual(DEFAULT_DOUDOU_EMOTION_IDS);
    expect(library.loadRequests.map((request) => request.expressionFile)).toEqual(
      DEFAULT_DOUDOU_EMOTION_IDS.map((emotionId) => `expressions/doudou_${emotionId}.exp3.json`)
    );
    expect(library.loadRequests.every((request) => request.expressionJson.Type === "Live2D Expression")).toBe(true);
    expect(library.byEmotion.delighted.expressionJson).toEqual(
      toDoudouLive2DExp3Json(doudouLive2DExpressionForEmotion("delighted"))
    );
  });

  test("switches preview expressions with the payload a Cubism SDK adapter will need", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const previewState = createDoudouLive2DPreviewState(library, "calm_idle");

    const switchResult = switchDoudouLive2DPreviewExpression(library, previewState, "delighted", 1280);

    expect(switchResult.state.currentEmotionId).toBe("delighted");
    expect(switchResult.transition).toEqual({
      fromEmotionId: "calm_idle",
      toEmotionId: "delighted",
      expressionFile: "expressions/doudou_delighted.exp3.json",
      expressionName: "兜兜开心发光",
      motionCue: "small_pop",
      startedAtMs: 1280,
      fadeInTime: 0.28,
      fadeOutTime: 0.4,
      parameterCount: 11,
      cubismExpression: toDoudouLive2DExp3Json(doudouLive2DExpressionForEmotion("delighted"))
    });
    expect(JSON.stringify(switchResult)).not.toContain("rawPrompt");
    expect(JSON.stringify(switchResult)).not.toContain("sourceImagePath");
  });

  test("applies model arbitration before switching a preview expression", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const previewState = createDoudouLive2DPreviewState(library, "calm_idle");
    const suggestion: DoudouModelEmotionSuggestion = {
      source: "llm",
      intent: "soft_comfort",
      suggestedEmotionId: "comfort_soft",
      confidence: 0.92,
      reasonCode: "user_low_mood_text",
      ttlMs: 8000
    };

    const accepted = applyDoudouLive2DArbitratedPreviewSwitch(library, previewState, suggestion, {
      currentEmotionId: "calm_idle",
      runtimeStateLocked: false,
      safetyState: "clear",
      userVisionConsent: false
    }, 2400);
    expect(accepted.decision).toEqual({ accepted: true, emotionId: "comfort_soft", reason: "accepted" });
    expect(accepted.transition?.expressionFile).toBe("expressions/doudou_comfort_soft.exp3.json");
    expect(accepted.state.currentEmotionId).toBe("comfort_soft");

    const blocked = applyDoudouLive2DArbitratedPreviewSwitch(library, previewState, suggestion, {
      currentEmotionId: "calm_idle",
      runtimeStateLocked: false,
      safetyState: "blocked",
      userVisionConsent: false
    }, 2600);
    expect(blocked.decision).toEqual({ accepted: false, emotionId: "calm_idle", reason: "safety_blocked" });
    expect(blocked.transition).toBeNull();
    expect(blocked.state.currentEmotionId).toBe("calm_idle");
  });
});

describe("default doudou Live2D preview CLI", () => {
  test("prints a stable sanitized preview switch report", async () => {
    const consoleCapture = captureConsole();

    const exitCode = await runDoudouLive2DPreviewCli([
      "node",
      "doudou-live2d-preview",
      DEFAULT_DOUDOU_EXP3_FIXTURE_DIR,
      "calm_idle",
      "delighted"
    ]);
    const result = JSON.parse(consoleCapture.stdout.join("\n")) as {
      ok: boolean;
      expressionCount: number;
      loadedExpressionFiles: string[];
      switch: { fromEmotionId: string; toEmotionId: string; expressionFile: string; parameterCount: number };
      arbitrationProbe: { accepted: boolean; reason: string; expressionFile: string };
    };

    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.expressionCount).toBe(DEFAULT_DOUDOU_EMOTION_IDS.length);
    expect(result.loadedExpressionFiles).toEqual(
      DEFAULT_DOUDOU_EMOTION_IDS.map((emotionId) => `expressions/doudou_${emotionId}.exp3.json`)
    );
    expect(result.switch).toMatchObject({
      fromEmotionId: "calm_idle",
      toEmotionId: "delighted",
      expressionFile: "expressions/doudou_delighted.exp3.json",
      parameterCount: 11
    });
    expect(result.arbitrationProbe).toMatchObject({
      accepted: true,
      reason: "accepted",
      expressionFile: "expressions/doudou_delighted.exp3.json"
    });
    expect(consoleCapture.stderr).toEqual([]);
    expect(consoleCapture.stdout.join("\n")).not.toContain(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
  });
});

function captureConsole(): { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
    stdout.push(String(message));
  });
  vi.spyOn(console, "error").mockImplementation((message?: unknown) => {
    stderr.push(String(message));
  });
  return { stdout, stderr };
}
