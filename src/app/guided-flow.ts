import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generatePetBundleFromSource } from "../generation/generate-pet.js";
import {
  runStylizerPreviewComparison,
  type StylizerPreviewComparisonReport
} from "../generation/stylizer-preview-comparison.js";
import {
  createCloudImageAdapter,
  createMockCloudImageProvider
} from "../generation/adapters/cloud-image-adapter.js";
import { createOpenAiImageProvider } from "../generation/adapters/openai-image-provider.js";
import type { PetGenerationAdapter } from "../generation/adapters/types.js";
import {
  acceptPetBundle,
  createPetReview,
  deletePetAssets,
  PetReviewError
} from "../review/pet-review.js";
import type { RuntimeSmokeResult } from "../runtime/runtime-types.js";

export type GuidedPetFlowStatus =
  | "idle"
  | "source_selected"
  | "generated"
  | "needs_review"
  | "accepted"
  | "launched";

export type GuidedGenerationMode = "local" | "mock_cloud" | "openai_live";
export type GuidedCloudProviderId = "mock-provider" | "openai-image";

export type GuidedPetFlowErrorCode =
  | "SOURCE_IMAGE_REQUIRED"
  | "DRAFT_BUNDLE_REQUIRED"
  | "ACCEPTED_BUNDLE_REQUIRED"
  | "LIVE_PROVIDER_NOT_ENABLED"
  | "RUNTIME_LAUNCH_FAILED"
  | "RUNTIME_STOP_FAILED";

export class GuidedPetFlowError extends Error {
  readonly code: GuidedPetFlowErrorCode;

  constructor(code: GuidedPetFlowErrorCode, message: string) {
    super(message);
    this.name = "GuidedPetFlowError";
    this.code = code;
  }
}

export interface GuidedPetFlowOptions {
  workspaceDir: string;
  now?: Date;
  runtimeElectronPath?: string;
  runtimeMainPath?: string;
  runtimeReadyTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  openAiFetch?: typeof fetch;
}

export interface GuidedGenerationSettings {
  mode: GuidedGenerationMode;
  providerId?: GuidedCloudProviderId;
  confirmCloudUpload?: boolean;
}

export interface PublicGuidedPetState {
  status: GuidedPetFlowStatus;
  sourceImageName: string | null;
  petId: string | null;
  petName: string | null;
  review: {
    previewUrl: string;
    contactSheetUrl: string;
    checks: string[];
  } | null;
  developerPreview: {
    contactSheetUrl: string;
    previews: Array<{
      presetId: string;
      title: string;
      currentDefault: boolean;
      previewUrl: string;
      metrics: StylizerPreviewComparisonReport["previews"][number]["metrics"];
    }>;
  } | null;
  accepted: {
    petId: string;
    petName: string;
  } | null;
  launch: {
    launched: boolean;
    running: boolean;
    smokeResult?: RuntimeSmokeResult;
  } | null;
  generation: {
    mode: GuidedGenerationMode;
    providerId: string | null;
    cloudUploadConfirmed: boolean;
    cloudProviderConfigured: boolean;
    liveProviderEnabled: boolean;
  };
  actions: {
    canGenerate: boolean;
    canCreateDeveloperPreview: boolean;
    canReview: boolean;
    canAccept: boolean;
    canLaunch: boolean;
    canStopLaunch: boolean;
    canDeleteDraft: boolean;
    canDeleteAccepted: boolean;
  };
  lastError: {
    code: string;
    message: string;
  } | null;
}

export interface SelectSourceImageResult {
  sourceImageName: string;
}

export interface GenerateFlowResult {
  bundleDir: string;
  petId: string;
  petName: string;
}

export interface DeveloperPreviewFlowResult {
  presetIds: string[];
  previewCount: number;
}

export interface ReviewFlowResult {
  reportPath: string;
  previewPath: string;
  contactSheetPath: string;
}

export interface AcceptFlowResult {
  installedBundleDir: string;
  petId: string;
  petName: string;
}

