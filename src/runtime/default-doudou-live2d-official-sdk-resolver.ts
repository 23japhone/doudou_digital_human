import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type DoudouOfficialLive2DRendererRuntimeUnavailableReason =
  | "not_configured"
  | "sdk_core_missing"
  | "sdk_framework_missing"
  | "sdk_sample_runtime_missing"
  | "model3_missing"
  | "model3_invalid"
  | "model_asset_missing"
  | "runtime_module_missing"
  | "unsafe_model_reference";

type DoudouOfficialLive2DCoreScript = "Core/live2dcubismcore.js" | "Core/live2dcubismcore.min.js";

export interface DoudouOfficialLive2DRendererRuntimeEvidence {
  available: boolean;
  configured: boolean;
  reason?: DoudouOfficialLive2DRendererRuntimeUnavailableReason;
  sdk?: {
    coreScript: DoudouOfficialLive2DCoreScript;
    frameworkSource: "Framework/src";
    sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts";
  };
  model?: {
    model3Json: "default-doudou.model3.json";
    moc: string;
    textureCount: number;
    expressionCount: number;
    motionGroupCount: number;
  };
  runtimeModule?: {
    configured: boolean;
    moduleFormat?: "external_es_module";
  };
}

export interface DoudouOfficialLive2DRendererRuntimeAssets {
  coreScriptUrl: string;
  model3JsonUrl: string;
  modelRootUrl: string;
  runtimeModuleUrl?: string;
}

export type DoudouOfficialLive2DRendererRuntimeResolution =
  | {
    available: true;
    configured: true;
    publicEvidence: DoudouOfficialLive2DRendererRuntimeEvidence;
    rendererAssets: DoudouOfficialLive2DRendererRuntimeAssets;
  }
  | {
    available: false;
    configured: boolean;
    reason: DoudouOfficialLive2DRendererRuntimeUnavailableReason;
    publicEvidence: DoudouOfficialLive2DRendererRuntimeEvidence;
    rendererAssets?: undefined;
  };

interface ResolveDoudouOfficialLive2DRendererRuntimeInput {
  sdkDir?: string;
  modelDir?: string;
  runtimeModuleFile?: string;
}

interface DoudouModel3Json {
  Version: number;
  FileReferences: {
    Moc: string;
    Textures: string[];
    Expressions?: Array<{
      File?: unknown;
      Name?: unknown;
    }>;
    Motions?: Record<string, Array<{
      File?: unknown;
    }>>;
    Physics?: unknown;
    Pose?: unknown;
    DisplayInfo?: unknown;
  };
}

const MODEL3_JSON = "default-doudou.model3.json";
const CORE_SCRIPT = "Core/live2dcubismcore.js";
const CORE_SCRIPT_MIN = "Core/live2dcubismcore.min.js";
const FRAMEWORK_SOURCE = "Framework/src";
const SAMPLE_LAPP_MODEL = "Samples/TypeScript/Demo/src/lappmodel.ts";
const SAMPLE_SOURCE = "Samples/TypeScript/Demo/src";
const REQUIRED_SAMPLE_SOURCE_FILES = [
  "lappdefine.ts",
  "lappdelegate.ts",
  "lappglmanager.ts",
  "lapplive2dmanager.ts",
  "lappmodel.ts",
  "lapppal.ts",
  "lappsprite.ts",
  "lappsubdelegate.ts",
  "lapptexturemanager.ts",
  "lappview.ts",
  "lappwavfilehandler.ts",
  "touchmanager.ts"
] as const;
const REQUIRED_SAMPLE_FRAMEWORK_FILES = [
  "cubismdefaultparameterid.ts",
  "cubismmodelsettingjson.ts",
  "effect/cubismbreath.ts",
  "effect/cubismeyeblink.ts",
  "effect/cubismlook.ts",
  "icubismmodelsetting.ts",
  "id/cubismid.ts",
  "live2dcubismframework.ts",
  "math/cubismmatrix44.ts",
  "math/cubismviewmatrix.ts",
  "model/cubismmoc.ts",
  "model/cubismusermodel.ts",
  "motion/acubismmotion.ts",
  "motion/cubismbreathupdater.ts",
  "motion/cubismeyeblinkupdater.ts",
  "motion/cubismexpressionupdater.ts",
  "motion/cubismlipsyncupdater.ts",
  "motion/cubismlookupdater.ts",
  "motion/cubismmotion.ts",
  "motion/cubismmotionqueuemanager.ts",
  "motion/cubismphysicsupdater.ts",
  "motion/cubismposeupdater.ts",
  "motion/cubismupdatescheduler.ts",
  "rendering/cubismoffscreenmanager.ts",
  "type/csmrectf.ts",
  "utils/cubismdebug.ts"
] as const;

