import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  STYLIZER_SCORE_DIMENSIONS,
  evaluateDefaultParameterChangeEvidence,
  type DefaultParameterChangeGateResult,
  type StylizerManualScoringEntry,
  type StylizerManualScoringTemplate,
  type StylizerScoreDimensionId
} from "../generation/stylizer-qa.js";

type GateSuccess = Extract<DefaultParameterChangeGateResult, { ok: true }>;
type GateFailure = Extract<DefaultParameterChangeGateResult, { ok: false }>;
type ScoringFileUnreadableResult = {
  ok: false;
  code: "SCORING_FILE_UNREADABLE";
  message: string;
};
type ScoringFileInvalidResult = {
  ok: false;
  code: "SCORING_FILE_INVALID";
  message: string;
};

export type StylizerQaScoringCheckResult =
  | GateSuccess
  | GateFailure
  | ScoringFileUnreadableResult
  | ScoringFileInvalidResult;

export interface CheckStylizerQaScoringOptions {
  scoringPath: string;
  candidatePresetId: string;
}

const SENSITIVE_SCORING_KEY_PATTERNS = [
  /"sourceImageUri"\s*:/i,
  /"sourceImageUrl"\s*:/i,
  /"openaiApiKey"\s*:/i,
  /"apiSecret"\s*:/i,
  /"accessToken"\s*:/i,
  /"authToken"\s*:/i,
  /"bearerToken"\s*:/i,
  /"rawResponse"\s*:/i,
  /"prompt"\s*:/i,
  /file:\/\//i
];

export async function checkStylizerQaScoring(
  options: CheckStylizerQaScoringOptions
): Promise<StylizerQaScoringCheckResult> {
  const text = await readScoringText(options.scoringPath);
  if (!text.ok) {
    return text;
  }

  if (containsUnsafeScoringContent(text.content)) {
    return invalidScoringFileResult();
  }

  const parsed = parseScoringJson(text.content);
  if (!parsed.ok) {
    return parsed;
  }

  if (!isStylizerManualScoringTemplate(parsed.value)) {
    return invalidScoringFileResult();
  }

  return evaluateDefaultParameterChangeEvidence(parsed.value, options.candidatePresetId);
}

export async function runStylizerQaCheckCli(argv: string[]): Promise<number> {
  const scoringPath = argv[2];
  const candidatePresetId = argv[3];
  if (!scoringPath || !candidatePresetId || argv.length > 4) {
    console.error("Usage: stylizer-qa-check <manual-scoring-template.json> <candidate-preset>");
    return 2;
  }

  const result = await checkStylizerQaScoring({ scoringPath, candidatePresetId });
  const output = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(output);
    return 0;
  }

  console.error(output);
  return 1;
}

async function readScoringText(
  scoringPath: string
): Promise<{ ok: true; content: string } | ScoringFileUnreadableResult> {
  try {
    return {
      ok: true,
      content: await readFile(scoringPath, "utf8")
    };
  } catch {
    return {
      ok: false,
      code: "SCORING_FILE_UNREADABLE",
      message: "Manual scoring file could not be read."
    };
  }
}

function parseScoringJson(
  content: string
): { ok: true; value: unknown } | ScoringFileInvalidResult {
  try {
    return {
      ok: true,
      value: JSON.parse(content) as unknown
    };
  } catch {
    return invalidScoringFileResult();
  }
}

function invalidScoringFileResult(): ScoringFileInvalidResult {
  return {
    ok: false,
    code: "SCORING_FILE_INVALID",
    message: "Manual scoring file must be a valid stylizer-manual-score.v0.1 JSON document."
  };
}

function containsUnsafeScoringContent(content: string): boolean {
  return SENSITIVE_SCORING_KEY_PATTERNS.some((pattern) => pattern.test(content));
}

function isStylizerManualScoringTemplate(value: unknown): value is StylizerManualScoringTemplate {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.schemaVersion !== "stylizer-manual-score.v0.1" ||
    !isOneOf(value.status, ["needs_scoring", "scored"]) ||
    typeof value.createdAt !== "string" ||
    typeof value.reviewer !== "string" ||
    !(typeof value.reviewedAt === "string" || value.reviewedAt === null) ||
    !isScoreDimensions(value.dimensions) ||
    !isGateConfig(value.defaultParameterChangeGate) ||
    !isNamedIdArray(value.presets) ||
    !isNamedIdArray(value.cases) ||
    !Array.isArray(value.entries)
  ) {
    return false;
  }

  const presetIds = new Set(value.presets.map((preset) => preset.id));
  const caseIds = new Set(value.cases.map((corpusCase) => corpusCase.id));
  const seenEntries = new Set<string>();

  for (const entry of value.entries) {
    if (!isScoringEntry(entry, presetIds, caseIds)) {
      return false;
    }

    const entryKey = `${entry.caseId}/${entry.presetId}`;
    if (seenEntries.has(entryKey)) {
      return false;
    }
    seenEntries.add(entryKey);
  }

  return true;
}

function isGateConfig(value: unknown): value is StylizerManualScoringTemplate["defaultParameterChangeGate"] {
  return isRecord(value) &&
    (typeof value.candidateDefaultPresetId === "string" || value.candidateDefaultPresetId === null) &&
    typeof value.approved === "boolean" &&
    value.minimumAverageScore === 4 &&
    value.minimumDimensionScore === 3;
}

function isNamedIdArray(value: unknown): value is Array<{ id: string; title: string }> {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => isRecord(entry) && isSafeId(entry.id) && typeof entry.title === "string");
}

function isScoreDimensions(value: unknown): value is StylizerManualScoringTemplate["dimensions"] {
  if (!Array.isArray(value) || value.length !== STYLIZER_SCORE_DIMENSIONS.length) {
    return false;
  }

  const seenDimensionIds = new Set<StylizerScoreDimensionId>();
  for (const dimension of value) {
    if (!isRecord(dimension) || typeof dimension.label !== "string" || typeof dimension.rubric !== "string") {
      return false;
    }

    const expectedDimension = STYLIZER_SCORE_DIMENSIONS.find((expected) => expected.id === dimension.id);
    if (!expectedDimension || seenDimensionIds.has(expectedDimension.id)) {
      return false;
    }
    seenDimensionIds.add(expectedDimension.id);
  }

  return seenDimensionIds.size === STYLIZER_SCORE_DIMENSIONS.length;
}

function isScoringEntry(
  value: unknown,
  presetIds: Set<string>,
  caseIds: Set<string>
): value is StylizerManualScoringEntry {
  if (!isRecord(value) ||
    typeof value.caseId !== "string" ||
    typeof value.presetId !== "string" ||
    !caseIds.has(value.caseId) ||
    !presetIds.has(value.presetId) ||
    !isSafeRelativeReportPath(value.previewPath) ||
    !isRecord(value.scores) ||
    typeof value.notes !== "string"
  ) {
    return false;
  }

  for (const dimension of STYLIZER_SCORE_DIMENSIONS) {
    if (!isNullableScore(value.scores[dimension.id])) {
      return false;
    }
  }

  return true;
}

function isNullableScore(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]+$/i.test(value);
}

function isSafeRelativeReportPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || value.includes("\0")) {
    return false;
  }

  if (path.isAbsolute(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false;
  }

  const normalized = path.posix.normalize(value);
  return normalized === value && !normalized.startsWith("../") && normalized !== "..";
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runStylizerQaCheckCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error(JSON.stringify({
        ok: false,
        code: "SCORING_CHECK_FAILED",
        message: "Stylizer QA scoring check failed unexpectedly."
      }, null, 2));
      process.exitCode = 1;
    });
}
