import { PNG } from "pngjs";
import type { GeneratedPetFrame } from "./adapters/types.js";

type Rgb = [number, number, number];

export interface DoudouSpriteSourceAccents {
  left: Rgb;
  right: Rgb;
}

export interface DoudouSpriteOptions {
  sourceAccents?: DoudouSpriteSourceAccents;
}

type DoudouExpression = "idle" | "blink" | "curious" | "surprised" | "annoyed" | "teary" | "working";

interface DoudouFramePose {
  armOffset: number;
  expression: DoudouExpression;
  headX: number;
  yShift: number;
}

export function createDoudouSpriteFrames(options: DoudouSpriteOptions = {}): GeneratedPetFrame[] {
  return Array.from({ length: 8 }, (_unused, frameIndex) => ({
    index: frameIndex,
    role: frameIndex >= 4 ? "tap_react" as const : "idle" as const,
    png: createDoudouSpriteFramePng(frameIndex, options)
  }));
}

export function createDoudouSpriteFramePng(frameIndex: number, options: DoudouSpriteOptions = {}): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  drawDoudouSpriteFrame(png, 0, 0, frameIndex, options);
  return PNG.sync.write(png);
}

export function createDoudouPreviewPng(options: DoudouSpriteOptions = {}): Buffer {
  return createDoudouSpriteFramePng(1, options);
}

export function createDoudouSourceAccentsFromPng(source: PNG): DoudouSpriteSourceAccents {
  return {
    left: averageVisibleRgb(source, 0, Math.max(0, Math.floor(source.width / 2) - 1), [230, 60, 50]),
    right: averageVisibleRgb(source, Math.floor(source.width / 2), source.width - 1, [50, 210, 90])
  };
}

