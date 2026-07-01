import { PNG } from "pngjs";
import type {
  GeneratedPetAdapterOutput,
  GeneratedPetFrame,
  PetGenerationAdapter,
  PetGenerationRequest
} from "./types.js";

type Rgb = [number, number, number];

export interface DeterministicStylizerParams {
  crop: {
    visibleBoundsPaddingPx: number;
  };
  mask: {
    headRadiusX: number;
    headRadiusY: number;
    bodyRadiusX: number;
    bodyRadiusY: number;
    edgeFeather: number;
    outlineRadiusPx: number;
  };
  color: {
    saturation: number;
    contrast: number;
    brightness: number;
    posterizeStep: number;
  };
  edge: {
    weakThreshold: number;
    strongThreshold: number;
    weakMix: number;
    strongMix: number;
    weakColor: Rgb;
    strongColor: Rgb;
  };
}

export type DeterministicStylizerParamsInput = {
  [Section in keyof DeterministicStylizerParams]?: Partial<DeterministicStylizerParams[Section]>;
};

export interface CreateDeterministicStylizedPngAdapterOptions {
  params?: DeterministicStylizerParamsInput;
}

interface SourceSampler {
  source: PNG;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

const CANVAS_SIZE = 256;

export const DEFAULT_DETERMINISTIC_STYLIZER_PARAMS: DeterministicStylizerParams = {
  crop: {
    visibleBoundsPaddingPx: 18
  },
  mask: {
    headRadiusX: 92,
    headRadiusY: 88,
    bodyRadiusX: 74,
    bodyRadiusY: 52,
    edgeFeather: 0.1,
    outlineRadiusPx: 4
  },
  color: {
    saturation: 1.55,
    contrast: 1.16,
    brightness: 0,
    posterizeStep: 24
  },
  edge: {
    weakThreshold: 18,
    strongThreshold: 24,
    weakMix: 0.48,
    strongMix: 0.88,
    weakColor: [42, 51, 72],
    strongColor: [25, 32, 48]
  }
};

export function createDeterministicStylizedPngAdapter(
  options: CreateDeterministicStylizedPngAdapterOptions = {}
): PetGenerationAdapter {
  const adapterId = "deterministic-stylized-png-adapter";
  const adapterVersion = "0.1.0";
  const params = resolveDeterministicStylizerParams(options.params);
  return {
    id: adapterId,
    version: adapterVersion,
    requiresNormalizedSourceImage: true,
    async generate(request: PetGenerationRequest): Promise<GeneratedPetAdapterOutput> {
      if (!request.normalizedSourceImage) {
        throw new Error("Deterministic stylization requires a normalized source image.");
      }

      const source = readNormalizedSource(request.normalizedSourceImage.bytes);
      const sticker = createStylizedSticker(source, params);
      const frames = createFrames(sticker);
      const previewFrame = frames.find((frame) => frame.index === 1) ?? frames[0];
      return {
        adapterId,
        adapterVersion,
        petId: "generated_local_pet",
        petName: "Generated Local Pet",
        previewFrameIndex: previewFrame?.index ?? 0,
        previewPng: previewFrame?.png ?? frames[0]!.png,
        frames
      };
    }
  };
}

export function resolveDeterministicStylizerParams(
  input: DeterministicStylizerParamsInput = {}
): DeterministicStylizerParams {
  return {
    crop: {
      ...DEFAULT_DETERMINISTIC_STYLIZER_PARAMS.crop,
      ...input.crop
    },
    mask: {
      ...DEFAULT_DETERMINISTIC_STYLIZER_PARAMS.mask,
      ...input.mask
    },
    color: {
      ...DEFAULT_DETERMINISTIC_STYLIZER_PARAMS.color,
      ...input.color
    },
    edge: {
      ...DEFAULT_DETERMINISTIC_STYLIZER_PARAMS.edge,
      ...input.edge
    }
  };
}

function readNormalizedSource(bytes: Buffer): PNG {
  const source = PNG.sync.read(bytes);
  if (source.width !== CANVAS_SIZE || source.height !== CANVAS_SIZE) {
    throw new Error("Deterministic stylization expects a 256x256 normalized source image.");
  }
  return source;
}

function createFrames(sticker: PNG): GeneratedPetFrame[] {
  return Array.from({ length: 8 }, (_value, frameIndex) => ({
    index: frameIndex,
    role: frameIndex >= 4 ? "tap_react" as const : "idle" as const,
    png: renderFrame(sticker, frameIndex)
  }));
}

function createStylizedSticker(source: PNG, params: DeterministicStylizerParams): PNG {
  const sticker = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  const sampler = createSourceSampler(source, params.crop);

  for (let y = 0; y < sticker.height; y += 1) {
    for (let x = 0; x < sticker.width; x += 1) {
      const mask = characterMaskCoverage(x, y, params.mask);
      if (mask > 0) {
        const color = stylizedColorAt(sampler, x, y, params.color, params.edge);
        if (color.alpha > 0) {
          blendPixel(sticker, x, y, color.rgb, Math.round(color.alpha * mask));
        }
        continue;
      }

      const outlineAlpha = outlineCoverage(x, y, params.mask);
      if (outlineAlpha > 0) {
        blendPixel(sticker, x, y, [28, 38, 60], outlineAlpha);
      }
    }
  }

  return sticker;
}

function renderFrame(sticker: PNG, frameIndex: number): Buffer {
  const frame = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  const bounceOffsets = [0, -2, -4, -2, -3, -7, -4, -1];
  const offsetY = bounceOffsets[frameIndex] ?? 0;
  const react = frameIndex >= 4;
  const offsetX = react ? (frameIndex % 2 === 0 ? -2 : 2) : 0;

  fillEllipse(frame, 128 + offsetX, 226, 58 - Math.abs(offsetY), 7, [28, 38, 60], 54);
  blit(sticker, frame, offsetX, offsetY);

  if (react) {
    fillDiamond(frame, 68, 54 + Math.max(offsetY, -4), 9, [255, 226, 95], 235);
    fillDiamond(frame, 188, 58 + Math.max(offsetY, -4), 7, [255, 226, 95], 225);
    fillCircle(frame, 128 + offsetX, 210 + offsetY, 7, [255, 255, 255], 125);
  }

  return PNG.sync.write(frame);
}

function stylizedColorAt(
  sampler: SourceSampler,
  x: number,
  y: number,
  colorParams: DeterministicStylizerParams["color"],
  edgeParams: DeterministicStylizerParams["edge"]
): { rgb: Rgb; alpha: number } {
  const sourcePoint = mapCanvasToSource(sampler, x, y);
  const blurred = blurredRgbaAt(sampler.source, sourcePoint.x, sourcePoint.y);
  if (blurred.alpha <= 0) {
    return { rgb: [0, 0, 0], alpha: 0 };
  }

  let rgb = posterize(boostSaturation(blurred.rgb, colorParams), colorParams.posterizeStep);
  const edge = edgeStrength(sampler.source, sourcePoint.x, sourcePoint.y);
  if (edge > edgeParams.strongThreshold) {
    rgb = mixRgb(rgb, edgeParams.strongColor, edgeParams.strongMix);
  } else if (edge > edgeParams.weakThreshold) {
    rgb = mixRgb(rgb, edgeParams.weakColor, edgeParams.weakMix);
  }

  return {
    rgb,
    alpha: Math.min(250, blurred.alpha + 8)
  };
}

function createSourceSampler(source: PNG, cropParams: DeterministicStylizerParams["crop"]): SourceSampler {
  return {
    source,
    bounds: expandBounds(findVisibleBounds(source), cropParams.visibleBoundsPaddingPx, source)
  };
}

function findVisibleBounds(source: PNG): SourceSampler["bounds"] {
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (source.width * y + x) << 2;
      if ((source.data[index + 3] ?? 0) <= 0) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: source.width - 1,
      maxY: source.height - 1
    };
  }

  return { minX, minY, maxX, maxY };
}

