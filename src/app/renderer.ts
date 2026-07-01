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
  sourceName.textContent = state.sourceImageName ?? "未选择图片";
  statusLine.textContent = errorMessage ?? statusText(state);
  renderGenerationSettings(state);
  renderActions(state);
  renderSteps(state);
  renderDeveloperPreview(state);
  renderReview(state);
}

function renderGenerationSettings(state: PublicGuidedPetState): void {
  generationMode.value = state.generation.mode;
  providerName.textContent = providerDisplayName(state.generation.providerId);
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
    const previewTitle = previewTitleText(preview.presetId, preview.title);
    caption.textContent = preview.currentDefault ? `${previewTitle}（默认）` : previewTitle;
    const image = document.createElement("img");
    image.src = preview.previewUrl;
    image.alt = `${previewTitle}本地风格预览`;
    figure.append(caption, image);
    developerPreviewList.append(figure);
  }
}

function providerDisplayName(providerId: string | null): string {
  if (providerId === "mock-provider") {
    return "模拟云提供方";
  }
  if (providerId === "openai-image") {
    return "OpenAI 图像提供方";
  }
  return "无";
}

function providerStatusText(state: PublicGuidedPetState): string {
  if (state.generation.mode === "local") {
    return "未使用";
  }
  if (state.generation.mode === "openai_live" && !state.generation.liveProviderEnabled) {
    return "实时模式未启用";
  }
  return state.generation.cloudProviderConfigured ? "已配置" : "缺少配置";
}

function previewTitleText(presetId: string, fallbackTitle: string): string {
  switch (presetId) {
    case "balanced":
      return "平衡风格";
    case "soft_mask":
      return "柔和蒙版";
    case "bold_edges":
      return "粗边线";
    default:
      return fallbackTitle ? "自定义风格" : "未命名风格";
  }
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
    item.textContent = qaCheckText(check);
    qaChecks.append(item);
  }
}

function statusText(state: PublicGuidedPetState): string {
  if (state.lastError) {
    return localizedActionErrorMessage(state.lastError.code, state.lastError.message);
  }
  if (state.launch?.running) {
    return "已启动";
  }
  if (state.launch?.launched) {
    return "已启动";
  }
  switch (state.status) {
    case "source_selected":
      return "已选择源图";
    case "generated":
      return "已生成";
    case "needs_review":
      return "待检查";
    case "accepted":
      return "已接受";
    default:
      return "空闲";
  }
}

function qaCheckText(checkId: string): string {
  switch (checkId) {
    case "bundle-valid":
      return "资源包校验通过";
    case "preview-png":
      return "预览图有效";
    case "atlas-contact-sheet":
      return "精灵图集已生成";
    case "privacy-source-not-stored":
      return "未保存源图";
    case "source-metadata-sanitized":
      return "源图元数据已脱敏";
    default:
      return "质量检查通过";
  }
}

function localizedActionErrorMessage(code: string, fallbackMessage: string): string {
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
    DELETE_TARGET_NOT_DIRECTORY: "删除目标必须是目录。",
    PET_BUNDLE_INVALID: "桌宠资源包校验失败。",
    UNKNOWN_ERROR: "未知错误。"
  };
  return messages[code] ?? (fallbackMessage ? "操作失败，请查看日志。" : "未知错误。");
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