function drawDoudouSpriteFrame(
  png: PNG,
  offsetX: number,
  offsetY: number,
  frameIndex: number,
  options: DoudouSpriteOptions
): void {
  const pose = doudouFramePose(frameIndex);
  const yShift = pose.yShift;
  const headX = pose.headX;
  const hairColor: Rgb = [54, 48, 88];
  const hairShade: Rgb = [82, 63, 125];
  const hairHighlight: Rgb = [184, 156, 216];
  const skinColor: Rgb = [255, 214, 190];
  const eyeColor: Rgb = [30, 34, 62];
  const outfitColor: Rgb = [92, 121, 214];
  const outfitShade: Rgb = [62, 77, 154];
  const blushColor: Rgb = [255, 139, 156];
  const accentColor: Rgb = [255, 226, 95];
  const tearColor: Rgb = [132, 202, 255];

  fillEllipse(png, offsetX + 128, offsetY + 226 + yShift, 58, 8, [34, 42, 80], 90);
  fillEllipse(png, offsetX + 128, offsetY + 198 + yShift, 58, 40, outfitColor, 255);
  fillEllipse(png, offsetX + 96 + pose.armOffset, offsetY + 202 + yShift, 15, 27, outfitShade, 255);
  fillEllipse(png, offsetX + 160 + pose.armOffset, offsetY + 202 + yShift, 15, 27, outfitShade, 255);
  fillCircle(png, offsetX + 84 + pose.armOffset, offsetY + 202 + yShift, 9, skinColor, 255);
  fillCircle(png, offsetX + 172 + pose.armOffset, offsetY + 202 + yShift, 9, skinColor, 255);

  if (options.sourceAccents && pose.expression !== "working") {
    fillRect(png, offsetX + 73 + pose.armOffset, offsetY + 188 + yShift, 22, 29, options.sourceAccents.left, 255);
    fillRect(png, offsetX + 161 + pose.armOffset, offsetY + 188 + yShift, 22, 29, options.sourceAccents.right, 255);
  }

  fillRect(png, offsetX + 116, offsetY + 163 + yShift, 24, 25, skinColor, 255);

  fillEllipse(png, offsetX + 128 + headX, offsetY + 106 + yShift, 57, 61, hairColor, 255);
  fillEllipse(png, offsetX + 87 + headX, offsetY + 128 + yShift, 14, 50, hairColor, 255);
  fillEllipse(png, offsetX + 169 + headX, offsetY + 128 + yShift, 14, 50, hairColor, 255);
  fillEllipse(png, offsetX + 128 + headX, offsetY + 124 + yShift, 43, 47, skinColor, 255);

  fillTriangle(
    png,
    offsetX + 93 + headX,
    offsetY + 88 + yShift,
    offsetX + 126 + headX,
    offsetY + 77 + yShift,
    offsetX + 114 + headX,
    offsetY + 117 + yShift,
    hairShade,
    255
  );
  fillTriangle(
    png,
    offsetX + 118 + headX,
    offsetY + 76 + yShift,
    offsetX + 159 + headX,
    offsetY + 87 + yShift,
    offsetX + 140 + headX,
    offsetY + 118 + yShift,
    hairColor,
    255
  );
  fillTriangle(
    png,
    offsetX + 129 + headX,
    offsetY + 78 + yShift,
    offsetX + 151 + headX,
    offsetY + 92 + yShift,
    offsetX + 135 + headX,
    offsetY + 113 + yShift,
    hairShade,
    255
  );
  fillCircle(png, offsetX + 100 + headX, offsetY + 86 + yShift, 12, hairShade, 255);
  fillCircle(png, offsetX + 158 + headX, offsetY + 88 + yShift, 11, hairColor, 255);
  fillRect(png, offsetX + 127 + headX, offsetY + 78 + yShift, 21, 3, hairHighlight, 255);

  fillTriangle(
    png,
    offsetX + 112,
    offsetY + 179 + yShift,
    offsetX + 128,
    offsetY + 190 + yShift,
    offsetX + 144,
    offsetY + 179 + yShift,
    [255, 242, 176],
    255
  );
  fillTriangle(
    png,
    offsetX + 97,
    offsetY + 176 + yShift,
    offsetX + 120,
    offsetY + 190 + yShift,
    offsetX + 114,
    offsetY + 172 + yShift,
    [255, 242, 176],
    255
  );
  fillTriangle(
    png,
    offsetX + 159,
    offsetY + 176 + yShift,
    offsetX + 136,
    offsetY + 190 + yShift,
    offsetX + 142,
    offsetY + 172 + yShift,
    [255, 242, 176],
    255
  );

  drawDoudouEyes(png, offsetX + headX, offsetY + yShift, pose.expression, eyeColor);
  drawDoudouMouth(png, offsetX + headX, offsetY + yShift, pose.expression, eyeColor);

  drawBlush(png, offsetX + 104 + headX, offsetY + 141 + yShift, blushColor, pose.expression);
  drawBlush(png, offsetX + 152 + headX, offsetY + 141 + yShift, blushColor, pose.expression);

  if (pose.expression === "surprised") {
    fillCircle(png, offsetX + 75, offsetY + 58, 6, accentColor, 255);
    fillCircle(png, offsetX + 184, offsetY + 62, 5, accentColor, 255);
    fillCircle(png, offsetX + 75, offsetY + 58, 2, [255, 255, 255], 255);
  }
  if (pose.expression === "curious") {
    fillCircle(png, offsetX + 184, offsetY + 72, 4, accentColor, 255);
    fillRect(png, offsetX + 183, offsetY + 60, 3, 8, accentColor, 255);
    fillCircle(png, offsetX + 185, offsetY + 58, 5, accentColor, 255);
  }
  if (pose.expression === "teary") {
    fillEllipse(png, offsetX + 107 + headX, offsetY + 137 + yShift, 3, 8, tearColor, 255);
    fillEllipse(png, offsetX + 149 + headX, offsetY + 137 + yShift, 3, 8, tearColor, 255);
    fillCircle(png, offsetX + 108 + headX, offsetY + 134 + yShift, 2, [235, 249, 255], 255);
  }
  if (pose.expression === "working") {
    fillRect(png, offsetX + 106, offsetY + 195 + yShift, 44, 14, accentColor, 255);
    fillRect(png, offsetX + 110, offsetY + 198 + yShift, 36, 3, [255, 248, 186], 255);
    fillRect(png, offsetX + 114, offsetY + 204 + yShift, 28, 2, outfitShade, 255);
  }
}

function doudouFramePose(frameIndex: number): DoudouFramePose {
  switch (frameIndex) {
    case 1:
      return { armOffset: 1, expression: "idle", headX: 0, yShift: -3 };
    case 2:
      return { armOffset: 0, expression: "blink", headX: 0, yShift: -1 };
    case 3:
      return { armOffset: 0, expression: "curious", headX: -3, yShift: -2 };
    case 4:
      return { armOffset: -1, expression: "surprised", headX: 0, yShift: -6 };
    case 5:
      return { armOffset: -2, expression: "annoyed", headX: -2, yShift: -2 };
    case 6:
      return { armOffset: 1, expression: "teary", headX: 2, yShift: 1 };
    case 7:
      return { armOffset: 0, expression: "working", headX: 0, yShift: 0 };
    default:
      return { armOffset: 0, expression: "idle", headX: 0, yShift: 0 };
  }
}