export interface DeleteFlowResult {
  deleted: boolean;
}

export interface LaunchFlowOptions {
  smoke?: boolean;
}

export interface LaunchFlowResult {
  launched: true;
  smokeResult?: RuntimeSmokeResult;
}

export interface StopFlowResult {
  stopped: boolean;
}

interface DraftState {
  runId: string;
  runDir: string;
  bundleDir: string;
  petId: string;
  petName: string;
}

interface ReviewState {
  runDir: string;
  reportPath: string;
  previewPath: string;
  contactSheetPath: string;
  checks: string[];
}

interface DeveloperPreviewState {
  runDir: string;
  contactSheetPath: string;
  previews: Array<{
    presetId: string;
    title: string;
    currentDefault: boolean;
    previewPath: string;
    metrics: StylizerPreviewComparisonReport["previews"][number]["metrics"];
  }>;
}

interface AcceptedState {
  installedBundleDir: string;
  petId: string;
  petName: string;
}

export class GuidedPetFlow {
  private readonly workspaceDir: string;
  private readonly draftsRoot: string;
  private readonly reviewsRoot: string;
  private readonly developerPreviewsRoot: string;
  private readonly libraryRoot: string;
  private readonly now?: Date;
  private readonly runtimeElectronPath: string;
  private readonly runtimeMainPath?: string;
  private readonly runtimeReadyTimeoutMs: number;
  private readonly env: NodeJS.ProcessEnv;
  private readonly openAiFetch?: typeof fetch;
  private generationSettings: Required<GuidedGenerationSettings> = {
    mode: "local",
    providerId: "mock-provider",
    confirmCloudUpload: false
  };
  private sourceImagePath: string | null = null;
  private sourceImageName: string | null = null;
  private status: GuidedPetFlowStatus = "idle";
  private draft: DraftState | null = null;
  private review: ReviewState | null = null;
  private developerPreview: DeveloperPreviewState | null = null;
  private accepted: AcceptedState | null = null;
  private launch: PublicGuidedPetState["launch"] = null;
  private runtimeProcess: ChildProcess | null = null;
  private lastError: PublicGuidedPetState["lastError"] = null;
  private runCounter = 0;

  constructor(options: GuidedPetFlowOptions) {
    this.workspaceDir = resolve(options.workspaceDir);
    this.draftsRoot = join(this.workspaceDir, "drafts");
    this.reviewsRoot = join(this.workspaceDir, "reviews");
    this.developerPreviewsRoot = join(this.workspaceDir, "developer-previews");
    this.libraryRoot = join(this.workspaceDir, "library");
    this.now = options.now;
    this.runtimeElectronPath = options.runtimeElectronPath ?? process.execPath;
    this.runtimeMainPath = options.runtimeMainPath;
    this.runtimeReadyTimeoutMs = options.runtimeReadyTimeoutMs ?? 5000;
    this.env = options.env ?? process.env;
    this.openAiFetch = options.openAiFetch;
  }

  async initialize(): Promise<void> {
    await mkdir(this.draftsRoot, { recursive: true });
    await mkdir(this.reviewsRoot, { recursive: true });
    await mkdir(this.developerPreviewsRoot, { recursive: true });
    await mkdir(this.libraryRoot, { recursive: true });
  }

  async setSourceImagePath(sourceImagePath: string): Promise<SelectSourceImageResult> {
    await this.deleteDeveloperPreviewAssets();
    this.sourceImagePath = sourceImagePath;
    this.sourceImageName = basename(sourceImagePath);
    this.status = "source_selected";
    this.lastError = null;
    return { sourceImageName: this.sourceImageName };
  }

  async setGenerationSettings(settings: Partial<GuidedGenerationSettings> = {}): Promise<PublicGuidedPetState> {
    const mode = normalizeGenerationMode(settings.mode);
    this.generationSettings = {
      mode,
      providerId: providerIdForMode(mode),
      confirmCloudUpload: mode === "local" ? false : settings.confirmCloudUpload ?? false
    };
    this.lastError = null;
    return this.getPublicState();
  }

