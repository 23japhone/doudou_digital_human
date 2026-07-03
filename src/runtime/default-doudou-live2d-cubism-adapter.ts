import { type DefaultDoudouEmotionId } from "./default-doudou-emotions.js";
import {
  type DoudouLive2DPreviewLoadRequest,
  type DoudouLive2DPreviewTransition
} from "./default-doudou-live2d-preview.js";

export type DoudouCubismMotionPriority = "normal" | "force";

export interface DoudouCubismExpressionHandle {
  backendExpressionId: string;
  emotionId: DefaultDoudouEmotionId;
  expressionFile: string;
  sdkClassName: "CubismExpressionMotion";
}

export interface DoudouCubismExpressionPlayback {
  playbackId: string;
  backendExpressionId: string;
  expressionFile: string;
  emotionId: DefaultDoudouEmotionId;
  sdkCall: "CubismMotionManager.startMotionPriority";
  priority: DoudouCubismMotionPriority;
  priorityValue: number;
  autoDelete: boolean;
  fadeInTime: number;
  fadeOutTime: number;
  startedAtMs: number;
}

export interface DoudouCubismExpressionBackend {
  createExpressionMotion(request: DoudouLive2DPreviewLoadRequest): DoudouCubismExpressionHandle;
  startExpressionMotion(
    handle: DoudouCubismExpressionHandle,
    transition: DoudouLive2DPreviewTransition,
    options: DoudouCubismExpressionPlaybackOptions
  ): DoudouCubismExpressionPlayback;
}

export interface DoudouCubismExpressionPlaybackOptions {
  priority: DoudouCubismMotionPriority;
}

export interface DoudouCubismExpressionLoadResult {
  ok: true;
  expressionCount: number;
  loadedExpressionFiles: string[];
  handlesByEmotion: Record<DefaultDoudouEmotionId, DoudouCubismExpressionHandle>;
}

export interface DoudouCubismExpressionPlaybackResult {
  ok: true;
  playback: DoudouCubismExpressionPlayback;
}

export interface DoudouCubismExpressionPlaybackFailure {
  ok: false;
  reason: "expression_not_loaded";
  expressionFile: string;
  emotionId: DefaultDoudouEmotionId;
}

export type DoudouCubismExpressionApplyResult =
  | DoudouCubismExpressionPlaybackResult
  | DoudouCubismExpressionPlaybackFailure;

export interface DoudouLive2DCubismAdapter {
  loadExpressions(requests: readonly DoudouLive2DPreviewLoadRequest[]): DoudouCubismExpressionLoadResult;
  applyTransition(
    transition: DoudouLive2DPreviewTransition,
    options: DoudouCubismExpressionPlaybackOptions
  ): DoudouCubismExpressionApplyResult;
}

export type DoudouMockCubismExpressionBackendCall =
  | {
      sdkCall: "CubismExpressionMotion.create";
      backendExpressionId: string;
      emotionId: DefaultDoudouEmotionId;
      expressionFile: string;
      jsonType: "Live2D Expression";
      parameterCount: number;
    }
  | {
      sdkCall: "CubismMotionManager.startMotionPriority";
      playbackId: string;
      backendExpressionId: string;
      emotionId: DefaultDoudouEmotionId;
      expressionFile: string;
      priority: DoudouCubismMotionPriority;
      priorityValue: number;
      autoDelete: boolean;
      fadeInTime: number;
      fadeOutTime: number;
      startedAtMs: number;
    };

export interface DoudouMockCubismExpressionBackend extends DoudouCubismExpressionBackend {
  calls: DoudouMockCubismExpressionBackendCall[];
}

export function createDoudouLive2DCubismAdapter(
  backend: DoudouCubismExpressionBackend
): DoudouLive2DCubismAdapter {
  const handlesByEmotion = {} as Record<DefaultDoudouEmotionId, DoudouCubismExpressionHandle>;
  const handlesByExpressionFile = new Map<string, DoudouCubismExpressionHandle>();

  return {
    loadExpressions(requests) {
      const loadedExpressionFiles: string[] = [];
      for (const request of requests) {
        const handle = backend.createExpressionMotion(request);
        handlesByEmotion[request.emotionId] = handle;
        handlesByExpressionFile.set(request.expressionFile, handle);
        loadedExpressionFiles.push(request.expressionFile);
      }

      return {
        ok: true,
        expressionCount: loadedExpressionFiles.length,
        loadedExpressionFiles,
        handlesByEmotion
      };
    },

    applyTransition(transition, options) {
      const handle = handlesByExpressionFile.get(transition.expressionFile);
      if (!handle) {
        return {
          ok: false,
          reason: "expression_not_loaded",
          expressionFile: transition.expressionFile,
          emotionId: transition.toEmotionId
        };
      }

      return {
        ok: true,
        playback: backend.startExpressionMotion(handle, transition, options)
      };
    }
  };
}

export function createMockDoudouCubismExpressionBackend(): DoudouMockCubismExpressionBackend {
  const calls: DoudouMockCubismExpressionBackendCall[] = [];
  return {
    calls,

    createExpressionMotion(request) {
      const handle: DoudouCubismExpressionHandle = {
        backendExpressionId: `mock-expression:${request.emotionId}`,
        emotionId: request.emotionId,
        expressionFile: request.expressionFile,
        sdkClassName: "CubismExpressionMotion"
      };
      calls.push({
        sdkCall: "CubismExpressionMotion.create",
        backendExpressionId: handle.backendExpressionId,
        emotionId: request.emotionId,
        expressionFile: request.expressionFile,
        jsonType: request.expressionJson.Type,
        parameterCount: request.parameterCount
      });
      return handle;
    },

    startExpressionMotion(handle, transition, options) {
      const playback: DoudouCubismExpressionPlayback = {
        playbackId: `mock-playback:${transition.toEmotionId}:${transition.startedAtMs}`,
        backendExpressionId: handle.backendExpressionId,
        expressionFile: transition.expressionFile,
        emotionId: transition.toEmotionId,
        sdkCall: "CubismMotionManager.startMotionPriority",
        priority: options.priority,
        priorityValue: cubismPriorityValue(options.priority),
        autoDelete: true,
        fadeInTime: transition.fadeInTime,
        fadeOutTime: transition.fadeOutTime,
        startedAtMs: transition.startedAtMs
      };
      calls.push({
        sdkCall: "CubismMotionManager.startMotionPriority",
        playbackId: playback.playbackId,
        backendExpressionId: handle.backendExpressionId,
        emotionId: transition.toEmotionId,
        expressionFile: transition.expressionFile,
        priority: options.priority,
        priorityValue: playback.priorityValue,
        autoDelete: playback.autoDelete,
        fadeInTime: transition.fadeInTime,
        fadeOutTime: transition.fadeOutTime,
        startedAtMs: transition.startedAtMs
      });
      return playback;
    }
  };
}

function cubismPriorityValue(priority: DoudouCubismMotionPriority): number {
  return priority === "force" ? 3 : 2;
}