function drawDoudouEyes(png: PNG, offsetX: number, offsetY: number, expression: DoudouExpression, eyeColor: Rgb): void {
  if (expression === "blink") {
    fillRect(png, offsetX + 107, offsetY + 124, 10, 2, eyeColor, 255);
    fillRect(png, offsetX + 139, offsetY + 124, 10, 2, eyeColor, 255);
    return;
  }
  if (expression === "annoyed") {
    fillRect(png, offsetX + 106, offsetY + 122, 13, 4, eyeColor, 255);
    fillRect(png, offsetX + 138, offsetY + 122, 13, 4, eyeColor, 255);
    return;
  }
  if (expression === "teary") {
    fillEllipse(png, offsetX + 112, offsetY + 124, 6, 8, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 124, 6, 8, eyeColor, 255);
    fillCircle(png, offsetX + 114, offsetY + 121, 2, [255, 255, 255], 255);
    fillCircle(png, offsetX + 146, offsetY + 121, 2, [255, 255, 255], 255);
    return;
  }
  if (expression === "surprised") {
    fillEllipse(png, offsetX + 112, offsetY + 122, 7, 9, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 122, 7, 9, eyeColor, 255);
    fillCircle(png, offsetX + 114, offsetY + 119, 2, [255, 255, 255], 255);
    fillCircle(png, offsetX + 146, offsetY + 119, 2, [255, 255, 255], 255);
    return;
  }
  if (expression === "working") {
    fillEllipse(png, offsetX + 112, offsetY + 123, 5, 6, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 123, 5, 6, eyeColor, 255);
    fillRect(png, offsetX + 105, offsetY + 114, 15, 3, eyeColor, 255);
    fillRect(png, offsetX + 137, offsetY + 114, 15, 3, eyeColor, 255);
    return;
  }
  fillEllipse(png, offsetX + 112, offsetY + 123, expression === "curious" ? 6 : 5, 7, eyeColor, 255);
  fillEllipse(png, offsetX + 144, offsetY + 123, 5, 7, eyeColor, 255);
  fillCircle(png, offsetX + 114, offsetY + 120, 2, [255, 255, 255], 255);
  fillCircle(png, offsetX + 146, offsetY + 120, 2, [255, 255, 255], 255);
}

function drawDoudouMouth(png: PNG, offsetX: number, offsetY: number, expression: DoudouExpression, eyeColor: Rgb): void {
  if (expression === "surprised") {
    fillEllipse(png, offsetX + 128, offsetY + 148, 7, 10, eyeColor, 255);
    return;
  }
  if (expression === "annoyed") {
    fillRect(png, offsetX + 108, offsetY + 147, 40, 4, eyeColor, 255);
    fillRect(png, offsetX + 109, offsetY + 151, 38, 2, eyeColor, 255);
    return;
  }
  if (expression === "teary") {
    fillRect(png, offsetX + 119, offsetY + 150, 18, 3, eyeColor, 255);
    fillRect(png, offsetX + 116, offsetY + 147, 5, 3, eyeColor, 255);
    return;
  }
  if (expression === "working") {
    fillRect(png, offsetX + 120, offsetY + 148, 16, 3, eyeColor, 255);
    return;
  }
  if (expression === "curious") {
    fillEllipse(png, offsetX + 128, offsetY + 148, 4, 5, eyeColor, 255);
    return;
  }
  fillRect(png, offsetX + 119, offsetY + 148, 18, 3, eyeColor, 255);
}

function drawBlush(png: PNG, centerX: number, centerY: number, blushColor: Rgb, expression: DoudouExpression): void {
  fillEllipse(png, centerX, centerY, 5, 3, blushColor, expression === "annoyed" ? 230 : 180);
}

function averageVisibleRgb(source: PNG, minX: number, maxX: number, fallback: Rgb): Rgb {
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = Math.max(0, minX); x <= Math.min(source.width - 1, maxX); x += 1) {
      const index = (source.width * y + x) << 2;
      const alpha = (source.data[index + 3] ?? 0) / 255;
      if (alpha <= 0) {
        continue;
      }
      red += (source.data[index] ?? 0) * alpha;
      green += (source.data[index + 1] ?? 0) * alpha;
      blue += (source.data[index + 2] ?? 0) * alpha;
      weight += alpha;
    }
  }
  if (weight <= 0) {
    return fallback;
  }
  return [clampChannel(red / weight), clampChannel(green / weight), clampChannel(blue / weight)];
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
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillTriangle(
  png: PNG,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  rgb: Rgb,
  alpha: number
): void {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const area = edgeFunction(x1, y1, x2, y2, x3, y3);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = edgeFunction(x2, y2, x3, y3, x, y);
      const w2 = edgeFunction(x3, y3, x1, y1, x, y);
      const w3 = edgeFunction(x1, y1, x2, y2, x, y);
      if ((area >= 0 && w1 >= 0 && w2 >= 0 && w3 >= 0) || (area < 0 && w1 <= 0 && w2 <= 0 && w3 <= 0)) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function edgeFunction(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

function fillCircle(png: PNG, centerX: number, centerY: number, radius: number, rgb: Rgb, alpha: number): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgb: Rgb, alpha: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgb, alpha);
    }
  }
}

function setPixel(png: PNG, x: number, y: number, rgb: Rgb, alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = rgb[0];
  png.data[index + 1] = rgb[1];
  png.data[index + 2] = rgb[2];
  png.data[index + 3] = alpha;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