  async generatePet(): Promise<GenerateFlowResult> {
    if (!this.sourceImagePath) {
      throw this.setError(new GuidedPetFlowError("SOURCE_IMAGE_REQUIRED", "Select a source image before generating."));
    }
    await this.stopRuntimeProcess();
    this.launch = null;
    if (this.status === "launched") {
      this.status = this.statusAfterRuntimeStops();
    }
    const adapter = this.createGenerationAdapter();
    adapter?.preflight?.();
    if (this.draft) {
      await this.deleteDraftAssets({ clearSourceImage: false });
    }

    const runId = this.createRunId();
    const runDir = join(this.draftsRoot, runId);
    const bundleDir = join(runDir, "bundle");
    const result = await generatePetBundleFromSource({
      sourceImagePath: this.sourceImagePath,
      outputBundleDir: bundleDir,
      normalizationTempRoot: join(runDir, "normalization"),
      adapter,
      now: this.now
    });
    this.draft = {
      runId,
      runDir,
      bundleDir,
      petId: result.manifest.id,
      petName: result.manifest.name
    };
    this.review = null;
    this.launch = null;
    this.status = "generated";
    this.lastError = null;
    return {
      bundleDir,
      petId: result.manifest.id,
      petName: result.manifest.name
    };
  }

  async createDeveloperPreview(): Promise<DeveloperPreviewFlowResult> {
    if (!this.sourceImagePath) {
      throw this.setError(new GuidedPetFlowError("SOURCE_IMAGE_REQUIRED", "Select a source image before previewing."));
    }
    await this.deleteDeveloperPreviewAssets();

    const runId = this.createRunId();
    const runDir = join(this.developerPreviewsRoot, runId);
    const outputDir = join(runDir, "comparison");
    await mkdir(runDir, { recursive: true });
    let result: Awaited<ReturnType<typeof runStylizerPreviewComparison>>;
    try {
      result = await runStylizerPreviewComparison({
        sourceImagePath: this.sourceImagePath,
        outputDir,
        normalizationTempRoot: join(runDir, "normalization"),
        now: this.now
      });
    } catch (error) {
      await deletePetAssets({
        targetDir: runDir,
        allowedRoot: this.developerPreviewsRoot
      }).catch(() => undefined);
      throw error;
    }
    const presetsById = new Map(result.report.presets.map((preset) => [preset.id, preset]));
    this.developerPreview = {
      runDir,
      contactSheetPath: result.contactSheetPath,
      previews: result.report.previews.map((preview) => {
        const preset = presetsById.get(preview.presetId);
        return {
          presetId: preview.presetId,
          title: preset?.title ?? preview.presetId,
          currentDefault: preset?.currentDefault ?? false,
          previewPath: join(outputDir, preview.path),
          metrics: preview.metrics
        };
      })
    };
    this.lastError = null;
    return {
      presetIds: this.developerPreview.previews.map((preview) => preview.presetId),
      previewCount: this.developerPreview.previews.length
    };
  }

  async createReview(): Promise<ReviewFlowResult> {
    if (!this.draft) {
      throw this.setError(new GuidedPetFlowError("DRAFT_BUNDLE_REQUIRED", "Generate a pet bundle before QA."));
    }
    if (this.review) {
      await deletePetAssets({
        targetDir: this.review.runDir,
        allowedRoot: this.reviewsRoot
      });
      this.review = null;
    }
    const reviewRunDir = join(this.reviewsRoot, this.draft.runId);
    const result = await createPetReview({
      bundleDir: this.draft.bundleDir,
      reviewDir: reviewRunDir,
      now: this.now
    });
    this.review = {
      runDir: reviewRunDir,
      reportPath: join(reviewRunDir, "review.json"),
      previewPath: join(reviewRunDir, result.report.artifacts.preview),
      contactSheetPath: join(reviewRunDir, result.report.artifacts.contactSheet),
      checks: result.report.qa.checks.map((check) => check.id)
    };
    this.status = "needs_review";
    this.lastError = null;
    return {
      reportPath: this.review.reportPath,
      previewPath: this.review.previewPath,
      contactSheetPath: this.review.contactSheetPath
    };
  }

