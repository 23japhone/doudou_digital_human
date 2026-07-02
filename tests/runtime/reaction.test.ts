import { describe, expect, test } from "vitest";
import {
  classifyRuntimeAlphaReaction,
  createRuntimeEmotionMemory,
  decayRuntimeEmotionMemory,
  recordRuntimePokeEmotion,
  runtimeDodgeDistanceForEmotion,
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

  test("raises wariness after repeated alpha pokes", () => {
    let memory = createRuntimeEmotionMemory();

    memory = recordRuntimePokeEmotion(memory, 1000);
    const singlePokeWariness = memory.wariness;
    memory = recordRuntimePokeEmotion(memory, 1300);

    expect(singlePokeWariness).toBeGreaterThan(0);
    expect(memory.wariness).toBeGreaterThan(singlePokeWariness);
    expect(memory.wariness).toBeLessThanOrEqual(1);
  });

  test("recovers wariness after the pet is left alone", () => {
    let memory = createRuntimeEmotionMemory();
    memory = recordRuntimePokeEmotion(memory, 1000);
    memory = recordRuntimePokeEmotion(memory, 1300);

    const recovered = decayRuntimeEmotionMemory(memory, 8200);

    expect(recovered.wariness).toBeLessThan(memory.wariness);
    expect(recovered.wariness).toBeLessThan(0.2);
  });

  test("recovers at the same rate whether sampled once or across ticks", () => {
    let memory = createRuntimeEmotionMemory();
    memory = recordRuntimePokeEmotion(memory, 1000);
    memory = recordRuntimePokeEmotion(memory, 1300);

    const once = decayRuntimeEmotionMemory(memory, 8200);
    let ticked = memory;
    for (const nowMs of [2200, 3400, 4600, 5800, 7000, 8200]) {
      ticked = decayRuntimeEmotionMemory(ticked, nowMs);
    }

    expect(ticked.wariness).toBeCloseTo(once.wariness, 5);
  });

  test("uses high wariness to dodge visible alpha before recovering to approach", () => {
    let memory = createRuntimeEmotionMemory();
    memory = recordRuntimePokeEmotion(memory, 1000);
    memory = recordRuntimePokeEmotion(memory, 1300);

    expect(classifyRuntimeAlphaReaction({ ...inputAt(48, 128), emotionMemory: memory })).toBe("dodge");

    const recovered = decayRuntimeEmotionMemory(memory, 8200);
    expect(classifyRuntimeAlphaReaction({ ...inputAt(48, 128), emotionMemory: recovered })).toBe("approach");
  });

  test("increases dodge distance while wariness is high", () => {
    let memory = createRuntimeEmotionMemory();
    memory = recordRuntimePokeEmotion(memory, 1000);
    memory = recordRuntimePokeEmotion(memory, 1300);

    expect(runtimeDodgeDistanceForEmotion(createRuntimeEmotionMemory(), 128)).toBe(128);
    expect(runtimeDodgeDistanceForEmotion(memory, 128)).toBeGreaterThan(128);
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
