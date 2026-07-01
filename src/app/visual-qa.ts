import type { BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface GuidedAppVisualQaIssue {
  selector: string;
  label: string;
  kind: string;
  detail: string;
}

export interface GuidedAppVisualQaReport {
  viewport: {
    width: number;
    height: number;
    documentWidth: number;
    documentHeight: number;
  };
  checked: string[];
  issues: GuidedAppVisualQaIssue[];
  screenshotPath?: string;
}

export async function runGuidedAppVisualQa(
  window: BrowserWindow,
  outputDir?: string
): Promise<GuidedAppVisualQaReport> {
  await waitForVisualQaRendererReady(window);
  await window.webContents.executeJavaScript(buildVisualQaScenarioScript());
  await delay(100);
  const screenshotPath = await captureVisualQaScreenshot(window, outputDir);
  const report = await window.webContents.executeJavaScript(buildVisualQaCheckScript()) as GuidedAppVisualQaReport;
  if (screenshotPath) {
    report.screenshotPath = screenshotPath;
  }
  return report;
}

async function waitForVisualQaRendererReady(window: BrowserWindow): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await window.webContents.executeJavaScript(`
      document.querySelector("#generate-pet")?.disabled === true &&
      document.querySelector("#select-source")?.disabled === false &&
      document.querySelector("#status-line")?.textContent === "空闲"
    `) as boolean;
    if (ready) {
      return;
    }
    await delay(50);
  }
  throw new Error("Visual QA renderer did not reach the initial idle state.");
}

async function captureVisualQaScreenshot(window: BrowserWindow, outputDir?: string): Promise<string | undefined> {
  if (!outputDir) {
    return undefined;
  }
  const resolvedOutputDir = resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const screenshotPath = join(resolvedOutputDir, "guided-app-zh-visual-qa.png");
  const image = await window.webContents.capturePage();
  await writeFile(screenshotPath, image.toPNG());
  return screenshotPath;
}

function buildVisualQaScenarioScript(): string {
  return `
(() => {
  const imageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  document.querySelector("#source-name").textContent = "超长中文源图片文件名-用于检查省略和按钮间距-2026-07-01-头像素材.png";
  document.querySelector("#status-line").textContent = "OpenAI 实时生成尚未启用，请先配置环境变量并勾选上传确认。源图片路径必须指向文件，请重新选择一张本地 PNG 或 JPEG 图片。";
  document.querySelector("#generation-mode").value = "openai_live";
  document.querySelector("#provider-name").textContent = "OpenAI 图像提供方";
  const providerStatus = document.querySelector("#provider-status");
  providerStatus.textContent = "实时模式未启用";
  providerStatus.className = "blocked";
  document.querySelector("#cloud-confirm").checked = true;
  const qaChecks = document.querySelector("#qa-checks");
  qaChecks.replaceChildren();
  for (const text of ["资源包校验通过", "预览图有效", "精灵图集已生成", "未保存源图", "源图元数据已脱敏"]) {
    const item = document.createElement("li");
    item.textContent = text;
    qaChecks.append(item);
  }
  const styleList = document.querySelector("#developer-preview-list");
  styleList.replaceChildren();
  for (const text of ["平衡风格（默认）", "柔和蒙版", "粗边线"]) {
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption");
    const image = document.createElement("img");
    caption.textContent = text;
    image.src = imageData;
    figure.append(caption, image);
    styleList.append(figure);
  }
  for (const selector of ["#developer-preview-contact-sheet", "#preview-image", "#contact-sheet-image"]) {
    document.querySelector(selector).src = imageData;
  }
  return true;
})()
`;
}

function buildVisualQaCheckScript(): string {
  return `
(() => {
  const issues = [];
  const checked = [];
  const tolerance = 1;

  function addIssue(selector, label, kind, detail) {
    issues.push({ selector, label, kind, detail });
  }

  function visible(element) {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function checkElement(selector, label, options = {}) {
    const element = document.querySelector(selector);
    checked.push(label);
    if (!element) {
      addIssue(selector, label, "missing", "element was not found");
      return;
    }
    if (!visible(element)) {
      addIssue(selector, label, "hidden", "element is not visible");
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      addIssue(selector, label, "empty-rect", "element has no visible box");
    }
    if (!options.allowScrollWidth && element.scrollWidth > element.clientWidth + tolerance) {
      addIssue(selector, label, "horizontal-overflow", "scrollWidth " + element.scrollWidth + " exceeds clientWidth " + element.clientWidth);
    }
    if (!options.allowScrollHeight && element.scrollHeight > element.clientHeight + tolerance) {
      addIssue(selector, label, "vertical-overflow", "scrollHeight " + element.scrollHeight + " exceeds clientHeight " + element.clientHeight);
    }
    if (rect.left < -tolerance || rect.right > window.innerWidth + tolerance) {
      addIssue(selector, label, "viewport-overflow", "element box extends outside viewport width");
    }
  }

  if (document.documentElement.scrollWidth > window.innerWidth + tolerance) {
    addIssue("document", "页面", "horizontal-overflow", "document width " + document.documentElement.scrollWidth + " exceeds viewport " + window.innerWidth);
  }

  for (const button of document.querySelectorAll("button")) {
    checkElement("#" + button.id, button.textContent.trim() + "按钮");
  }
  checkElement("#status-line", "状态栏错误提示");
  checkElement(".confirm-row span", "云端上传确认文案");
  checkElement("#provider-status", "提供方状态标签");

  for (const item of document.querySelectorAll(".steps li")) {
    checkElement('[data-step="' + item.dataset.step + '"]', item.textContent.trim() + "步骤");
  }
  for (const [index, item] of [...document.querySelectorAll("#qa-checks li")].entries()) {
    checkElement("#qa-checks li:nth-child(" + (index + 1) + ")", item.textContent.trim() + "质量检查项");
  }
  for (const [index, item] of [...document.querySelectorAll(".style-preview-list figcaption")].entries()) {
    checkElement(".style-preview-list figure:nth-child(" + (index + 1) + ") figcaption", item.textContent.trim() + "风格标题");
  }

  const sourceName = document.querySelector("#source-name");
  const selectButton = document.querySelector("#select-source");
  checked.push("源图文件名与选择按钮间距");
  if (sourceName && selectButton) {
    const sourceRect = sourceName.getBoundingClientRect();
    const buttonRect = selectButton.getBoundingClientRect();
    if (sourceRect.right > buttonRect.left - tolerance) {
      addIssue(".source-row", "源图文件名与选择按钮间距", "overlap", "source filename touches or overlaps select button");
    }
  }

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight
    },
    checked,
    issues
  };
})()
`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
