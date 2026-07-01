import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  checkStylizerQaScoring,
  type StylizerQaScoringCheckResult
} from "./stylizer-qa-check.js";

const execFileAsync = promisify(execFile);

export const STYLIZER_DEFAULT_PARAMETER_FILES = [
  "src/generation/adapters/deterministic-stylized-png-adapter.ts"
] as const;

export interface StylizerDefaultGateCheck {
  required: boolean;
  changedDefaultParameterFiles: string[];
}

export type StylizerDefaultGateResult =
  | {
      ok: true;
      code: "STYLIZER_DEFAULT_UNCHANGED";
      message: string;
      changedDefaultParameterFiles: [];
    }
  | {
      ok: true;
      code: "STYLIZER_DEFAULT_GATE_PASSED";
      candidateDefaultPresetId: string;
      averageScore: number;
      changedDefaultParameterFiles: string[];
    }
  | {
      ok: false;
      code: "SCORING_ARGUMENTS_REQUIRED";
      message: string;
      changedDefaultParameterFiles: string[];
    }
  | (Extract<StylizerQaScoringCheckResult, { ok: false }> & {
      changedDefaultParameterFiles: string[];
    });

interface ParsedStylizerDefaultGateArgs {
  changedFiles: string[];
  staged: boolean;
  baseRef: string | null;
  headRef: string | null;
  scoringPath: string | null;
  candidatePresetId: string | null;
}

export async function runStylizerDefaultGateCli(argv: string[]): Promise<number> {
  const parsed = parseStylizerDefaultGateArgs(argv.slice(2));
  if (!parsed.ok) {
    console.error(JSON.stringify(parsed.result, null, 2));
    return 2;
  }

  const changedFiles = parsed.args.changedFiles.length > 0
    ? parsed.args.changedFiles
    : await readChangedFilesFromGit(parsed.args);

  const result = await checkStylizerDefaultGate({
    changedFiles,
    scoringPath: parsed.args.scoringPath,
    candidatePresetId: parsed.args.candidatePresetId
  });

  const output = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(output);
    return 0;
  }

  console.error(output);
  return result.code === "SCORING_ARGUMENTS_REQUIRED" ? 2 : 1;
}

export async function checkStylizerDefaultGate(options: {
  changedFiles: string[];
  scoringPath: string | null;
  candidatePresetId: string | null;
}): Promise<StylizerDefaultGateResult> {
  const gateCheck = shouldRunStylizerDefaultGate(options.changedFiles);
  if (!gateCheck.required) {
    return {
      ok: true,
      code: "STYLIZER_DEFAULT_UNCHANGED",
      message: "No default stylizer parameter files changed.",
      changedDefaultParameterFiles: []
    };
  }

  if (!options.scoringPath || !options.candidatePresetId) {
    return {
      ok: false,
      code: "SCORING_ARGUMENTS_REQUIRED",
      message: "Default stylizer parameter changes require a manual scoring JSON path and candidate preset.",
      changedDefaultParameterFiles: gateCheck.changedDefaultParameterFiles
    };
  }

  const scoringResult = await checkStylizerQaScoring({
    scoringPath: options.scoringPath,
    candidatePresetId: options.candidatePresetId
  });

  if (!scoringResult.ok) {
    return {
      ...scoringResult,
      changedDefaultParameterFiles: gateCheck.changedDefaultParameterFiles
    };
  }

  return {
    ok: true,
    code: "STYLIZER_DEFAULT_GATE_PASSED",
    candidateDefaultPresetId: scoringResult.candidateDefaultPresetId,
    averageScore: scoringResult.averageScore,
    changedDefaultParameterFiles: gateCheck.changedDefaultParameterFiles
  };
}

export function shouldRunStylizerDefaultGate(changedFiles: string[]): StylizerDefaultGateCheck {
  const changedDefaultParameterFiles = uniqueSorted(
    changedFiles
      .map(normalizeRepoPath)
      .filter((file): file is string => file !== null)
      .filter((file) => STYLIZER_DEFAULT_PARAMETER_FILES.includes(
        file as typeof STYLIZER_DEFAULT_PARAMETER_FILES[number]
      ))
  );

  return {
    required: changedDefaultParameterFiles.length > 0,
    changedDefaultParameterFiles
  };
}

function parseStylizerDefaultGateArgs(args: string[]):
  | { ok: true; args: ParsedStylizerDefaultGateArgs }
  | { ok: false; result: Extract<StylizerDefaultGateResult, { code: "SCORING_ARGUMENTS_REQUIRED" }> } {
  const parsed: ParsedStylizerDefaultGateArgs = {
    changedFiles: [],
    staged: false,
    baseRef: null,
    headRef: null,
    scoringPath: null,
    candidatePresetId: null
  };
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--changed-file") {
      const value = args[index + 1];
      if (!value) {
        return usageError();
      }
      parsed.changedFiles.push(value);
      index += 1;
      continue;
    }
    if (arg === "--staged") {
      parsed.staged = true;
      continue;
    }
    if (arg === "--base") {
      const value = args[index + 1];
      if (!value) {
        return usageError();
      }
      parsed.baseRef = value;
      index += 1;
      continue;
    }
    if (arg === "--head") {
      const value = args[index + 1];
      if (!value) {
        return usageError();
      }
      parsed.headRef = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h" || arg.startsWith("--")) {
      return usageError();
    }

    positional.push(arg);
  }

  if (positional.length > 2) {
    return usageError();
  }

  parsed.scoringPath = positional[0] ?? process.env.STYLIZER_SCORING_FILE ?? null;
  parsed.candidatePresetId = positional[1] ?? process.env.STYLIZER_CANDIDATE_PRESET ?? null;
  return {
    ok: true,
    args: parsed
  };
}

function usageError(): { ok: false; result: Extract<StylizerDefaultGateResult, { code: "SCORING_ARGUMENTS_REQUIRED" }> } {
  return {
    ok: false,
    result: {
      ok: false,
      code: "SCORING_ARGUMENTS_REQUIRED",
      message: "Usage: stylizer-default-gate [--changed-file <path>...] [--staged] [--base <ref> [--head <ref>]] [manual-scoring-template.json candidate-preset]",
      changedDefaultParameterFiles: []
    }
  };
}

async function readChangedFilesFromGit(args: ParsedStylizerDefaultGateArgs): Promise<string[]> {
  if (args.baseRef) {
    return gitDiffNameOnly(args.headRef ? [args.baseRef, args.headRef] : [args.baseRef]);
  }

  if (args.staged) {
    return gitDiffNameOnly(["--cached"]);
  }

  return gitDiffNameOnly(["HEAD"]);
}

async function gitDiffNameOnly(args: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["diff", "--name-only", ...args], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeRepoPath(filePath: string): string | null {
  if (filePath.includes("\0") || /^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
    return null;
  }

  const withForwardSlashes = filePath.split(path.sep).join("/");
  const normalized = path.posix.normalize(withForwardSlashes);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    return null;
  }

  return normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runStylizerDefaultGateCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error(JSON.stringify({
        ok: false,
        code: "STYLIZER_DEFAULT_GATE_FAILED",
        message: "Stylizer default gate failed unexpectedly."
      }, null, 2));
      process.exitCode = 1;
    });
}