  async acceptPet(): Promise<AcceptFlowResult> {
    if (!this.draft) {
      throw this.setError(new GuidedPetFlowError("DRAFT_BUNDLE_REQUIRED", "Generate a pet bundle before accepting."));
    }
    const result = await this.acceptCurrentDraftBundle();
    this.accepted = {
      installedBundleDir: result.installedBundleDir,
      petId: result.installation.bundle.id,
      petName: result.installation.bundle.name
    };
    this.status = "accepted";
    this.lastError = null;
    return this.accepted;
  }

  private async acceptCurrentDraftBundle(): Promise<Awaited<ReturnType<typeof acceptPetBundle>>> {
    if (!this.draft) {
      throw this.setError(new GuidedPetFlowError("DRAFT_BUNDLE_REQUIRED", "Generate a pet bundle before accepting."));
    }
    try {
      return await acceptPetBundle({
        bundleDir: this.draft.bundleDir,
        libraryDir: this.libraryRoot,
        now: this.now
      });
    } catch (error) {
      if (!(error instanceof PetReviewError) || error.code !== "INSTALLATION_ALREADY_EXISTS") {
        throw error;
      }
    }

    await deletePetAssets({
      targetDir: join(this.libraryRoot, this.draft.petId),
      allowedRoot: this.libraryRoot
    });
    return acceptPetBundle({
      bundleDir: this.draft.bundleDir,
      libraryDir: this.libraryRoot,
      now: this.now
    });
  }

  async launchPet(options: LaunchFlowOptions = {}): Promise<LaunchFlowResult> {
    if (!this.accepted) {
      throw this.setError(new GuidedPetFlowError("ACCEPTED_BUNDLE_REQUIRED", "Accept a pet before launching."));
    }
    const smokeResult = options.smoke ? await this.runRuntimeSmoke(this.accepted.installedBundleDir) : undefined;
    let running = false;
    if (!options.smoke) {
      await this.stopRuntimeProcess();
      await this.launchRuntimeProcess(this.accepted.installedBundleDir);
      running = true;
    }
    this.launch = {
      launched: true,
      running,
      smokeResult
    };
    this.status = "launched";
    this.lastError = null;
    return {
      launched: true,
      smokeResult
    };
  }

  async stopPet(): Promise<StopFlowResult> {
    const stopped = await this.stopRuntimeProcess();
    if (!this.runtimeProcess) {
      this.launch = null;
    }
    this.status = this.runtimeProcess ? "launched" : this.statusAfterRuntimeStops();
    this.lastError = null;
    return { stopped };
  }

  async deleteDraftAssets(options: { clearSourceImage?: boolean } = {}): Promise<DeleteFlowResult> {
    let deleted = false;
    if (await this.deleteDeveloperPreviewAssets()) {
      deleted = true;
    }
    if (this.review) {
      await deletePetAssets({
        targetDir: this.review.runDir,
        allowedRoot: this.reviewsRoot
      });
      this.review = null;
      deleted = true;
    }
    if (this.draft) {
      await deletePetAssets({
        targetDir: this.draft.runDir,
        allowedRoot: this.draftsRoot
      });
      this.draft = null;
      deleted = true;
    }
    if (!this.runtimeProcess) {
      this.launch = null;
    }
    if (deleted && options.clearSourceImage !== false) {
      this.clearSourceImageSelection();
    }
    this.status = this.runtimeProcess ? "launched" : this.statusAfterRuntimeStops();
    this.lastError = null;
    return { deleted };
  }