function expandBounds(
  bounds: SourceSampler["bounds"],
  paddingPx: number,
  source: PNG
): SourceSampler["bounds"] {
  const padding = Math.max(0, Math.round(paddingPx));
  return {
    minX: clampInt(bounds.minX - padding, 0, source.width - 1),
    minY: clampInt(bounds.minY - padding, 0, source.height - 1),
    maxX: clampInt(bounds.maxX + padding, 0, source.width - 1),
    maxY: clampInt(bounds.maxY + padding, 0, source.height - 1)
  };
}

function mapCanvasToSource(sampler: SourceSampler, x: number, y: number): { x: number; y: number } {
  const width = sampler.bounds.maxX - sampler.bounds.minX;
  const height = sampler.bounds.maxY - sampler.bounds.minY;
  return {
    x: clampInt(sampler.bounds.minX + (x / (CANVAS_SIZE - 1)) * width, 0, sampler.source.width - 1),
    y: clampInt(sampler.bounds.minY + (y / (CANVAS_SIZE - 1)) * height, 0, sampler.source.height - 1)
  };
}

function blurredRgbaAt(source: PNG, x: number, y: number): { rgb: Rgb; alpha: number } {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let weight = 0;

  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      const sx = clampInt(xx, 0, source.width - 1);
      const sy = clampInt(yy, 0, source.height - 1);
      const index = (source.width * sy + sx) << 2;
      const sampleAlpha = source.data[index + 3] ?? 0;
      const sampleWeight = sampleAlpha / 255;
      red += (source.data[index] ?? 0) * sampleWeight;
      green += (source.data[index + 1] ?? 0) * sampleWeight;
      blue += (source.data[index + 2] ?? 0) * sampleWeight;
      alpha += sampleAlpha;
      weight += sampleWeight;
    }
  }

  if (weight === 0) {
    return { rgb: [0, 0, 0], alpha: 0 };
  }

  return {
    rgb: [
      clampChannel(red / weight),
      clampChannel(green / weight),
      clampChannel(blue / weight)
    ],
    alpha: clampChannel(alpha / 9)
  };
}