export async function resolveDoudouOfficialLive2DRendererRuntime(
  input: ResolveDoudouOfficialLive2DRendererRuntimeInput
): Promise<DoudouOfficialLive2DRendererRuntimeResolution> {
  const sdkDir = sanitizeConfiguredPath(input.sdkDir);
  const modelDir = sanitizeConfiguredPath(input.modelDir);
  const runtimeModuleFile = sanitizeConfiguredPath(input.runtimeModuleFile);
  const configured = Boolean(sdkDir || modelDir);
  if (!sdkDir || !modelDir) {
    return unavailable("not_configured", configured);
  }

  const coreScript = await resolveCoreScript(sdkDir);
  if (!coreScript) {
    return unavailable("sdk_core_missing", true);
  }
  if (!await isDirectory(path.join(sdkDir, FRAMEWORK_SOURCE))) {
    return unavailable("sdk_framework_missing", true);
  }
  if (!await hasRequiredFrameworkSourceFiles(path.join(sdkDir, FRAMEWORK_SOURCE))) {
    return unavailable("sdk_framework_missing", true);
  }
  if (!await hasRequiredSampleSourceFiles(path.join(sdkDir, SAMPLE_SOURCE))) {
    return unavailable("sdk_sample_runtime_missing", true);
  }

  const model3Path = path.join(modelDir, MODEL3_JSON);
  if (!await exists(model3Path)) {
    return unavailable("model3_missing", true);
  }
  const model = await readModel3Json(model3Path);
  if (!model) {
    return unavailable("model3_invalid", true);
  }

  const references = collectModelReferences(model);
  if (!references) {
    return unavailable("model3_invalid", true);
  }
  if (references.some((reference) => !isSafeRelativeModelReference(reference))) {
    return unavailable("unsafe_model_reference", true);
  }
  if (!await allModelAssetsExist(modelDir, references)) {
    return unavailable("model_asset_missing", true);
  }
  if (runtimeModuleFile && !await exists(runtimeModuleFile)) {
    return unavailable("runtime_module_missing", true);
  }

  const publicEvidence: DoudouOfficialLive2DRendererRuntimeEvidence = {
    available: true,
    configured: true,
    model: {
      expressionCount: model.FileReferences.Expressions?.length ?? 0,
      moc: model.FileReferences.Moc,
      model3Json: MODEL3_JSON,
      motionGroupCount: Object.keys(model.FileReferences.Motions ?? {}).length,
      textureCount: model.FileReferences.Textures.length
    },
    sdk: {
      coreScript,
      frameworkSource: FRAMEWORK_SOURCE,
      sampleLAppModel: SAMPLE_LAPP_MODEL
    },
    runtimeModule: runtimeModuleFile
      ? {
        configured: true,
        moduleFormat: "external_es_module"
      }
      : {
        configured: false
    }
  };

  return {
    available: true,
    configured: true,
    publicEvidence,
    rendererAssets: {
      coreScriptUrl: pathToFileURL(path.join(sdkDir, coreScript)).href,
      model3JsonUrl: pathToFileURL(model3Path).href,
      modelRootUrl: directoryFileUrl(modelDir),
      runtimeModuleUrl: runtimeModuleFile ? pathToFileURL(runtimeModuleFile).href : undefined
    }
  };
}

async function hasRequiredFrameworkSourceFiles(frameworkSourceDir: string): Promise<boolean> {
  for (const relativeFile of REQUIRED_SAMPLE_FRAMEWORK_FILES) {
    if (!await exists(path.join(frameworkSourceDir, relativeFile))) {
      return false;
    }
  }
  return true;
}