  async deleteAcceptedPet(): Promise<DeleteFlowResult> {
    if (!this.accepted) {
      return { deleted: false };
    }
    await this.stopRuntimeProcess();
    await deletePetAssets({
      targetDir: this.accepted.installedBundleDir,
      allowedRoot: this.libraryRoot
    });
    this.accepted = null;
    this.launch = null;
    this.clearSourceImageSelection();
    this.status = this.draft ? "generated" : this.sourceImagePath ? "source_selected" : "idle";
    this.lastError = null;
    return { deleted: true };
  }

  getPublicState(): PublicGuidedPetState {
    return {
      status: this.status,
      sourceImageName: this.sourceImageName,
      petId: this.draft?.petId ?? this.accepted?.petId ?? null,
      petName: this.draft?.petName ?? this.accepted?.petName ?? null,
      review: this.review
        ? {
            previewUrl: pathToFileURL(this.review.previewPath).href,
            contactSheetUrl: pathToFileURL(this.review.contactSheetPath).href,
            checks: this.review.checks
          }
        : null,
      developerPreview: this.developerPreview
        ? {
            contactSheetUrl: pathToFileURL(this.developerPreview.contactSheetPath).href,
            previews: this.developerPreview.previews.map((preview) => ({
              presetId: preview.presetId,
              title: preview.title,
              currentDefault: preview.currentDefault,
              previewUrl: pathToFileURL(preview.previewPath).href,
              metrics: preview.metrics
            }))
          }
        : null,
      accepted: this.accepted
        ? {
            petId: this.accepted.petId,
            petName: this.accepted.petName
          }
        : null,
      launch: this.launch,
      generation: {
        mode: this.generationSettings.mode,
        providerId: this.generationSettings.mode === "local" ? null : this.generationSettings.providerId,
        cloudUploadConfirmed:
          this.generationSettings.mode !== "local" && this.generationSettings.confirmCloudUpload,
        cloudProviderConfigured: this.isCloudProviderConfigured(),
        liveProviderEnabled: this.isLiveProviderEnabled()
      },
      actions: {
        canGenerate: Boolean(this.sourceImagePath) && !this.runtimeProcess && this.canGenerateWithCurrentSettings(),
        canCreateDeveloperPreview: Boolean(this.sourceImagePath) && !this.runtimeProcess,
        canReview: Boolean(this.draft) && !this.runtimeProcess,
        canAccept: Boolean(this.draft) && !this.runtimeProcess,
        canLaunch: Boolean(this.accepted) && !this.runtimeProcess,
        canStopLaunch: Boolean(this.runtimeProcess),
        canDeleteDraft: Boolean(this.draft || this.review || this.developerPreview),
        canDeleteAccepted: Boolean(this.accepted)
      },
      lastError: this.lastError
    };
  }

  private createRunId(): string {
    this.runCounter += 1;
    const stamp = (this.now ?? new Date()).toISOString().replaceAll(/[^0-9]/g, "").slice(0, 14);
    return `run-${stamp}-${this.runCounter}`;
  }

  private statusAfterRuntimeStops(): GuidedPetFlowStatus {
    return this.accepted ? "accepted" : this.sourceImagePath ? "source_selected" : "idle";
  }

  private clearSourceImageSelection(): void {
    this.sourceImagePath = null;
    this.sourceImageName = null;
    this.generationSettings = {
      ...this.generationSettings,
      confirmCloudUpload: false
    };
  }

  private async deleteDeveloperPreviewAssets(): Promise<boolean> {
    if (!this.developerPreview) {
      return false;
    }
    await deletePetAssets({
      targetDir: this.developerPreview.runDir,
      allowedRoot: this.developerPreviewsRoot
    });
    this.developerPreview = null;
    return true;
  }

