import type {
  AppActionResult,
  GuidedAppSmokeResult
} from "./app-types.js";
import type { GuidedGenerationMode, PublicGuidedPetState } from "./guided-flow.js";

const sourceName = query("#source-name");
const statusLine = query("#status-line");
const qaChecks = query("#qa-checks");
const developerPreviewContactSheetImage = queryImage("#developer-preview-contact-sheet");
const developerPreviewList = query("#developer-preview-list");
const previewImage = queryImage("#preview-image");
const contactSheetImage = queryImage("#contact-sheet-image");
const generationMode = querySelect("#generation-mode");
const providerName = query("#provider-name");
const providerStatus = query("#provider-status");
const cloudConfirm = queryInput("#cloud-confirm");
const selectButton = queryButton("#select-source");
const developerPreviewButton = queryButton("#developer-preview");
const generateButton = queryButton("#generate-pet");
const qaButton = queryButton("#qa-pet");
const acceptButton = queryButton("#accept-pet");
const launchButton = queryButton("#launch-pet");
const stopButton = queryButton("#stop-pet");
const deleteDraftButton = queryButton("#delete-draft");
const deleteAcceptedButton = queryButton("#delete-accepted");
const stepItems = [...document.querySelectorAll<HTMLElement>("[data-step]")];

let currentState = await window.doudouApp.getState();
let busy = false;
let lastActionError: AppActionResult<unknown>["error"] | null = null;
render(currentState);

generationMode.addEventListener("change", () => {
  void updateGenerationSettings();
});
cloudConfirm.addEventListener("change", () => {
  void updateGenerationSettings();
});
selectButton.addEventListener("click", () => runAction(() => window.doudouApp.selectSourceImage()));
developerPreviewButton.addEventListener("click", () => runAction(() => window.doudouApp.createDeveloperPreview()));
generateButton.addEventListener("click", () => runAction(() => window.doudouApp.generatePet()));
qaButton.addEventListener("click", () => runAction(() => window.doudouApp.createReview()));
acceptButton.addEventListener("click", () => runAction(() => window.doudouApp.acceptPet()));
launchButton.addEventListener("click", () => runAction(() => window.doudouApp.launchPet()));
stopButton.addEventListener("click", () => runAction(() => window.doudouApp.stopPet()));
deleteDraftButton.addEventListener("click", () => runAction(() => window.doudouApp.deleteDraftAssets()));
deleteAcceptedButton.addEventListener("click", () => runAction(() => window.doudouApp.deleteAcceptedPet()));

const smokeConfig = await window.doudouApp.getSmokeConfig();
if (smokeConfig.enabled) {
  void runSmokeFlow();
}

async function runAction<T>(action: () => Promise<AppActionResult<T>>): Promise<AppActionResult<T>> {
  busy = true;
  lastActionError = null;
  render(currentState);
  const result = await action();
  currentState = result.state;
  lastActionError = result.error ?? null;
  busy = false;
  render(currentState, result.error?.message);
  return result;
}

async function updateGenerationSettings(): Promise<void> {
  const mode = readGenerationMode(generationMode.value);
  const settings = {
    mode,
    providerId: mode === "openai_live" ? "openai-image" as const : "mock-provider" as const,
    confirmCloudUpload: isCloudGenerationMode(mode) && cloudConfirm.checked
  };
  const result = await runAction(() =>
    window.doudouApp.setGenerationSettings(settings)
  );
  currentState = result.state;
  render(currentState, result.error?.message);
}

function render(state: PublicGuidedPetState, errorMessage?: string): void {
  sourceName.textContent = state.sourceImageName ?? "No image selected";
  statusLine.textContent = errorMessage ?? statusText(state);
  renderGenerationSettings(state);
  renderActions(state);
  renderSteps(state);
  renderDeveloperPreview(state);
  renderReview(state);
}

function renderGenerationSettings(state: PublicGuidedPetState): void {
  generationMode.value = state.generation.mode;
  providerName.textContent = state.generation.providerId ?? "none";
  cloudConfirm.checked = state.generation.cloudUploadConfirmed;
  cloudConfirm.disabled = busy || !isCloudGenerationMode(state.generation.mode);
  providerStatus.textContent = providerStatusText(state);
  providerStatus.classList.toggle("ready", state.generation.cloudProviderConfigured);
  providerStatus.classList.toggle(
    "blocked",
    state.generation.mode === "openai_live" && !state.generation.liveProviderEnabled
  );
}

