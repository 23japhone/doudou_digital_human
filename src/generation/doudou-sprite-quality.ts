import { PNG } from "pngjs";
import { DEFAULT_DOUDOU_CHARACTER_PROFILE } from "./doudou-sprite.js";

type Rgb = readonly [number, number, number];

export interface DoudouSpriteQualityIssue {
  code:
    | "atlas_dimensions"
    | "distinct_frames"
    | "hair_readability"
    | "skin_readability"
    | "outfit_readability"
    | "collar_readability"
    | "ribbon_readability"
    | "no_animal_ears"
    | "blink_expression"
    | "surprised_expression"
    | "pout_expression"
    | "teary_expression"
    | "working_expression";
  frameIndex?: number;
  message: string;
  actual?: number;
  expected?: string;
}

export interface DoudouSpriteQualityReport {
  ok: boolean;
  issues: DoudouSpriteQualityIssue[];
}

export class DoudouSpriteQualityError extends Error {
  readonly issues: DoudouSpriteQualityIssue[];

  constructor(issues: DoudouSpriteQualityIssue[]) {
    super(`Doudou sprite atlas failed quality checks: ${issues.map((issue) => issue.code).join(", ")}`);
    this.name = "DoudouSpriteQualityError";
    this.issues = issues;
  }
}

const palette = DEFAULT_DOUDOU_CHARACTER_PROFILE.palette;

export function analyzeDoudouSpriteAtlasQuality(atlas: PNG): DoudouSpriteQualityReport {
  const issues: DoudouSpriteQualityIssue[] = [];
  if (atlas.width !== 1024 || atlas.height !== 512) {
    issues.push({
      code: "atlas_dimensions",
      message: "Doudou sprite atlas must be a 4x2 grid of 256px frames.",
      actual: atlas.width * atlas.height,
      expected: "1024x512"
    });
    return { ok: false, issues };
  }

  const signatures = Array.from({ length: 8 }, (_unused, frameIndex) => frameSignature(atlas, frameIndex));
  if (new Set(signatures).size !== 8) {
    issues.push({
      code: "distinct_frames",
      message: "Doudou sprite atlas must contain eight visually distinct frames.",
      actual: new Set(signatures).size,
      expected: "8"
    });
  }

  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    const frame = framePng(atlas, frameIndex);
    const smallFrame = downscaleNearest(frame, 128, 128);
    requireMetric(
      issues,
      frameIndex,
      "hair_readability",
      countApproxColor(frame, palette.hairMain) + countApproxColor(frame, palette.hairShade),
      6600,
      "Brown hair and long side locks must remain readable at 256px."
    );
    requireMetric(
      issues,
      frameIndex,
      "skin_readability",
      countApproxColor(frame, palette.skin),
      2800,
      "Face and hands must remain readable at 256px."
    );
    requireMetric(
      issues,
      frameIndex,
      "outfit_readability",
      countApproxColor(frame, palette.cardigan),
      1600,
      "Yellow cardigan must remain readable at 256px."
    );
    requireMetric(
      issues,
      frameIndex,
      "collar_readability",
      countApproxColor(frame, palette.sailor),
      600,
      "Dark sailor collar and skirt must remain readable at 256px."
    );
    requireMetric(
      issues,
      frameIndex,
      "ribbon_readability",
      countApproxColor(frame, palette.ribbon),
      180,
      "Red hair ribbons must remain readable at 256px."
    );
    requireMetric(
      issues,
      frameIndex,
      "hair_readability",
      countApproxColor(smallFrame, palette.hairMain) + countApproxColor(smallFrame, palette.hairShade),
      1450,
      "Brown hair and long side locks must remain readable at 128px."
    );
    requireMetric(
      issues,
      frameIndex,
      "skin_readability",
      countApproxColor(smallFrame, palette.skin),
      650,
      "Face and hands must remain readable at 128px."
    );
    requireMetric(
      issues,
      frameIndex,
      "outfit_readability",
      countApproxColor(smallFrame, palette.cardigan),
      390,
      "Yellow cardigan must remain readable at 128px."
    );
    requireMetric(
      issues,
      frameIndex,
      "collar_readability",
      countApproxColor(smallFrame, palette.sailor),
      145,
      "Dark sailor collar and skirt must remain readable at 128px."
    );
    requireMetric(
      issues,
      frameIndex,
      "ribbon_readability",
      countApproxColor(smallFrame, palette.ribbon),
      35,
      "Red hair ribbons must remain readable at 128px."
    );
    if (pixelAt(frame, 68, 96)[3] !== 0 || pixelAt(frame, 188, 96)[3] !== 0) {
      issues.push({
        code: "no_animal_ears",
        frameIndex,
        message: "Default Doudou must not render animal-ear silhouettes at the ear sentinel points."
      });
    }
  }

  analyzeCoreExpressions(atlas, issues);
  return { ok: issues.length === 0, issues };
}

export function assertDoudouSpriteAtlasQuality(atlas: PNG): void {
  const report = analyzeDoudouSpriteAtlasQuality(atlas);
  if (!report.ok) {
    throw new DoudouSpriteQualityError(report.issues);
  }
}

