import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveRuntimeMotionTuning, type RuntimeMotionTuning, type RuntimeMotionTuningPreset } from "./tuning.js";

const RUNTIME_MOTION_TUNING_PRESET_SCHEMA_VERSION = "runtime-motion-tuning-presets.v1";
const RUNTIME_MOTION_TUNING_PRESET_NAME_MAX_LENGTH = 32;
const RUNTIME_MOTION_TUNING_PRESET_LIMIT = 12;

interface RuntimeMotionTuningPresetInput {
  name: string;
  tuning: Partial<RuntimeMotionTuning>;
}

interface RuntimeMotionTuningPresetStore {
  presets: RuntimeMotionTuningPreset[];
  schemaVersion: typeof RUNTIME_MOTION_TUNING_PRESET_SCHEMA_VERSION;
}

export function normalizeRuntimeMotionTuningPresetName(name: unknown): string {
  if (typeof name !== "string") {
    return "";
  }
  return name.trim().replace(/\s+/g, " ").slice(0, RUNTIME_MOTION_TUNING_PRESET_NAME_MAX_LENGTH);
}

export function upsertRuntimeMotionTuningPreset(
  presets: readonly RuntimeMotionTuningPreset[],
  input: RuntimeMotionTuningPresetInput,
  now = new Date()
): RuntimeMotionTuningPreset[] {
  const name = normalizeRuntimeMotionTuningPresetName(input.name);
  if (!name) {
    return normalizeRuntimeMotionTuningPresets(presets);
  }
  const updated: RuntimeMotionTuningPreset = {
    name,
    tuning: resolveRuntimeMotionTuning(input.tuning),
    updatedAt: now.toISOString()
  };
  return [
    updated,
    ...normalizeRuntimeMotionTuningPresets(presets).filter((preset) => preset.name !== name)
  ].slice(0, RUNTIME_MOTION_TUNING_PRESET_LIMIT);
}

export async function loadRuntimeMotionTuningPresets(filePath: string): Promise<RuntimeMotionTuningPreset[]> {
  try {
    const store = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return normalizeRuntimeMotionTuningPresetStore(store);
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    return [];
  }
}

export async function saveRuntimeMotionTuningPresets(
  filePath: string,
  presets: readonly RuntimeMotionTuningPreset[]
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const store: RuntimeMotionTuningPresetStore = {
    schemaVersion: RUNTIME_MOTION_TUNING_PRESET_SCHEMA_VERSION,
    presets: normalizeRuntimeMotionTuningPresets(presets)
  };
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function normalizeRuntimeMotionTuningPresetStore(store: unknown): RuntimeMotionTuningPreset[] {
  if (!store || typeof store !== "object") {
    return [];
  }
  const candidate = store as Partial<RuntimeMotionTuningPresetStore>;
  if (
    candidate.schemaVersion !== RUNTIME_MOTION_TUNING_PRESET_SCHEMA_VERSION ||
    !Array.isArray(candidate.presets)
  ) {
    return [];
  }
  return normalizeRuntimeMotionTuningPresets(candidate.presets);
}

function normalizeRuntimeMotionTuningPresets(presets: readonly RuntimeMotionTuningPreset[]): RuntimeMotionTuningPreset[] {
  const normalized: RuntimeMotionTuningPreset[] = [];
  const seen = new Set<string>();
  for (const preset of presets) {
    const name = normalizeRuntimeMotionTuningPresetName(preset?.name);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    normalized.push({
      name,
      tuning: resolveRuntimeMotionTuning(preset?.tuning),
      updatedAt: typeof preset?.updatedAt === "string" && preset.updatedAt ? preset.updatedAt : new Date(0).toISOString()
    });
    if (normalized.length >= RUNTIME_MOTION_TUNING_PRESET_LIMIT) {
      break;
    }
  }
  return normalized;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
