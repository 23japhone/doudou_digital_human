import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenDialogOptions } from "electron";
import type {
  AppActionResult,
  GuidedAppSmokeConfig,
  GuidedAppSmokeResult
} from "./app-types.js";
import {
  GuidedPetFlow,
  GuidedPetFlowError,
  type GuidedGenerationMode,
  type PublicGuidedPetState
} from "./guided-flow.js";
import { PetGenerationError, SourceImageIntakeError, SourceImageNormalizationError } from "../generation/generate-pet.js";
import { CloudImageAdapterError } from "../generation/adapters/cloud-image-adapter.js";
import { PetReviewError } from "../review/pet-review.js";
import { PetBundleValidationError } from "../pet_bundle/validate.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

interface AppOptions {
  smoke: boolean;
  smokeGenerationMode: GuidedGenerationMode;
  smokeSourceImagePath?: string;
  workspaceDir?: string;
}

let mainWindow: BrowserWindow | null = null;
let flow: GuidedPetFlow;
let options: AppOptions;
let smokeTimeout: NodeJS.Timeout | null = null;

async function main(): Promise<void> {
  options = parseArgs(process.argv.slice(2));
  const workspaceDir = options.workspaceDir ?? join(app.getPath("userData"), "pet-studio");
  flow = new GuidedPetFlow({
    workspaceDir,
    runtimeElectronPath: process.execPath,
    runtimeMainPath: resolve(currentDir, "../runtime/main.js")
  });
  await flow.initialize();

  await app.whenReady();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

function parseArgs(args: string[]): AppOptions {
  const parsed: AppOptions = { smoke: false, smokeGenerationMode: "mock_cloud" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--smoke") {
      parsed.smoke = true;
    } else if (arg === "--provider" || arg === "--generation-mode") {
      parsed.smokeGenerationMode = parseGenerationMode(args[index + 1]);
      index += 1;
    } else if (arg === "--source") {
      parsed.smokeSourceImagePath = args[index + 1];
      index += 1;
    } else if (arg === "--workspace") {
      parsed.workspaceDir = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function parseGenerationMode(value: string | undefined): GuidedGenerationMode {
  if (value === "openai-image") {
    return "openai_live";
  }
  if (value === "mock-provider") {
    return "mock_cloud";
  }
  if (value === "local" || value === "mock_cloud" || value === "openai_live") {
    return value;
  }
  return "mock_cloud";
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 900,
    minHeight: 640,
    title: "Doudou Pet Studio",
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void mainWindow.loadFile(join(currentDir, "index.html"));
  if (options.smoke) {
    smokeTimeout = setTimeout(() => {
      console.error("app smoke: renderer did not finish within 30s");
      app.exit(1);
    }, 30000);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("app:get-state", () => flow.getPublicState());
  ipcMain.handle("app:get-smoke-config", (): GuidedAppSmokeConfig => ({
    enabled: options.smoke,
    generationMode: options.smokeGenerationMode
  }));
  ipcMain.handle("app:set-generation-settings", async (_event, settings) =>
    withState(() => flow.setGenerationSettings(settings))
  );
  ipcMain.handle("app:select-source-image", async () =>
    withState(async () => {
      const sourceImagePath = await selectSourceImagePath();
      if (!sourceImagePath) {
        return undefined;
      }
      return flow.setSourceImagePath(sourceImagePath);
    })
  );
  ipcMain.handle("app:generate-pet", async () => withState(() => flow.generatePet()));
  ipcMain.handle("app:create-review", async () => withState(() => flow.createReview()));
  ipcMain.handle("app:accept-pet", async () => withState(() => flow.acceptPet()));
  ipcMain.handle("app:launch-pet", async () => withState(() => flow.launchPet({ smoke: options.smoke })));
  ipcMain.handle("app:delete-draft-assets", async () => withState(() => flow.deleteDraftAssets()));
  ipcMain.handle("app:delete-accepted-pet", async () => withState(() => flow.deleteAcceptedPet()));
  ipcMain.on("app:smoke-result", (_event, result: GuidedAppSmokeResult) => {
    if (!options.smoke) {
      return;
    }
    if (smokeTimeout) {
      clearTimeout(smokeTimeout);
      smokeTimeout = null;
    }
    console.log(`app smoke: ${JSON.stringify(result)}`);
    setTimeout(() => app.quit(), 250);
  });
}

async function selectSourceImagePath(): Promise<string | null> {
  if (options.smoke) {
    return options.smokeSourceImagePath ?? null;
  }
  const dialogOptions: OpenDialogOptions = {
    title: "Select source image",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg"] }
    ]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  return result.canceled ? null : result.filePaths[0] ?? null;
}

async function withState<T>(action: () => Promise<T | undefined>): Promise<AppActionResult<T>> {
  try {
    const result = await action();
    return {
      ok: true,
      state: flow.getPublicState(),
      result
    };
  } catch (error) {
    return {
      ok: false,
      state: flow.getPublicState(),
      error: serializeActionError(error)
    };
  }
}

function serializeActionError(error: unknown): { code: string; message: string } {
  if (
    error instanceof GuidedPetFlowError ||
    error instanceof SourceImageIntakeError ||
    error instanceof SourceImageNormalizationError ||
    error instanceof CloudImageAdapterError ||
    error instanceof PetGenerationError ||
    error instanceof PetReviewError
  ) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof PetBundleValidationError) {
    return {
      code: error.issues[0]?.code ?? "PET_BUNDLE_INVALID",
      message: "Pet bundle validation failed."
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unknown app error."
  };
}

app.on("window-all-closed", () => {
  app.quit();
});

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