function renderActions(state: PublicGuidedPetState): void {
  selectButton.disabled = busy;
  developerPreviewButton.disabled = busy || !state.actions.canCreateDeveloperPreview;
  generateButton.disabled = busy || !state.actions.canGenerate;
  qaButton.disabled = busy || !state.actions.canReview;
  acceptButton.disabled = busy || !state.actions.canAccept;
  launchButton.disabled = busy || !state.actions.canLaunch;
  stopButton.disabled = busy || !state.actions.canStopLaunch;
  deleteDraftButton.disabled = busy || !state.actions.canDeleteDraft;
  deleteAcceptedButton.disabled = busy || !state.actions.canDeleteAccepted;
}

function renderDeveloperPreview(state: PublicGuidedPetState): void {
  developerPreviewList.replaceChildren();
  if (!state.developerPreview) {
    developerPreviewContactSheetImage.removeAttribute("src");
    return;
  }
  developerPreviewContactSheetImage.src = state.developerPreview.contactSheetUrl;
  for (const preview of state.developerPreview.previews) {
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption");
    caption.textContent = preview.currentDefault ? `${preview.title} (default)` : preview.title;
    const image = document.createElement("img");
    image.src = preview.previewUrl;
    image.alt = `${preview.title} local stylizer preview`;
    figure.append(caption, image);
    developerPreviewList.append(figure);
  }
}

function providerStatusText(state: PublicGuidedPetState): string {
  if (state.generation.mode === "local") {
    return "Not used";
  }
  if (state.generation.mode === "openai_live" && !state.generation.liveProviderEnabled) {
    return "Live disabled";
  }
  return state.generation.cloudProviderConfigured ? "Configured" : "Missing config";
}

function renderSteps(state: PublicGuidedPetState): void {
  const active = new Set<string>();
  if (state.sourceImageName) {
    active.add("source");
  }
  if (state.petId) {
    active.add("generated");
  }
  if (state.review) {
    active.add("review");
  }
  if (state.accepted) {
    active.add("accepted");
  }
  if (state.launch?.launched) {
    active.add("launched");
  }
  for (const item of stepItems) {
    item.classList.toggle("active", active.has(item.dataset.step ?? ""));
  }
}

function renderReview(state: PublicGuidedPetState): void {
  qaChecks.replaceChildren();
  if (!state.review) {
    previewImage.removeAttribute("src");
    contactSheetImage.removeAttribute("src");
    return;
  }
  previewImage.src = state.review.previewUrl;
  contactSheetImage.src = state.review.contactSheetUrl;
  for (const check of state.review.checks) {
    const item = document.createElement("li");
    item.textContent = check;
    qaChecks.append(item);
  }
}

function statusText(state: PublicGuidedPetState): string {
  if (state.lastError) {
    return state.lastError.message;
  }
  if (state.launch?.running) {
    return "Launched";
  }
  if (state.launch?.launched) {
    return "Launched";
  }
  switch (state.status) {
    case "source_selected":
      return "Source selected";
    case "generated":
      return "Generated";
    case "needs_review":
      return "Needs review";
    case "accepted":
      return "Accepted";
    default:
      return "Idle";
  }
}

