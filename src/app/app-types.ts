import type { RuntimeSmokeResult } from "../runtime/runtime-types.js";
import type {
  PublicGuidedPetState,
  AcceptFlowResult,
  DeleteFlowResult,
  GenerateFlowResult,
  GuidedGenerationSettings,
  LaunchFlowResult,
  ReviewFlowResult,
  SelectSourceImageResult
} from "./guided-flow.js";

export interface AppActionResult<T = unknown> {
  ok: boolean;
  state: PublicGuidedPetState;
  result?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface GuidedAppSmokeConfig {
  enabled: boolean;
}

export interface GuidedAppSmokeResult {
  sourceSelected: boolean;
  generated: boolean;
  reviewed: boolean;
  previewLoaded: boolean;
  contactSheetLoaded: boolean;
  accepted: boolean;
  launched: boolean;
  runtimeSmoke?: RuntimeSmokeResult;
  generationMode: string | null;
  petId: string | null;
  cloudGenerated: boolean;
  deletedDraft: boolean;
  deletedAccepted: boolean;
  finalStatus: string;
}

export interface DoudouAppBridge {
  getState(): Promise<PublicGuidedPetState>;
  setGenerationSettings(settings: GuidedGenerationSettings): Promise<AppActionResult<PublicGuidedPetState>>;
  selectSourceImage(): Promise<AppActionResult<SelectSourceImageResult>>;
  generatePet(): Promise<AppActionResult<GenerateFlowResult>>;
  createReview(): Promise<AppActionResult<ReviewFlowResult>>;
  acceptPet(): Promise<AppActionResult<AcceptFlowResult>>;
  launchPet(): Promise<AppActionResult<LaunchFlowResult>>;
  deleteDraftAssets(): Promise<AppActionResult<DeleteFlowResult>>;
  deleteAcceptedPet(): Promise<AppActionResult<DeleteFlowResult>>;
  getSmokeConfig(): Promise<GuidedAppSmokeConfig>;
  reportSmokeResult(result: GuidedAppSmokeResult): void;
}
