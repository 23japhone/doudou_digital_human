import { describe, expect, test } from "vitest";
import {
  classifyRuntimeAlphaReaction,
  type RuntimeAlphaReactionInput
} from "../../src/runtime/reaction.js";

describe("runtime alpha reaction strategy", () => {
  test("approaches when the alpha hit is visible but away from the pet core", () => {
    expect(classifyRuntimeAlphaReaction(inputAt(48, 128))).toBe("approach");
  });

  test("dodges when the alpha hit lands near the pet core", () => {
    expect(classifyRuntimeAlphaReaction(inputAt(128, 116))).toBe("dodge");
  });

  test("does not react when the renderer reports transparent alpha", () => {
    expect(classifyRuntimeAlphaReaction({ hitTest: { visible: false } })).toBe("none");
  });
});

function inputAt(x: number, y: number): RuntimeAlphaReactionInput {
  return {
    hitTest: {
      canvasPoint: { x, y },
      canvasSize: { width: 256, height: 256 },
      visible: true
    }
  };
}
