import {
  type DoudouCubismExpressionBackend,
  type DoudouCubismExpressionHandle,
  type DoudouCubismExpressionPlayback,
  type DoudouCubismExpressionPlaybackOptions,
  type DoudouCubismMotionPriority
} from "./default-doudou-live2d-cubism-adapter.js";
import {
  type DoudouLive2DPreviewLoadRequest,
  type DoudouLive2DPreviewTransition
} from "./default-doudou-live2d-preview.js";

export type DoudouWebCubismExpressionMotion = object;

export interface DoudouWebCubismExpressionRuntime {
  CubismExpressionMotion: {
    create: (buffer: ArrayBuffer, size: number) => DoudouWebCubismExpressionMotion;
  };
  motionManager: {
    startMotionPriority: (
      motion: DoudouWebCubismExpressionMotion,
      autoDelete: boolean,
      priority: number
    ) => unknown;
  };
}

export function createDoudouWebCubismExpressionBackend(
  runtime: DoudouWebCubismExpressionRuntime
): DoudouCubismExpressionBackend {
  const motionsByHandleId = new Map<string, DoudouWebCubismExpressionMotion>();

  return {
    createExpressionMotion(request) {
      const expressionBuffer = encodeExpressionJson(request);
      const motion = runtime.CubismExpressionMotion.create(expressionBuffer, expressionBuffer.byteLength);

      const handle: DoudouCubismExpressionHandle = {
        backendExpressionId: `web-expression:${request.emotionId}`,
        emotionId: request.emotionId,
        expressionFile: request.expressionFile,
        sdkClassName: "CubismExpressionMotion"
      };
      motionsByHandleId.set(handle.backendExpressionId, motion);
      return handle;
    },

    startExpressionMotion(handle, transition, options) {
      const motion = motionsByHandleId.get(handle.backendExpressionId);
      if (!motion) {
        throw new Error(`Web Cubism expression motion is not loaded: ${handle.expressionFile}`);
      }

      const priorityValue = cubismPriorityValue(options.priority);
      runtime.motionManager.startMotionPriority(motion, true, priorityValue);
      return toPlayback(handle, transition, options, priorityValue);
    }
  };
}

function encodeExpressionJson(request: DoudouLive2DPreviewLoadRequest): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(request.expressionJson));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function toPlayback(
  handle: DoudouCubismExpressionHandle,
  transition: DoudouLive2DPreviewTransition,
  options: DoudouCubismExpressionPlaybackOptions,
  priorityValue: number
): DoudouCubismExpressionPlayback {
  return {
    playbackId: `web-playback:${transition.toEmotionId}:${transition.startedAtMs}`,
    backendExpressionId: handle.backendExpressionId,
    expressionFile: transition.expressionFile,
    emotionId: transition.toEmotionId,
    sdkCall: "CubismMotionManager.startMotionPriority",
    priority: options.priority,
    priorityValue,
    autoDelete: true,
    fadeInTime: transition.fadeInTime,
    fadeOutTime: transition.fadeOutTime,
    startedAtMs: transition.startedAtMs
  };
}

function cubismPriorityValue(priority: DoudouCubismMotionPriority): number {
  return priority === "force" ? 3 : 2;
}
