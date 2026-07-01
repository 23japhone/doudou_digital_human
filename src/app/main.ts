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
import { StylizerPreviewComparisonError } from "../generation/stylizer-preview-comparison.js";
import { CloudImageAdapterError } from "../generation/adapters/cloud-image-adapter.js";
import { PetReviewError } from "../review/pet-review.js";
import { PetBundleValidationError } from "../pet_bundle/validate.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

interface AppOptions {
  smoke: boolean;
  smokeGenerationMode: GuidedGenerationMode;
  smokeSourceImagePath?: string;
  visualQa: boolean;
  visualQaOutputDir?: string;
  workspaceDir?: string;
}

let mainWindow: BrowserWindow | null = null;
let flow: GuidedPetFlow;
let options: AppOptions;
let smokeTimeout: NodeJS.Timeout | null = null;
let quitAfterRuntimeStop = false;

async function main(): Promise<void> {
  options = parseArgs(process.argv.slice(2));
  const workspaceDir = options.workspaceDir ?? join(app.getPath("userData"), "pet-studio");
  flow = new GuidedPetFlow({
    workspaceDir,
    runtimeElectronPath: process.execPath,
    runtimeMainPath: resolve(currentDir, "../runtime/main.js")
  });
  await flow.initialize();
  registerQuitHandler();

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
  const parsed: AppOptions = { smoke: false, smokeGenerationMode: "mock_cloud", visualQa: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--smoke") {
      parsed.smoke = true;
    } else if (arg === "--visual-qa") {
      parsed.visualQa = true;
    } else if (arg === "--visual-qa-output") {
      parsed.visualQaOutputDir = args[index + 1];
      index += 1;
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
    width: options.visualQa ? 900 : 1040,
    height: options.visualQa ? 640 : 740,
    minWidth: 900,
    minHeight: 640,
    title: "兜兜桌宠工作台",
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void mainWindow.loadFile(join(currentDir, "index.html")).then(() => {
    if (options.visualQa) {
      void runVisualQa();
    }
  });
  if (options.smoke || options.visualQa) {
    smokeTimeout = setTimeout(() => {
      console.error("app automation: renderer did not finish within 30s");
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
  ipcMain.handle("app:create-developer-preview", async () => withState(() => flow.createDeveloperPreview()));
  ipcMain.handle("app:create-review", async () => withState(() => flow.createReview()));
  ipcMain.handle("app:accept-pet", async () => withState(() => flow.acceptPet()));
  ipcMain.handle("app:launch-pet", async () => withState(() => flow.launchPet({ smoke: options.smoke })));
  ipcMain.handle("app:stop-pet", async () => withState(() => flow.stopPet()));
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

async function runVisualQa(): Promise<void> {
  try {
    if (!mainWindow) {
      throw new Error("Visual QA window is not available.");
    }
    const { runGuidedAppVisualQa } = await import("./visual-qa.js");
    const report = await runGuidedAppVisualQa(mainWindow, options.visualQaOutputDir);
    if (smokeTimeout) {
      clearTimeout(smokeTimeout);
      smokeTimeout = null;
    }
    console.log(`app visual qa: ${JSON.stringify(report)}`);
    app.exit(report.issues.length === 0 ? 0 : 1);
  } catch (error) {
    if (smokeTimeout) {
      clearTimeout(smokeTimeout);
      smokeTimeout = null;
    }
    console.error("app visual qa failed:", error);
    app.exit(1);
  }
}

function registerQuitHandler(): void {
  app.on("before-quit", (event) => {
    if (quitAfterRuntimeStop) {
      return;
    }
    event.preventDefault();
    quitAfterRuntimeStop = true;
    void flow
      .stopPet()
      .catch((error: unknown) => {
        console.error("Failed to stop managed runtime before quitting.", error);
      })
      .finally(() => {
        app.quit();
      });
  });
}

async function selectSourceImagePath(): Promise<string | null> {
  if (options.smoke) {
    return options.smokeSourceImagePath ?? null;
  }
  const dialogOptions: OpenDialogOptions = {
    title: "选择源图片",
    properties: ["openFile"],
    filters: [
      { name: "图片", extensions: ["png", "jpg", "jpeg"] }
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
    error instanceof StylizerPreviewComparisonError ||
    error instanceof CloudImageAdapterError ||
    error instanceof PetGenerationError ||
    error instanceof PetReviewError
  ) {
    return { code: error.code, message: localizedActionErrorMessage(error.code) };
  }
  if (error instanceof PetBundleValidationError) {
    return {
      code: error.issues[0]?.code ?? "PET_BUNDLE_INVALID",
      message: "桌宠资源包校验失败。"
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    message: "未知错误。"
  };
}

function localizedActionErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    SOURCE_IMAGE_REQUIRED: "请先选择一张源图片。",
    DRAFT_BUNDLE_REQUIRED: "请先生成桌宠草稿。",
    ACCEPTED_BUNDLE_REQUIRED: "请先接受一个桌宠资源包。",
    LIVE_PROVIDER_NOT_ENABLED: "OpenAI 实时生成尚未启用，请先配置环境变量并勾选上传确认。",
    RUNTIME_LAUNCH_FAILED: "桌宠启动失败。",
    RUNTIME_STOP_FAILED: "桌宠停止失败。",
    MISSING_SOURCE_IMAGE: "请选择一张源图片。",
    SOURCE_URI_UNSUPPORTED: "请选择本地文件，不支持 file URI。",
    REMOTE_SOURCE_UNSUPPORTED: "请选择本地文件，不支持远程图片地址。",
    UNSAFE_SOURCE_PATH: "源图片路径不安全。",
    SOURCE_IMAGE_NOT_FOUND: "源图片不存在。",
    SOURCE_IMAGE_NOT_FILE: "源图片路径必须指向文件。",
    UNSUPPORTED_SOURCE_IMAGE_TYPE: "源图片必须是 PNG 或 JPEG。",
    INVALID_SOURCE_IMAGE: "源图片无法解码。",
    SOURCE_IMAGE_TOO_SMALL: "源图片尺寸太小，无法生成。",
    SOURCE_IMAGE_TOO_LARGE: "源图片尺寸太大，无法生成。",
    CLOUD_OPT_IN_REQUIRED: "云端生成需要先勾选上传确认。",
    PROVIDER_NOT_CONFIGURED: "所选提供方尚未配置。",
    SOURCE_IMAGE_NORMALIZATION_FAILED: "源图片归一化失败。",
    MODEL_REFUSED: "模型拒绝了这次生成请求。",
    MODEL_RATE_LIMITED: "模型调用频率受限，请稍后重试。",
    MODEL_TIMEOUT: "模型请求超时，请稍后重试。",
    MODEL_PROVIDER_ERROR: "模型提供方调用失败。",
    MODEL_OUTPUT_INVALID: "模型输出无效。",
    POSTPROCESSING_FAILED: "生成结果后处理失败。",
    MISSING_OUTPUT_DIR: "缺少输出目录。",
    OUTPUT_PATH_NOT_DIRECTORY: "输出路径必须是目录。",
    OUTPUT_DIR_NOT_EMPTY: "输出目录必须为空。",
    ADAPTER_OUTPUT_INVALID: "生成适配器输出无效。",
    REVIEW_DIR_UNSAFE: "检查输出目录不安全。",
    REVIEW_DIR_NOT_EMPTY: "检查输出目录必须为空。",
    INSTALLATION_ALREADY_EXISTS: "已接受的桌宠资源包已存在。",
    INSTALLATION_ROOT_UNSAFE: "安装目录不安全。",
    INSTALLATION_ROOT_INVALID: "安装目录必须是有效目录。",
    DELETE_TARGET_UNSAFE: "删除目标不安全。",
    DELETE_TARGET_MISSING: "删除目标不存在。",
    DELETE_TARGET_NOT_DIRECTORY: "删除目标必须是目录。"
  };
  return messages[code] ?? "操作失败，请查看日志。";
}

app.on("window-all-closed", () => {
  app.quit();
});

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
