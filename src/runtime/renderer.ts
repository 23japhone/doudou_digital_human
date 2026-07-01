import { createAnimationPlayer } from "./animation.js";
import type { PetAtlas } from "../pet_bundle/manifest.js";
import type { RuntimeBundle, RuntimeSmokeResult } from "./runtime-types.js";
import { isPointInsideRuntimeHitArea, type CanvasAlphaSampler } from "./hit-area.js";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#pet-canvas");
if (!canvas) {
  throw new Error("Missing pet canvas.");
}

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Unable to create 2D canvas context.");
}
const petCanvas: HTMLCanvasElement = canvas;
const drawingContext: CanvasRenderingContext2D = context;

const bundle = await window.petRuntime.getBundle();
console.log(`pet renderer: loaded bundle ${bundle.manifest.id}`);
const player = createAnimationPlayer(bundle.manifest);
const atlasImages = await loadAtlases(bundle);
console.log(`pet renderer: loaded ${atlasImages.size} atlas image(s)`);
const canvasAlphaSampler: CanvasAlphaSampler = {
  get width() {
    return petCanvas.width;
  },
  get height() {
    return petCanvas.height;
  },
  alphaAt: (x, y) => {
    try {
      return drawingContext.getImageData(x, y, 1, 1).data[3] ?? 0;
    } catch {
      return null;
    }
  }
};
let lastTimestamp = performance.now();
let drawCount = 0;
let initialFrameIndex: number | null = null;
let currentFrameIndex = -1;
let smokeResultReported = false;

petCanvas.width = bundle.manifest.canvas.width;
petCanvas.height = bundle.manifest.canvas.height;

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.petRuntime.quit();
  }
});

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.petRuntime.showContextMenu();
});

window.addEventListener("mousemove", (event) => {
  window.petRuntime.setIgnoreMouseEvents(!isInsidePetHitArea(event.offsetX, event.offsetY, bundle));
});

petCanvas.addEventListener("pointerdown", (event) => {
  if (isInsidePetHitArea(event.offsetX, event.offsetY, bundle)) {
    player.tap();
  }
});

function render(timestamp: number): void {
  const deltaMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  player.advance(deltaMs);
  drawCurrentFrame();
  reportSmokeResultIfReady();
  requestAnimationFrame(render);
}

function drawCurrentFrame(): void {
  const animation = bundle.manifest.animations[player.currentAnimationName()];
  const atlas = bundle.manifest.assets.atlases.find((candidate) => candidate.id === animation.atlas);
  if (!atlas) {
    return;
  }
  const image = atlasImages.get(atlas.id);
  if (!image) {
    return;
  }

  const frame = player.currentFrame();
  const sourceX = (frame.index % atlas.columns) * atlas.frameWidth;
  const sourceY = Math.floor(frame.index / atlas.columns) * atlas.frameHeight;

  drawingContext.clearRect(0, 0, petCanvas.width, petCanvas.height);
  drawingContext.drawImage(
    image,
    sourceX,
    sourceY,
    atlas.frameWidth,
    atlas.frameHeight,
    0,
    0,
    bundle.manifest.canvas.width,
    bundle.manifest.canvas.height
  );
  recordDraw(frame.index);
}

function recordDraw(frameIndex: number): void {
  if (initialFrameIndex === null) {
    initialFrameIndex = frameIndex;
  }
  currentFrameIndex = frameIndex;
  drawCount += 1;
}

function isInsidePetHitArea(x: number, y: number, runtimeBundle: RuntimeBundle): boolean {
  return isPointInsideRuntimeHitArea(x, y, runtimeBundle.manifest.hitArea, canvasAlphaSampler);
}

async function loadAtlases(runtimeBundle: RuntimeBundle): Promise<Map<string, HTMLImageElement>> {
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    runtimeBundle.manifest.assets.atlases.map(async (atlas) => {
      const image = await loadImage(atlas, runtimeBundle);
      images.set(atlas.id, image);
    })
  );
  return images;
}

function loadImage(atlas: PetAtlas, runtimeBundle: RuntimeBundle): Promise<HTMLImageElement> {
  const atlasRef = runtimeBundle.atlases.find((candidate) => candidate.id === atlas.id);
  if (!atlasRef) {
    throw new Error(`Missing runtime URL for atlas ${atlas.id}`);
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load atlas ${atlas.id} from ${atlasRef.url}`));
    image.src = atlasRef.url;
  });
}

drawCurrentFrame();
window.petRuntime.rendererReady();
requestAnimationFrame(render);

function reportSmokeResultIfReady(): void {
  if (smokeResultReported || initialFrameIndex === null) {
    return;
  }
  const renderLoopAdvanced = drawCount >= 2 && currentFrameIndex !== initialFrameIndex;
  if (!renderLoopAdvanced) {
    return;
  }
  smokeResultReported = true;
  window.petRuntime.reportSmokeResult(createSmokeResult(renderLoopAdvanced));
}

function createSmokeResult(renderLoopAdvanced: boolean): RuntimeSmokeResult {
  return {
    atlasLoaded: atlasImages.size === bundle.manifest.assets.atlases.length,
    bundleLoaded: bundle.manifest.schemaVersion.startsWith("0.1."),
    idleAdvanced: renderLoopAdvanced,
    nonTransparentPixel: canvasHasNonTransparentPixel(),
    renderLoopAdvanced,
    drawCount,
    initialFrameIndex: initialFrameIndex ?? -1,
    currentFrameIndex
  };
}

function canvasHasNonTransparentPixel(): boolean {
  const imageData = drawingContext.getImageData(0, 0, petCanvas.width, petCanvas.height);
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] > 0) {
      return true;
    }
  }
  return false;
}