function boostSaturation(rgb: Rgb, colorParams: DeterministicStylizerParams["color"]): Rgb {
  const gray = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
  return [
    stylizeChannel(gray + (rgb[0] - gray) * colorParams.saturation, colorParams),
    stylizeChannel(gray + (rgb[1] - gray) * colorParams.saturation, colorParams),
    stylizeChannel(gray + (rgb[2] - gray) * colorParams.saturation, colorParams)
  ];
}

function stylizeChannel(value: number, colorParams: DeterministicStylizerParams["color"]): number {
  return clampChannel(128 + (value - 128) * colorParams.contrast + colorParams.brightness);
}

function posterize(rgb: Rgb, step: number): Rgb {
  const safeStep = Math.max(1, Math.round(step));
  return rgb.map((channel) => clampChannel(Math.round(channel / safeStep) * safeStep)) as Rgb;
}

function edgeStrength(source: PNG, x: number, y: number): number {
  const left = luminanceAt(source, x - 1, y);
  const right = luminanceAt(source, x + 1, y);
  const top = luminanceAt(source, x, y - 1);
  const bottom = luminanceAt(source, x, y + 1);
  return Math.abs(right - left) + Math.abs(bottom - top);
}

function luminanceAt(source: PNG, x: number, y: number): number {
  const sx = clampInt(x, 0, source.width - 1);
  const sy = clampInt(y, 0, source.height - 1);
  const index = (source.width * sy + sx) << 2;
  return (
    (source.data[index] ?? 0) * 0.299 +
    (source.data[index + 1] ?? 0) * 0.587 +
    (source.data[index + 2] ?? 0) * 0.114
  );
}

