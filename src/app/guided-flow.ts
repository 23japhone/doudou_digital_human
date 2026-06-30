import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generatePetBundleFromSource } from "../generation/generate-pet.js";
import {
  createCloudImageAdapter,
  createMockCloudImageProvider
} from "../generation/adapters/cloud-image-adapter.js";
import { createOpenAiImageProvider } from "../generation/adapters/openai-image-provider.js";
import type { PetGenerationAdapter } from "../generation/adapters/types.js";
import {
  acceptPetBundle,
  createPetReview,
  deletePetAssets
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
  | "RUNTIME_LAUNCH_FAILED";

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
  accepted: {
    petId: string;
    petName: string;
  } | null;
  launch: {
    launched: boolean;
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
    canReview: boolean;
    canAccept: boolean;
    canLaunch: boolean;
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

interface AcceptedState {
  installedBundleDir: string;
  petId: string;
  petName: string;
}

export class GuidedPetFlow {
  private readonly workspaceDir: string;
  private readonly draftsRoot: string;
  private readonly reviewsRoot: string;
  private readonly libraryRoot: string;
  private readonly now?: Date;
  private readonly runtimeElectronPath: string;
  private readonly runtimeMainPath?: string;
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
  private accepted: AcceptedState | null = null;
  private launch: PublicGuidedPetState["launch"] = null;
  private lastError: PublicGuidedPetState["lastError"] = null;
  private runCounter = 0;

  constructor(options: GuidedPetFlowOptions) {
    this.workspaceDir = resolve(options.workspaceDir);
    this.draftsRoot = join(this.workspaceDir, "drafts");
    this.reviewsRoot = join(this.workspaceDir, "reviews");
    this.libraryRoot = join(this.workspaceDir, "library");
    this.now = options.now;
    this.runtimeElectronPath = options.runtimeElectronPath ?? process.execPath;
    this.runtimeMainPath = options.runtimeMainPath;
    this.env = options.env ?? process.env;
    this.openAiFetch = options.openAiFetch;
  }

  async initialize(): Promise<void> {
    await mkdir(this.draftsRoot, { recursive: true });
    await mkdir(this.reviewsRoot, { recursive: true });
    await mkdir(this.libraryRoot, { recursive: true });
  }

  async setSourceImagePath(sourceImagePath: string): Promise<SelectSourceImageResult> {
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
    const adapter = this.createGenerationAdapter();
    adapter?.preflight?.();
    if (this.draft) {
      await this.deleteDraftAssets();
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
    const result = await acceptPetBundle({
      bundleDir: this.draft.bundleDir,
      libraryDir: this.libraryRoot,
      now: this.now
    });
    this.accepted = {
      installedBundleDir: result.installedBundleDir,
      petId: result.installation.bundle.id,
      petName: result.installation.bundle.name
    };
    this.status = "accepted";
    this.lastError = null;
    return this.accepted;
  }

  async launchPet(options: LaunchFlowOptions = {}): Promise<LaunchFlowResult> {
    if (!this.accepted) {
      throw this.setError(new GuidedPetFlowError("ACCEPTED_BUNDLE_REQUIRED", "Accept a pet before launching."));
    }
    const smokeResult = options.smoke ? await this.runRuntimeSmoke(this.accepted.installedBundleDir) : undefined;
    if (!options.smoke) {
      this.spawnRuntime(this.accepted.installedBundleDir, false);
    }
    this.launch = {
      launched: true,
      smokeResult
    };
    this.status = "launched";
    this.lastError = null;
    return {
      launched: true,
      smokeResult
    };
  }

  async deleteDraftAssets(): Promise<DeleteFlowResult> {
    let deleted = false;
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
    this.launch = null;
    this.status = this.accepted ? "accepted" : this.sourceImagePath ? "source_selected" : "idle";
    this.lastError = null;
    return { deleted };
  }

  async deleteAcceptedPet(): Promise<DeleteFlowResult> {
    if (!this.accepted) {
      return { deleted: false };
    }
    await deletePetAssets({
      targetDir: this.accepted.installedBundleDir,
      allowedRoot: this.libraryRoot
    });
    this.accepted = null;
    this.launch = null;
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
        canGenerate: Boolean(this.sourceImagePath) && this.canGenerateWithCurrentSettings(),
        canReview: Boolean(this.draft),
        canAccept: Boolean(this.draft),
        canLaunch: Boolean(this.accepted),
        canDeleteDraft: Boolean(this.draft || this.review),
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
          endpoint: this.env.DOUDOU_OPENAI_IMAGE_ENDPOINT,
          model: this.env.DOUDOU_OPENAI_IMAGE_MODEL,
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

  private spawnRuntime(bundleDir: string, smoke: false): string;
  private spawnRuntime(bundleDir: string, smoke: true): Promise<string>;
  private spawnRuntime(bundleDir: string, smoke: boolean): string | Promise<string> {
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

    const child = spawn(this.runtimeElectronPath, args, {
      detached: true,
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: "ignore"
    });
    child.unref();
    return "";
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
