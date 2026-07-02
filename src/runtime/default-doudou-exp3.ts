import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "./default-doudou-emotions.js";
import {
  DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS,
  doudouLive2DExpressionForEmotion,
  validateDoudouLive2DExpressionSpecs,
  type DoudouLive2DBlendMode,
  type DoudouLive2DExpressionSpec,
  type DoudouLive2DParameterId
} from "./default-doudou-live2d.js";

export const DEFAULT_DOUDOU_EXP3_FIXTURE_DIR = path.join("fixtures", "live2d", "default_doudou_expressions");

export interface DoudouLive2DExp3Parameter {
  Id: DoudouLive2DParameterId;
  Value: number;
  Blend: DoudouLive2DBlendMode;
}

export interface DoudouLive2DExp3Json {
  Type: "Live2D Expression";
  FadeInTime: number;
  FadeOutTime: number;
  Parameters: DoudouLive2DExp3Parameter[];
}

export interface DoudouLive2DExp3DirectoryResult {
  ok: true;
  expressionCount: number;
  files: string[];
}

export interface DoudouLive2DExp3ValidationFailure {
  ok: false;
  issues: string[];
}

export type DoudouLive2DExp3ValidationResult =
  | DoudouLive2DExp3DirectoryResult
  | DoudouLive2DExp3ValidationFailure;

const DEFAULT_DOUDOU_EXP3_RELATIVE_FILES = DEFAULT_DOUDOU_EMOTION_IDS.map(
  (emotionId) => `expressions/doudou_${emotionId}.exp3.json`
);

export function toDoudouLive2DExp3Json(spec: DoudouLive2DExpressionSpec): DoudouLive2DExp3Json {
  return {
    Type: spec.type,
    FadeInTime: spec.fadeInSec,
    FadeOutTime: spec.fadeOutSec,
    Parameters: spec.parameters.map((target) => ({
      Id: target.id,
      Value: target.value,
      Blend: target.blend
    }))
  };
}

export function formatDoudouLive2DExp3Json(exp3Json: DoudouLive2DExp3Json): string {
  return `${JSON.stringify(exp3Json, null, 2)}\n`;
}

export async function exportDefaultDoudouLive2DExp3Directory(
  outputDir: string
): Promise<DoudouLive2DExp3DirectoryResult> {
  const specIssues = validateDoudouLive2DExpressionSpecs();
  if (specIssues.length > 0) {
    throw new Error(`Default Doudou Live2D expression specs are invalid: ${specIssues.join("; ")}`);
  }

  for (const spec of DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS) {
    const filePath = path.join(outputDir, spec.expressionFile);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, formatDoudouLive2DExp3Json(toDoudouLive2DExp3Json(spec)), "utf8");
  }

  return defaultDoudouExp3DirectoryResult();
}

export async function validateDoudouLive2DExp3Directory(
  expressionsDir: string
): Promise<DoudouLive2DExp3ValidationResult> {
  const issues: string[] = [];
  const specIssues = validateDoudouLive2DExpressionSpecs();
  issues.push(...specIssues);
  issues.push(...(await validateExpectedExp3FileSet(expressionsDir)));

  for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
    const expectedSpec = doudouLive2DExpressionForEmotion(emotionId);
    const relativeFile = expectedSpec.expressionFile;
    const readResult = await readExp3Json(path.join(expressionsDir, relativeFile), relativeFile);
    if (!readResult.ok) {
      issues.push(...readResult.issues);
      continue;
    }

    const expected = toDoudouLive2DExp3Json(expectedSpec);
    const validationIssues = validateExp3JsonShape(readResult.value, relativeFile);
    if (validationIssues.length > 0) {
      issues.push(...validationIssues);
      continue;
    }

    if (JSON.stringify(readResult.value) !== JSON.stringify(expected)) {
      issues.push(`${relativeFile} does not match DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS.`);
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues
    };
  }

  return defaultDoudouExp3DirectoryResult();
}