  private createGenerationAdapter(): PetGenerationAdapter | undefined {
    if (this.generationSettings.mode === "local") {
      return undefined;
    }
    if (this.generationSettings.mode === "openai_live") {
      this.assertOpenAiLiveEnabled();
      return createCloudImageAdapter({
        confirmCloudUpload: this.generationSettings.confirmCloudUpload,
        config: {
          providerId: this.generationSettings.providerId,
          apiKey: this.env.OPENAI_API_KEY
        },
        provider: createOpenAiImageProvider({
          apiKey: this.env.OPENAI_API_KEY ?? "",
          endpoint: resolveOpenAiImageEndpoint(this.env),
          model: this.env.DOUDOU_OPENAI_IMAGE_MODEL ?? this.env.OPENAI_MODEL,
          fetch: this.openAiFetch
        })
      });
    }
    return createCloudImageAdapter({
      confirmCloudUpload: this.generationSettings.confirmCloudUpload,
      config: {
        providerId: this.generationSettings.providerId,
        apiKey: this.env.DOUDOU_MOCK_CLOUD_API_KEY
      },
      provider: createMockCloudImageProvider()
    });
  }

  private canGenerateWithCurrentSettings(): boolean {
    if (this.generationSettings.mode === "local") {
      return true;
    }
    return this.generationSettings.confirmCloudUpload && this.isCloudProviderConfigured();
  }

  private isCloudProviderConfigured(): boolean {
    if (this.generationSettings.mode === "local") {
      return false;
    }
    if (this.generationSettings.mode === "mock_cloud") {
      return this.generationSettings.providerId === "mock-provider" && Boolean(this.env.DOUDOU_MOCK_CLOUD_API_KEY);
    }
    return (
      this.generationSettings.providerId === "openai-image" &&
      this.isOpenAiLiveEnabled() &&
      Boolean(this.env.OPENAI_API_KEY)
    );
  }

  private isLiveProviderEnabled(): boolean {
    return this.generationSettings.mode === "openai_live" && this.isOpenAiLiveEnabled();
  }

  private isOpenAiLiveEnabled(): boolean {
    return this.env.DOUDOU_ENABLE_OPENAI_LIVE === "1";
  }

  private assertOpenAiLiveEnabled(): void {
    if (!this.isOpenAiLiveEnabled()) {
      throw this.setError(
        new GuidedPetFlowError(
          "LIVE_PROVIDER_NOT_ENABLED",
          "OpenAI live generation requires DOUDOU_ENABLE_OPENAI_LIVE=1 and explicit upload confirmation."
        )
      );
    }
  }

  private async runRuntimeSmoke(bundleDir: string): Promise<RuntimeSmokeResult> {
    const output = await this.spawnRuntime(bundleDir, true);
    const smokeLine = output.split(/\r?\n/).find((line) => line.startsWith("runtime smoke: "));
    if (!smokeLine) {
      throw this.setError(
        new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", "Runtime smoke did not return structured evidence.")
      );
    }
    return JSON.parse(smokeLine.slice("runtime smoke: ".length)) as RuntimeSmokeResult;
  }

  private spawnRuntime(bundleDir: string, smoke: true): Promise<string>;
  private spawnRuntime(bundleDir: string, smoke: false): ChildProcess;
  private spawnRuntime(bundleDir: string, smoke: boolean): ChildProcess | Promise<string> {
    if (!this.runtimeMainPath) {
      throw this.setError(new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", "Runtime entrypoint is not configured."));
    }
    const args = [this.runtimeMainPath, "--bundle", bundleDir];
    if (smoke) {
      args.push("--smoke");
      return new Promise((resolvePromise, reject) => {
        const child = spawn(this.runtimeElectronPath, args, {
          env: { ...process.env, NODE_OPTIONS: "" },
          stdio: ["ignore", "pipe", "pipe"]
        });
        let output = "";
        const timeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(this.setError(new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", `Runtime smoke timed out.\n${output}`)));
        }, 15000);
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
          clearTimeout(timeout);
          if (code !== 0) {
            reject(
              this.setError(new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", `Runtime exited ${code}.\n${output}`))
            );
            return;
          }
          resolvePromise(output);
        });
      });
    }

    return spawn(this.runtimeElectronPath, args, {
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: "ignore"
    });
  }

