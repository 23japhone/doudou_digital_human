import { PNG } from "pngjs";
import {
  createDoudouSourceAccentsFromPng,
  createDoudouSpriteFrames
} from "../doudou-sprite.js";
import type { GeneratedPetAdapterOutput, PetGenerationAdapter, PetGenerationRequest } from "./types.js";

export function createDoudouDigitalHumanAdapter(): PetGenerationAdapter {
  const adapterId = "doudou-digital-human-adapter";
  const adapterVersion = "0.1.0";
  return {
    id: adapterId,
    version: adapterVersion,
    requiresNormalizedSourceImage: true,
    async generate(request: PetGenerationRequest): Promise<GeneratedPetAdapterOutput> {
      if (!request.normalizedSourceImage) {
        throw new Error("Doudou digital-human generation requires a normalized source image.");
      }

      const source = PNG.sync.read(request.normalizedSourceImage.bytes);
      const frames = createDoudouSpriteFrames({
        sourceAccents: createDoudouSourceAccentsFromPng(source)
      });
      const previewFrame = frames.find((frame) => frame.index === 1) ?? frames[0];
      return {
        adapterId,
        adapterVersion,
        petId: "generated_local_pet",
        petName: "兜兜二次元数字人",
        previewFrameIndex: previewFrame?.index ?? 0,
        previewPng: previewFrame?.png ?? frames[0]!.png,
        frames
      };
    }
  };
}