function defaultDoudouExp3DirectoryResult(): DoudouLive2DExp3DirectoryResult {
  return {
    ok: true,
    expressionCount: DEFAULT_DOUDOU_EMOTION_IDS.length,
    files: [...DEFAULT_DOUDOU_EXP3_RELATIVE_FILES]
  };
}

async function validateExpectedExp3FileSet(expressionsDir: string): Promise<string[]> {
  const expectedFiles = new Set(DEFAULT_DOUDOU_EXP3_RELATIVE_FILES);
  const actualFiles = await listExpressionRelativeFiles(path.join(expressionsDir, "expressions"), "expressions");
  return actualFiles
    .filter((relativeFile) => !expectedFiles.has(relativeFile) && !isHiddenRelativeFile(relativeFile))
    .map((relativeFile) => `${relativeFile} is not an expected default Doudou Live2D expression fixture.`);
}

async function listExpressionRelativeFiles(directory: string, relativeDirectory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const relativePath = toPosixPath(path.join(relativeDirectory, entry.name));
      if (entry.isDirectory()) {
        files.push(...(await listExpressionRelativeFiles(path.join(directory, entry.name), relativePath)));
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function readExp3Json(
  filePath: string,
  relativeFile: string
): Promise<{ ok: true; value: unknown } | DoudouLive2DExp3ValidationFailure> {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")) as unknown
    };
  } catch {
    return {
      ok: false,
      issues: [`${relativeFile} is missing or not valid JSON.`]
    };
  }
}

function validateExp3JsonShape(value: unknown, relativeFile: string): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return [`${relativeFile} must be a JSON object.`];
  }

  const allowedKeys = new Set(["Type", "FadeInTime", "FadeOutTime", "Parameters"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push(`${relativeFile} contains unsupported field ${key}.`);
    }
  }

  if (value.Type !== "Live2D Expression") {
    issues.push(`${relativeFile} Type must be "Live2D Expression".`);
  }
  if (typeof value.FadeInTime !== "number" || !Number.isFinite(value.FadeInTime)) {
    issues.push(`${relativeFile} FadeInTime must be a finite number.`);
  }
  if (typeof value.FadeOutTime !== "number" || !Number.isFinite(value.FadeOutTime)) {
    issues.push(`${relativeFile} FadeOutTime must be a finite number.`);
  }
  if (!Array.isArray(value.Parameters) || value.Parameters.length === 0) {
    issues.push(`${relativeFile} Parameters must be a non-empty array.`);
    return issues;
  }

  for (const [index, parameter] of value.Parameters.entries()) {
    if (!isRecord(parameter)) {
      issues.push(`${relativeFile} Parameters[${index}] must be a JSON object.`);
      continue;
    }
    const parameterKeys = new Set(Object.keys(parameter));
    for (const key of parameterKeys) {
      if (!["Id", "Value", "Blend"].includes(key)) {
        issues.push(`${relativeFile} Parameters[${index}] contains unsupported field ${key}.`);
      }
    }
    if (typeof parameter.Id !== "string" || parameter.Id.length === 0) {
      issues.push(`${relativeFile} Parameters[${index}].Id must be a non-empty string.`);
    }
    if (typeof parameter.Value !== "number" || !Number.isFinite(parameter.Value)) {
      issues.push(`${relativeFile} Parameters[${index}].Value must be a finite number.`);
    }
    if (!isDoudouLive2DBlendMode(parameter.Blend)) {
      issues.push(`${relativeFile} Parameters[${index}].Blend must be Add, Multiply, or Overwrite.`);
    }
  }

  return issues;
}

function isDoudouLive2DBlendMode(value: unknown): value is DoudouLive2DBlendMode {
  return value === "Add" || value === "Multiply" || value === "Overwrite";
}

function isHiddenRelativeFile(relativeFile: string): boolean {
  return relativeFile.split("/").some((segment) => segment.startsWith("."));
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
