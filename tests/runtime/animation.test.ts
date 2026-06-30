import { describe, expect, test } from "vitest";
import type { PetManifest } from "../../src/pet_bundle/manifest.js";
import { createAnimationPlayer } from "../../src/runtime/animation.js";

describe("createAnimationPlayer", () => {
  test("starts with the manifest initial behavior", () => {
    const player = createAnimationPlayer(manifest());

    expect(player.currentAnimationName()).toBe("idle");
    expect(player.currentFrame().index).toBe(0);
  });

  test("plays tap reaction and returns to idle", () => {
    const player = createAnimationPlayer(manifest());

    player.tap();
    expect(player.currentAnimationName()).toBe("tap_react");
    expect(player.currentFrame().index).toBe(4);

    player.advance(90);
    expect(player.currentFrame().index).toBe(5);

    player.advance(120);
    expect(player.currentAnimationName()).toBe("idle");
    expect(player.currentFrame().index).toBe(0);
  });

  test("loops idle frames", () => {
    const player = createAnimationPlayer(manifest());

    player.advance(100);
    expect(player.currentFrame().index).toBe(1);
    player.advance(100);
    expect(player.currentFrame().index).toBe(0);
  });
});

function manifest(): PetManifest {
  return {
    schemaVersion: "0.1.0",
    id: "test_pet",
    name: "Test Pet",
    assetFormat: "png_sprite_atlas_grid",
    canvas: {
      width: 256,
      height: 256,
      anchor: { x: 128, y: 232 }
    },
    assets: {
      preview: "preview.png",
      atlases: [
        {
          id: "main",
          path: "atlases/main.png",
          mime: "image/png",
          width: 1024,
          height: 512,
          frameWidth: 256,
          frameHeight: 256,
          columns: 4,
          rows: 2
        }
      ]
    },
    animations: {
      idle: {
        atlas: "main",
        loop: true,
        frames: [
          { index: 0, durationMs: 100 },
          { index: 1, durationMs: 100 }
        ]
      },
      tap_react: {
        atlas: "main",
        loop: false,
        frames: [
          { index: 4, durationMs: 90 },
          { index: 5, durationMs: 120 }
        ],
        next: "idle"
      }
    },
    behavior: {
      initial: "idle",
      onTap: "tap_react"
    },
    hitArea: {
      type: "alpha",
      alphaThreshold: 16,
      fallbackRect: { x: 48, y: 32, width: 160, height: 208 }
    },
    privacy: {
      sourceImageStored: false,
      cloudGenerated: false
    },
    provenance: {
      sourceMeta: "source.meta.json"
    }
  };
}