  private launchRuntimeProcess(bundleDir: string): Promise<ChildProcess> {
    if (!this.runtimeMainPath) {
      throw this.setError(new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", "Runtime entrypoint is not configured."));
    }
    const child = spawn(this.runtimeElectronPath, [this.runtimeMainPath, "--bundle", bundleDir, "--ready-signal"], {
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.runtimeProcess = child;

    return new Promise((resolvePromise, reject) => {
      let settled = false;
      let bufferedOutput = "";
      const timeout = setTimeout(() => {
        fail("Runtime did not report readiness before timeout.");
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
        }
      }, this.runtimeReadyTimeoutMs);

      const cleanup = (): void => {
        clearTimeout(timeout);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
      };

      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolvePromise(child);
      };

      const fail = (message: string): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (this.runtimeProcess === child) {
          this.runtimeProcess = null;
        }
        reject(this.setError(new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", message)));
      };

      function onData(chunk: Buffer): void {
        bufferedOutput += chunk.toString();
        const lines = bufferedOutput.split(/\r?\n/);
        bufferedOutput = lines.pop() ?? "";
        if (lines.some((line) => line === "runtime ready: renderer")) {
          finish();
        }
      }

      const onError = (error: Error): void => {
        if (!settled) {
          fail(error.message);
          return;
        }
        if (this.runtimeProcess === child) {
          this.runtimeProcess = null;
          this.launch = null;
          this.status = this.statusAfterRuntimeStops();
          this.setError(new GuidedPetFlowError("RUNTIME_LAUNCH_FAILED", error.message));
        }
      };

      const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
        if (!settled) {
          fail(`Runtime exited before renderer readiness (${code === null ? signal ?? "unknown" : `code ${code}`}).`);
          return;
        }
        if (this.runtimeProcess === child) {
          this.runtimeProcess = null;
          if (this.launch?.running) {
            this.launch = null;
            this.status = this.statusAfterRuntimeStops();
          }
        }
      };

      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.once("error", onError);
      child.once("close", onClose);
    });
  }

  private async stopRuntimeProcess(): Promise<boolean> {
    const child = this.runtimeProcess;
    if (!child) {
      return false;
    }
    this.runtimeProcess = null;
    if (child.exitCode !== null || child.signalCode !== null) {
      return false;
    }

    return new Promise<boolean>((resolvePromise, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, 3000);
      child.once("close", () => {
        clearTimeout(timeout);
        resolvePromise(true);
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(this.setError(new GuidedPetFlowError("RUNTIME_STOP_FAILED", error.message)));
      });
      if (!child.kill("SIGTERM")) {
        clearTimeout(timeout);
        resolvePromise(false);
      }
    });
  }

  private setError<T extends Error & { code?: string }>(error: T): T {
    this.lastError = {
      code: error.code ?? error.name,
      message: error.message
    };
    return error;
  }
}

function normalizeGenerationMode(mode: GuidedGenerationSettings["mode"] | undefined): GuidedGenerationMode {
  if (mode === "mock_cloud" || mode === "openai_live") {
    return mode;
  }
  return "local";
}

function providerIdForMode(mode: GuidedGenerationMode): GuidedCloudProviderId {
  return mode === "openai_live" ? "openai-image" : "mock-provider";
}

function resolveOpenAiImageEndpoint(env: NodeJS.ProcessEnv): string | undefined {
  if (env.DOUDOU_OPENAI_IMAGE_ENDPOINT) {
    return env.DOUDOU_OPENAI_IMAGE_ENDPOINT;
  }
  const baseUrl = env.DOUDOU_OPENAI_BASE_URL ?? env.OPENAI_BASE_URL;
  if (!baseUrl) {
    return undefined;
  }
  return `${baseUrl.replace(/\/+$/, "")}/images/edits`;
}
