import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS } from "../runtime/default-doudou-live2d.js";
import { exportDefaultDoudouLive2DExp3Directory } from "../runtime/default-doudou-exp3.js";

export type PrepareDoudouLive2DSampleModelFailureReason =
  | "output_exists"
  | "prepare_failed"
  | "sample_model_ambiguous"
  | "sample_model_invalid"
  | "sample_model_missing"
  | "unsafe_output_dir";

export type PrepareDoudouLive2DSampleModelResult =
  | {
    expressionCount: number;
    files: string[];
    model3Json: "default-doudou.model3.json";
    ok: true;
    sampleName: string;
    sourceModel3Json: string;
  }
  | {
    ok: false;
    reason: PrepareDoudouLive2DSampleModelFailureReason;
  };

export interface PrepareDoudouLive2DSampleModelInput {
  outputDir: string;
  overwrite?: boolean;
  sampleName?: string;
  sdkDir: string;
}

const DEFAULT_SAMPLE_NAME = "Mao";
const DEFAULT_MODEL3_JSON = "default-doudou.model3.json";
const PREPARED_MARKER_FILE = ".doudou-live2d-sample-model.json";
const PREPARED_MARKER_CREATED_BY = "doudou-live2d-sample-model";

export async function prepareDoudouLive2DSampleModel(
  input: PrepareDoudouLive2DSampleModelInput
): Promise<PrepareDoudouLive2DSampleModelResult> {
  const sampleName = input.sampleName?.trim() || DEFAULT_SAMPLE_NAME;
  const sdkDir = path.resolve(input.sdkDir);
  const outputDir = path.resolve(input.outputDir);
  const sampleDir = path.join(sdkDir, "Samples", "Resources", sampleName);
  if (!await isDirectory(sampleDir)) {
    return { ok: false, reason: "sample_model_missing" };
  }
  if (await exists(outputDir)) {
    if (!input.overwrite) {
      return { ok: false, reason: "output_exists" };
    }
    if (!await isSafePreparedOutputDir(outputDir)) {
      return { ok: false, reason: "unsafe_output_dir" };
    }
    await rm(outputDir, { force: true, recursive: true });
  }

  const sourceModel3Json = await sampleModel3JsonFile(sampleDir, sampleName);
  if (!sourceModel3Json) {
    return { ok: false, reason: "sample_model_missing" };
  }
  if (sourceModel3Json === "ambiguous") {
    return { ok: false, reason: "sample_model_ambiguous" };
  }

  try {
    await mkdir(path.dirname(outputDir), { recursive: true });
    await cp(sampleDir, outputDir, { recursive: true });
    const model3 = await readSampleModel3Json(path.join(outputDir, sourceModel3Json));
    if (!model3) {
      return { ok: false, reason: "sample_model_invalid" };
    }
    await rm(path.join(outputDir, "expressions"), { force: true, recursive: true });
    const expressionExport = await exportDefaultDoudouLive2DExp3Directory(outputDir);
    model3.FileReferences.Expressions = DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS.map((spec) => ({
      File: spec.expressionFile,
      Name: spec.expressionName
    }));
    await writeFile(path.join(outputDir, DEFAULT_MODEL3_JSON), `${JSON.stringify(model3, null, 2)}\n`, "utf8");
    await writePreparedMarker(outputDir, sampleName, sourceModel3Json);
    return {
      ok: true,
      expressionCount: expressionExport.expressionCount,
      files: expressionExport.files,
      model3Json: DEFAULT_MODEL3_JSON,
      sampleName,
      sourceModel3Json
    };
  } catch {
    return { ok: false, reason: "prepare_failed" };
  }
}

export async function runPrepareDoudouLive2DSampleModelCli(argv: string[]): Promise<number> {
  const args = parseArgs(argv.slice(2));
  if (!args.sdkDir) {
    console.error(
      "Usage: prepare-doudou-live2d-sample-model --sdk-dir <sdk-dir> [--sample <name>] [--out <model-dir>] [--overwrite]"
    );
    return 2;
  }
  const result = await prepareDoudouLive2DSampleModel({
    outputDir: args.outputDir ?? path.join(process.cwd(), "local_live2d_models", "default-doudou-sample"),
    overwrite: args.overwrite,
    sampleName: args.sampleName,
    sdkDir: args.sdkDir
  });
  const output = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(output);
    return 0;
  }
  console.error(output);
  return 1;
}

async function sampleModel3JsonFile(sampleDir: string, sampleName: string): Promise<string | "ambiguous" | null> {
  const entries = await readdir(sampleDir, { withFileTypes: true });
  const model3Files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".model3.json"))
    .map((entry) => entry.name);
  if (model3Files.length === 0) {
    return null;
  }
  const preferred = `${sampleName}.model3.json`;
  if (model3Files.includes(preferred)) {
    return preferred;
  }
  return model3Files.length === 1 ? model3Files[0] : "ambiguous";
}

async function readSampleModel3Json(filePath: string): Promise<SampleModel3Json | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return isSampleModel3Json(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface SampleModel3Json {
  Version: number;
  FileReferences: {
    Expressions?: Array<{
      File: string;
      Name: string;
    }>;
    Moc: string;
    Textures: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function isSampleModel3Json(value: unknown): value is SampleModel3Json {
  if (!isRecord(value) || value.Version !== 3 || !isRecord(value.FileReferences)) {
    return false;
  }
  return typeof value.FileReferences.Moc === "string" &&
    Array.isArray(value.FileReferences.Textures) &&
    value.FileReferences.Textures.every((texture) => typeof texture === "string");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function isSafePreparedOutputDir(outputDir: string): Promise<boolean> {
  if (path.parse(outputDir).root === outputDir) {
    return false;
  }
  try {
    const marker = JSON.parse(await readFile(path.join(outputDir, PREPARED_MARKER_FILE), "utf8")) as unknown;
    return isRecord(marker) &&
      marker.createdBy === PREPARED_MARKER_CREATED_BY &&
      marker.model3Json === DEFAULT_MODEL3_JSON;
  } catch {
    return false;
  }
}

async function writePreparedMarker(
  outputDir: string,
  sampleName: string,
  sourceModel3Json: string
): Promise<void> {
  await writeFile(path.join(outputDir, PREPARED_MARKER_FILE), `${JSON.stringify({
    createdBy: PREPARED_MARKER_CREATED_BY,
    model3Json: DEFAULT_MODEL3_JSON,
    sampleName,
    sourceModel3Json
  }, null, 2)}\n`, "utf8");
}

function parseArgs(args: string[]): {
  outputDir?: string;
  overwrite?: boolean;
  sampleName?: string;
  sdkDir?: string;
} {
  const parsed: {
    outputDir?: string;
    overwrite?: boolean;
    sampleName?: string;
    sdkDir?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--sdk-dir") {
      parsed.sdkDir = args[index + 1];
      index += 1;
    } else if (arg === "--sample") {
      parsed.sampleName = args[index + 1];
      index += 1;
    } else if (arg === "--out") {
      parsed.outputDir = args[index + 1];
      index += 1;
    } else if (arg === "--overwrite") {
      parsed.overwrite = true;
    }
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runPrepareDoudouLive2DSampleModelCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
