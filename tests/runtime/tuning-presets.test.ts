import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadRuntimeMotionTuningPresets,
  normalizeRuntimeMotionTuningPresetName,
  saveRuntimeMotionTuningPresets,
  upsertRuntimeMotionTuningPreset
} from "../../src/runtime/tuning-presets.js";

describe("runtime motion tuning presets", () => {
  test("normalizes user-facing preset names", () => {
    expect(normalizeRuntimeMotionTuningPresetName("  兜兜   活泼节奏  ")).toBe("兜兜 活泼节奏");
    expect(normalizeRuntimeMotionTuningPresetName(" ".repeat(3))).toBe("");
    expect(normalizeRuntimeMotionTuningPresetName("a".repeat(40))).toBe("a".repeat(32));
  });

  test("upserts named presets with clamped tuning and newest first", () => {
    const first = upsertRuntimeMotionTuningPreset([], {
      name: "兜兜默认",
      tuning: {
        recoverySpeedPixelsPerSecond: 900,
        retreatDistancePixels: 40,
        watchingPauseMs: 80
      }
    }, new Date("2026-07-02T10:00:00.000Z"));
    const second = upsertRuntimeMotionTuningPreset(first, {
      name: "  兜兜默认  ",
      tuning: {
        recoverySpeedPixelsPerSecond: 240,
        retreatDistancePixels: 260,
        watchingPauseMs: 560
      }
    }, new Date("2026-07-02T10:01:00.000Z"));

    expect(second).toEqual([
      {
        name: "兜兜默认",
        tuning: {
          recoverySpeedPixelsPerSecond: 240,
          retreatDistancePixels: 260,
          watchingPauseMs: 560
        },
        updatedAt: "2026-07-02T10:01:00.000Z"
      }
    ]);
  });

  test("persists and reloads a local preset list", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "runtime-tuning-presets-test-"));
    try {
      const filePath = path.join(tempRoot, "presets.json");
      const presets = upsertRuntimeMotionTuningPreset([], {
        name: "角色 A",
        tuning: {
          recoverySpeedPixelsPerSecond: 280,
          retreatDistancePixels: 216,
          watchingPauseMs: 680
        }
      }, new Date("2026-07-02T10:02:00.000Z"));

      await saveRuntimeMotionTuningPresets(filePath, presets);

      expect(JSON.parse(await readFile(filePath, "utf8"))).toMatchObject({
        schemaVersion: "runtime-motion-tuning-presets.v1",
        presets
      });
      expect(await loadRuntimeMotionTuningPresets(filePath)).toEqual(presets);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});
