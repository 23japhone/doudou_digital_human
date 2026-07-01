import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const electronBin = path.join(repoRoot, "node_modules/.bin/electron");
const appMain = path.join(repoRoot, "dist/src/app/main.js");
const defaultOutputDir = path.join(repoRoot, "output/playwright");

interface SpawnResult {
  code: number | null;
  output: string;
}

interface VisualQaReport {
  checked: string[];
  issues: Array<{
    selector: string;
    label: string;
    kind: string;
    detail: string;
  }>;
  screenshotPath?: string;
  viewport: {
    width: number;
    height: number;
    documentWidth: number;
    documentHeight: number;
  };
}

async function main(): Promise<void> {
  const outputDir = readFlagValue(process.argv, "--output") ?? defaultOutputDir;
  const result = await runAppVisualQa(outputDir);
  if (result.code !== 0) {
    throw new Error(`guided app visual QA exited ${result.code}\n${result.output}`);
  }
  const report = parseVisualQaReport(result.output);
  if (report.issues.length > 0) {
    throw new Error(`guided app visual QA found layout issues\n${JSON.stringify(report, null, 2)}`);
  }
  console.log(`guided app visual QA: ${JSON.stringify(report)}`);
}

function runAppVisualQa(outputDir: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(electronBin, [
      appMain,
      "--visual-qa",
      "--visual-qa-output",
      outputDir
    ], {
      cwd: repoRoot,
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`guided app visual QA timed out\n${output}`));
    }, 30000);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}

function parseVisualQaReport(output: string): VisualQaReport {
  const prefix = "app visual qa: ";
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    throw new Error(`guided app visual QA output did not include a structured result\n${output}`);
  }
  return JSON.parse(line.slice(prefix.length)) as VisualQaReport;
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
