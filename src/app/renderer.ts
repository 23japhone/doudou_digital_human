import type {
  AppActionResult,
  GuidedAppSmokeResult
} from "./app-types.js";
import type { PublicGuidedPetState } from "./guided-flow.js";

const sourceName = query("#source-name");
const statusLine = query("#status-line");
const qaChecks = query("#qa-checks");
const previewImage = queryImage("#preview-image");
const contactSheetImage = queryImage("#contact-sheet-image");
const selectButton = queryButton("#select-source");
const generateButton = queryButton("#generate-pet");
const qaButton = queryButton("#qa-pet");
const acceptButton = queryButton("#accept-pet");
const launchButton = queryButton("#launch-pet");
const deleteDraftButton = queryButton("#delete-draft");
const deleteAcceptedButton = queryButton("#delete-accepted");
const stepItems = [...document.querySelectorAll<HTMLElement>("[data-step]")];

let currentState = await window.doudouApp.getState();
let busy = false;
render(currentState);

selectButton.addEventListener("click", () => runAction(() => window.doudouApp.selectSourceImage()));
generateButton.addEventListener("click", () => runAction(() => window.doudouApp.generatePet()));
qaButton.addEventListener("click", () => runAction(() => window.doudouApp.createReview()));
acceptButton.addEventListener("click", () => runAction(() => window.doudouApp.acceptPet()));
launchButton.addEventListener("click", () => runAction(() => window.doudouApp.launchPet()));
deleteDraftButton.addEventListener("click", () => runAction(() => window.doudouApp.deleteDraftAssets()));
deleteAcceptedButton.addEventListener("click", () => runAction(() => window.doudouApp.deleteAcceptedPet()));

const smokeConfig = await window.doudouApp.getSmokeConfig();
if (smokeConfig.enabled) {
  void runSmokeFlow();
}

async function runAction<T>(action: () => Promise<AppActionResult<T>>): Promise<AppActionResult<T>> {
  busy = true;
  render(currentState);
  const result = await action();
  currentState = result.state;
  busy = false;
  render(currentState, result.error?.message);
  return result;
}

function render(state: PublicGuidedPetState, errorMessage?: string): void {
  sourceName.textContent = state.sourceImageName ?? "No image selected";
  statusLine.textContent = errorMessage ?? statusText(state);
  renderActions(state);
  renderSteps(state);
  renderReview(state);
}

function renderActions(state: PublicGuidedPetState): void {
  selectButton.disabled = busy;
  generateButton.disabled = busy || !state.actions.canGenerate;
  qaButton.disabled = busy || !state.actions.canReview;
  acceptButton.disabled = busy || !state.actions.canAccept;
  launchButton.disabled = busy || !state.actions.canLaunch;
  deleteDraftButton.disabled = busy || !state.actions.canDeleteDraft;
  deleteAcceptedButton.disabled = busy || !state.actions.canDeleteAccepted;
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
    accepted: false,
    launched: false,
    deletedDraft: false,
    deletedAccepted: false,
    finalStatus: currentState.status
  };

  const selected = await clickAndWait(selectButton, () => currentState.sourceImageName !== null);
  smokeResult.sourceSelected = selected.ok && currentState.sourceImageName !== null;

  const generated = await clickAndWait(generateButton, () => currentState.petId !== null);
  smokeResult.generated = generated.ok && currentState.petId === "generated_local_pet";

  const reviewed = await clickAndWait(qaButton, () => currentState.review !== null);
  smokeResult.reviewed = reviewed.ok && currentState.review !== null;
  smokeResult.previewLoaded = await waitForImage(previewImage, 256, 256);
  smokeResult.contactSheetLoaded = await waitForImage(contactSheetImage, 1024, 512);

  const accepted = await clickAndWait(acceptButton, () => currentState.accepted !== null);
  smokeResult.accepted = accepted.ok && currentState.accepted?.petId === "generated_local_pet";

  const launched = await clickAndWait(launchButton, () => currentState.launch?.launched === true);
  smokeResult.launched = launched.ok && currentState.launch?.launched === true;
  smokeResult.runtimeSmoke = currentState.launch?.smokeResult;

  const draftDeleted = await clickAndWait(deleteDraftButton, () => !currentState.actions.canDeleteDraft);
  smokeResult.deletedDraft = draftDeleted.ok && !currentState.actions.canDeleteDraft;

  const acceptedDeleted = await clickAndWait(deleteAcceptedButton, () => currentState.accepted === null);
  smokeResult.deletedAccepted = acceptedDeleted.ok && currentState.accepted === null;
  smokeResult.finalStatus = currentState.status;

  window.doudouApp.reportSmokeResult(smokeResult);
}

async function clickAndWait(
  button: HTMLButtonElement,
  predicate: () => boolean
): Promise<AppActionResult<unknown>> {
  if (button.disabled) {
    throw new Error(`Smoke action ${button.id} is disabled.`);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

function queryImage(selector: string): HTMLImageElement {
  const image = document.querySelector<HTMLImageElement>(selector);
  if (!image) {
    throw new Error(`Missing image ${selector}.`);
  }
  return image;
}