function characterMaskCoverage(x: number, y: number, maskParams: DeterministicStylizerParams["mask"]): number {
  const head = ellipseDistance(x, y, 128, 110, maskParams.headRadiusX, maskParams.headRadiusY);
  const body = ellipseDistance(x, y, 128, 184, maskParams.bodyRadiusX, maskParams.bodyRadiusY);
  const distance = Math.min(head, body);
  if (distance <= 0.96) {
    return 1;
  }
  const outerDistance = 0.96 + Math.max(0.01, maskParams.edgeFeather);
  if (distance <= outerDistance) {
    return (outerDistance - distance) / Math.max(0.01, maskParams.edgeFeather);
  }
  return 0;
}

function outlineCoverage(x: number, y: number, maskParams: DeterministicStylizerParams["mask"]): number {
  if (characterMaskCoverage(x, y, maskParams) > 0) {
    return 0;
  }
  const outlineRadius = Math.max(0, Math.round(maskParams.outlineRadiusPx));
  for (let radius = 1; radius <= outlineRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius) {
          continue;
        }
        if (characterMaskCoverage(x + dx, y + dy, maskParams) > 0.4) {
          return 220 - radius * 44;
        }
      }
    }
  }
  return 0;
}

function ellipseDistance(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number): number {
  const dx = (x - centerX) / radiusX;
  const dy = (y - centerY) / radiusY;
  return dx * dx + dy * dy;
}

function blit(source: PNG, target: PNG, offsetX: number, offsetY: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (source.width * y + x) << 2;
      const alpha = source.data[sourceIndex + 3] ?? 0;
      if (alpha === 0) {
        continue;
      }
      blendPixel(target, x + offsetX, y + offsetY, [
        source.data[sourceIndex] ?? 0,
        source.data[sourceIndex + 1] ?? 0,
        source.data[sourceIndex + 2] ?? 0
      ], alpha);
    }
  }
}

function fillEllipse(
  png: PNG,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  rgb: Rgb,
  alpha: number
): void {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
      if (ellipseDistance(x, y, centerX, centerY, radiusX, radiusY) <= 1) {
        blendPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillCircle(png: PNG, centerX: number, centerY: number, radius: number, rgb: Rgb, alpha: number): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        blendPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillDiamond(png: PNG, centerX: number, centerY: number, radius: number, rgb: Rgb, alpha: number): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (Math.abs(x - centerX) + Math.abs(y - centerY) <= radius) {
        blendPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function blendPixel(png: PNG, x: number, y: number, rgb: Rgb, alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || alpha <= 0) {
    return;
  }
  const index = (png.width * y + x) << 2;
  const sourceAlpha = clampChannel(alpha) / 255;
  const targetAlpha = (png.data[index + 3] ?? 0) / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) {
    return;
  }
  png.data[index] = blendChannel(rgb[0], png.data[index] ?? 0, sourceAlpha, targetAlpha, outputAlpha);
  png.data[index + 1] = blendChannel(rgb[1], png.data[index + 1] ?? 0, sourceAlpha, targetAlpha, outputAlpha);
  png.data[index + 2] = blendChannel(rgb[2], png.data[index + 2] ?? 0, sourceAlpha, targetAlpha, outputAlpha);
  png.data[index + 3] = clampChannel(outputAlpha * 255);
}

function blendChannel(
  sourceChannel: number,
  targetChannel: number,
  sourceAlpha: number,
  targetAlpha: number,
  outputAlpha: number
): number {
  return clampChannel(
    (sourceChannel * sourceAlpha + targetChannel * targetAlpha * (1 - sourceAlpha)) / outputAlpha
  );
}

function mixRgb(base: Rgb, overlay: Rgb, amount: number): Rgb {
  return [
    clampChannel(base[0] * (1 - amount) + overlay[0] * amount),
    clampChannel(base[1] * (1 - amount) + overlay[1] * amount),
    clampChannel(base[2] * (1 - amount) + overlay[2] * amount)
  ];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