async function hasRequiredSampleSourceFiles(sampleSourceDir: string): Promise<boolean> {
  for (const relativeFile of REQUIRED_SAMPLE_SOURCE_FILES) {
    if (!await exists(path.join(sampleSourceDir, relativeFile))) {
      return false;
    }
  }
  return true;
}

function unavailable(
  reason: DoudouOfficialLive2DRendererRuntimeUnavailableReason,
  configured: boolean
): DoudouOfficialLive2DRendererRuntimeResolution {
  return {
    available: false,
    configured,
    publicEvidence: {
      available: false,
      configured,
      reason
    },
    reason
  };
}

function sanitizeConfiguredPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? path.resolve(trimmed) : null;
}

function directoryFileUrl(directoryPath: string): string {
  const href = pathToFileURL(directoryPath).href;
  return href.endsWith("/") ? href : `${href}/`;
}

async function resolveCoreScript(sdkDir: string): Promise<DoudouOfficialLive2DCoreScript | null> {
  if (await exists(path.join(sdkDir, CORE_SCRIPT))) {
    return CORE_SCRIPT;
  }
  if (await exists(path.join(sdkDir, CORE_SCRIPT_MIN))) {
    return CORE_SCRIPT_MIN;
  }
  return null;
}

async function readModel3Json(model3Path: string): Promise<DoudouModel3Json | null> {
  try {
    const parsed = JSON.parse(await readFile(model3Path, "utf8")) as unknown;
    return isDoudouModel3Json(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDoudouModel3Json(value: unknown): value is DoudouModel3Json {
  if (!isRecord(value) || value.Version !== 3 || !isRecord(value.FileReferences)) {
    return false;
  }
  const fileReferences = value.FileReferences;
  return (
    typeof fileReferences.Moc === "string" &&
    Array.isArray(fileReferences.Textures) &&
    fileReferences.Textures.every((texture) => typeof texture === "string") &&
    isOptionalModelExpressionArray(fileReferences.Expressions) &&
    isOptionalModelMotionRecord(fileReferences.Motions) &&
    isOptionalString(fileReferences.Physics) &&
    isOptionalString(fileReferences.Pose) &&
    isOptionalString(fileReferences.DisplayInfo)
  );
}

function isOptionalModelExpressionArray(value: unknown): value is DoudouModel3Json["FileReferences"]["Expressions"] {
  return value === undefined || (
    Array.isArray(value) &&
    value.every((expression) => isRecord(expression) && isOptionalString(expression.File))
  );
}

function isOptionalModelMotionRecord(value: unknown): value is DoudouModel3Json["FileReferences"]["Motions"] {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((motions) =>
    Array.isArray(motions) &&
    motions.every((motion) => isRecord(motion) && isOptionalString(motion.File))
  );
}

function collectModelReferences(model: DoudouModel3Json): string[] | null {
  const references = [model.FileReferences.Moc, ...model.FileReferences.Textures];
  for (const expression of model.FileReferences.Expressions ?? []) {
    if (typeof expression.File !== "string") {
      return null;
    }
    references.push(expression.File);
  }
  for (const motions of Object.values(model.FileReferences.Motions ?? {})) {
    for (const motion of motions) {
      if (typeof motion.File !== "string") {
        return null;
      }
      references.push(motion.File);
    }
  }
  for (const optionalReference of [
    model.FileReferences.Physics,
    model.FileReferences.Pose,
    model.FileReferences.DisplayInfo
  ]) {
    if (typeof optionalReference === "string") {
      references.push(optionalReference);
    }
  }
  return references;
}

function isSafeRelativeModelReference(reference: string): boolean {
  if (!reference || reference.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(reference)) {
    return false;
  }
  if (path.posix.isAbsolute(reference)) {
    return false;
  }
  const parts = reference.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

async function allModelAssetsExist(modelDir: string, references: string[]): Promise<boolean> {
  for (const reference of references) {
    if (!await isFile(path.join(modelDir, reference))) {
      return false;
    }
  }
  return true;
}

async function exists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(candidatePath: string): Promise<boolean> {
  try {
    return (await stat(candidatePath)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(candidatePath: string): Promise<boolean> {
  try {
    return (await stat(candidatePath)).isFile();
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
