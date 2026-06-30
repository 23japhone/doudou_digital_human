import type { PetManifest } from "../pet_bundle/manifest.js";

export interface AnimationPlayer {
  advance(deltaMs: number): void;
  currentAnimationName(): string;
  currentFrame(): { index: number; durationMs: number };
  tap(): void;
}

export function createAnimationPlayer(manifest: PetManifest): AnimationPlayer {
  let animationName = manifest.behavior.initial;
  let frameIndex = 0;
  let elapsedInFrameMs = 0;

  function setAnimation(nextName: string): void {
    animationName = nextName;
    frameIndex = 0;
    elapsedInFrameMs = 0;
  }

  function currentAnimation() {
    return manifest.animations[animationName] ?? manifest.animations.idle;
  }

  function advance(deltaMs: number): void {
    let remainingMs = deltaMs;
    while (remainingMs > 0) {
      const animation = currentAnimation();
      const frame = animation.frames[frameIndex] ?? animation.frames[0];
      const frameRemainingMs = frame.durationMs - elapsedInFrameMs;
      if (remainingMs < frameRemainingMs) {
        elapsedInFrameMs += remainingMs;
        return;
      }

      remainingMs -= frameRemainingMs;
      elapsedInFrameMs = 0;
      frameIndex += 1;

      if (frameIndex >= animation.frames.length) {
        if (animation.loop) {
          frameIndex = 0;
        } else {
          setAnimation(animation.next ?? manifest.behavior.initial);
        }
      }
    }
  }

  return {
    advance,
    currentAnimationName: () => animationName,
    currentFrame: () => {
      const animation = currentAnimation();
      return animation.frames[frameIndex] ?? animation.frames[0];
    },
    tap: () => {
      setAnimation(manifest.behavior.onTap);
    }
  };
}