async function runSmokeFlow(): Promise<void> {
  const smokeResult: GuidedAppSmokeResult = {
    sourceSelected: false,
    generated: false,
    reviewed: false,
    previewLoaded: false,
    contactSheetLoaded: false,
    developerPreviewed: false,
    developerPreviewContactSheetLoaded: false,
    developerPreviewPreviewsLoaded: false,
    accepted: false,
    launched: false,
    generationMode: null,
    petId: null,
    cloudGenerated: false,
    deletedDraft: false,
    deletedAccepted: false,
    finalStatus: currentState.status
  };

  try {
    generationMode.value = smokeConfig.generationMode;
    cloudConfirm.checked = true;
    await updateGenerationSettings();
    smokeResult.generationMode = currentState.generation.mode;

    const selected = await clickAndWait(selectButton, () => currentState.sourceImageName !== null);
    assertSmokeAction("select source", selected);
    smokeResult.sourceSelected = selected.ok && currentState.sourceImageName !== null;

    const developerPreviewed = await clickAndWait(
      developerPreviewButton,
      () => currentState.developerPreview !== null
    );
    assertSmokeAction("developer preview", developerPreviewed);
    smokeResult.developerPreviewed =
      developerPreviewed.ok && currentState.developerPreview?.previews.length === 3;
    smokeResult.developerPreviewContactSheetLoaded = await waitForImage(developerPreviewContactSheetImage, 768, 256);
    smokeResult.developerPreviewPreviewsLoaded = await waitForDeveloperPreviewImages();

    const generated = await clickAndWait(generateButton, () => currentState.petId !== null);
    assertSmokeAction("generate", generated);
    smokeResult.generated = generated.ok && currentState.petId === "generated_cloud_pet";
    smokeResult.petId = currentState.petId;
    smokeResult.cloudGenerated = isCloudGenerationMode(currentState.generation.mode);

    const reviewed = await clickAndWait(qaButton, () => currentState.review !== null);
    assertSmokeAction("QA", reviewed);
    smokeResult.reviewed = reviewed.ok && currentState.review !== null;
    smokeResult.previewLoaded = await waitForImage(previewImage, 256, 256);
    smokeResult.contactSheetLoaded = await waitForImage(contactSheetImage, 1024, 512);

    const accepted = await clickAndWait(acceptButton, () => currentState.accepted !== null);
    assertSmokeAction("accept", accepted);
    smokeResult.accepted = accepted.ok && currentState.accepted?.petId === "generated_cloud_pet";

    const launched = await clickAndWait(launchButton, () => currentState.launch?.launched === true);
    assertSmokeAction("launch", launched);
    smokeResult.launched = launched.ok && currentState.launch?.launched === true;
    smokeResult.runtimeSmoke = currentState.launch?.smokeResult;

    const draftDeleted = await clickAndWait(deleteDraftButton, () => !currentState.actions.canDeleteDraft);
    assertSmokeAction("delete draft", draftDeleted);
    smokeResult.deletedDraft = draftDeleted.ok && !currentState.actions.canDeleteDraft;

    const acceptedDeleted = await clickAndWait(deleteAcceptedButton, () => currentState.accepted === null);
    assertSmokeAction("delete accepted", acceptedDeleted);
    smokeResult.deletedAccepted = acceptedDeleted.ok && currentState.accepted === null;
  } catch (error) {
    smokeResult.error = currentState.lastError ?? lastActionError ?? {
      code: error instanceof Error ? error.name : "SMOKE_ERROR",
      message: error instanceof Error ? error.message : "Smoke flow failed."
    };
  }
  smokeResult.finalStatus = currentState.status;

  window.doudouApp.reportSmokeResult(smokeResult);
}

function assertSmokeAction(actionName: string, result: AppActionResult<unknown>): void {
  if (result.ok) {
    return;
  }
  throw new Error(result.error?.message ?? `Smoke ${actionName} action failed.`);
}

async function clickAndWait(
  button: HTMLButtonElement,
  predicate: () => boolean
): Promise<AppActionResult<unknown>> {
  if (button.disabled) {
    return {
      ok: false,
      state: currentState,
      error: currentState.lastError ?? {
        code: "SMOKE_ACTION_DISABLED",
        message: `Smoke action ${button.id} is disabled.`
      }
    };
  }
  const completion = waitFor(predicate);
  button.click();
  return completion;
}

async function waitFor(predicate: () => boolean): Promise<AppActionResult<unknown>> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (predicate()) {
      return { ok: true, state: currentState };
    }
    if (currentState.lastError) {
      return {
        ok: false,
        state: currentState,
        error: currentState.lastError
      };
    }
    if (lastActionError) {
      return {
        ok: false,
        state: currentState,
        error: lastActionError
      };
    }
    await delay(25);
  }
  return {
    ok: false,
    state: currentState,
    error: {
      code: "SMOKE_TIMEOUT",
      message: "Smoke predicate timed out."
    }
  };
}

async function waitForImage(image: HTMLImageElement, width: number, height: number): Promise<boolean> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (image.complete && image.naturalWidth === width && image.naturalHeight === height) {
      return true;
    }
    await delay(25);
  }
  return false;
}

async function waitForDeveloperPreviewImages(): Promise<boolean> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const images = [...developerPreviewList.querySelectorAll<HTMLImageElement>("img")];
    if (
      images.length === 3 &&
      images.every((image) => image.complete && image.naturalWidth === 256 && image.naturalHeight === 256)
    ) {
      return true;
    }
    await delay(25);
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readGenerationMode(value: string): GuidedGenerationMode {
  if (value === "mock_cloud" || value === "openai_live") {
    return value;
  }
  return "local";
}

function isCloudGenerationMode(mode: GuidedGenerationMode): boolean {
  return mode === "mock_cloud" || mode === "openai_live";
}

function query(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Missing element ${selector}.`);
  }
  return element;
}

function queryButton(selector: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button) {
    throw new Error(`Missing button ${selector}.`);
  }
  return button;
}

function querySelect(selector: string): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>(selector);
  if (!select) {
    throw new Error(`Missing select ${selector}.`);
  }
  return select;
}

function queryInput(selector: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`Missing input ${selector}.`);
  }
  return input;
}

function queryImage(selector: string): HTMLImageElement {
  const image = document.querySelector<HTMLImageElement>(selector);
  if (!image) {
    throw new Error(`Missing image ${selector}.`);
  }
  return image;
}