function analyzeCoreExpressions(atlas: PNG, issues: DoudouSpriteQualityIssue[]): void {
  const idleFrame = framePng(atlas, 1);
  const blinkFrame = framePng(atlas, 2);
  const surprisedFrame = framePng(atlas, 4);
  const poutFrame = framePng(atlas, 5);
  const tearyFrame = framePng(atlas, 6);
  const workingFrame = framePng(atlas, 7);
  const idleEyePixels = countApproxColor(idleFrame, palette.eye, 12, { x: 100, y: 116, width: 56, height: 16 });
  const blinkEyePixels = countApproxColor(blinkFrame, palette.eye, 12, { x: 100, y: 116, width: 56, height: 16 });
  if (blinkEyePixels >= idleEyePixels * 0.7) {
    issues.push({
      code: "blink_expression",
      frameIndex: 2,
      message: "Blink frame must visibly reduce open-eye pixels.",
      actual: blinkEyePixels,
      expected: `< ${Math.floor(idleEyePixels * 0.7)}`
    });
  }
  requireMetric(
    issues,
    4,
    "surprised_expression",
    countApproxColor(surprisedFrame, palette.eye, 12, { x: 118, y: 140, width: 22, height: 24 }),
    110,
    "Surprised frame must have a readable open mouth."
  );
  requireMetric(
    issues,
    5,
    "pout_expression",
    countApproxColor(poutFrame, palette.eye, 12, { x: 108, y: 143, width: 40, height: 14 }),
    95,
    "Pout frame must have a readable flat mouth strip."
  );
  const poutOpenPixels = countApproxColor(poutFrame, palette.eye, 12, { x: 120, y: 150, width: 18, height: 18 });
  if (poutOpenPixels >= 55) {
    issues.push({
      code: "pout_expression",
      frameIndex: 5,
      message: "Pout frame must not read as an open surprised mouth.",
      actual: poutOpenPixels,
      expected: "< 55"
    });
  }
  requireMetric(
    issues,
    6,
    "teary_expression",
    countApproxColor(tearyFrame, palette.tear, 12),
    35,
    "Teary frame must show readable blue tear pixels."
  );
  requireMetric(
    issues,
    7,
    "working_expression",
    countApproxColor(workingFrame, palette.cardigan, 12, { x: 91, y: 171, width: 74, height: 36 }),
    120,
    "Working frame must keep the yellow cardigan readable while showing a small work prop."
  );
}

function requireMetric(
  issues: DoudouSpriteQualityIssue[],
  frameIndex: number,
  code: DoudouSpriteQualityIssue["code"],
  actual: number,
  minimumExclusive: number,
  message: string
): void {
  if (actual <= minimumExclusive) {
    issues.push({
      code,
      frameIndex,
      message,
      actual,
      expected: `> ${minimumExclusive}`
    });
  }
}

function framePng(atlas: PNG, frameIndex: number): PNG {
  const frame = new PNG({ width: 256, height: 256 });
  const offsetX = (frameIndex % 4) * 256;
  const offsetY = Math.floor(frameIndex / 4) * 256;
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const sourceIndex = (atlas.width * (offsetY + y) + offsetX + x) << 2;
      const targetIndex = (frame.width * y + x) << 2;
      frame.data[targetIndex] = atlas.data[sourceIndex] ?? 0;
      frame.data[targetIndex + 1] = atlas.data[sourceIndex + 1] ?? 0;
      frame.data[targetIndex + 2] = atlas.data[sourceIndex + 2] ?? 0;
      frame.data[targetIndex + 3] = atlas.data[sourceIndex + 3] ?? 0;
    }
  }
  return frame;
}

function downscaleNearest(source: PNG, targetWidth: number, targetHeight: number): PNG {
  const target = new PNG({ width: targetWidth, height: targetHeight });
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.floor((x / targetWidth) * source.width);
      const sourceY = Math.floor((y / targetHeight) * source.height);
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      const targetIndex = (target.width * y + x) << 2;
      target.data[targetIndex] = source.data[sourceIndex] ?? 0;
      target.data[targetIndex + 1] = source.data[sourceIndex + 1] ?? 0;
      target.data[targetIndex + 2] = source.data[sourceIndex + 2] ?? 0;
      target.data[targetIndex + 3] = source.data[sourceIndex + 3] ?? 0;
    }
  }
  return target;
}

function frameSignature(atlas: PNG, frameIndex: number): string {
  const frame = framePng(atlas, frameIndex);
  let hash = 0;
  for (let index = 0; index < frame.data.length; index += 4) {
    if (frame.data[index + 3] === 0) {
      continue;
    }
    hash =
      (hash * 33 + (frame.data[index] ?? 0) * 3 + (frame.data[index + 1] ?? 0) * 5 + (frame.data[index + 2] ?? 0) * 7 + index) >>>
      0;
  }
  return hash.toString(16);
}

function countApproxColor(
  png: PNG,
  rgb: Rgb,
  tolerance = 8,
  region: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: png.width, height: png.height }
): number {
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const [red, green, blue, alpha] = pixelAt(png, x, y);
      if (alpha === 0) {
        continue;
      }
      if (Math.abs(red - rgb[0]) <= tolerance && Math.abs(green - rgb[1]) <= tolerance && Math.abs(blue - rgb[2]) <= tolerance) {
        count += 1;
      }
    }
  }
  return count;
}

function pixelAt(png: PNG, x: number, y: number): [number, number, number, number] {
  const index = (png.width * y + x) << 2;
  return [
    png.data[index] ?? 0,
    png.data[index + 1] ?? 0,
    png.data[index + 2] ?? 0,
    png.data[index + 3] ?? 0
  ];
}
