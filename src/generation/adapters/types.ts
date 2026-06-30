import type { SourceImageInfo } from "../../intake/source-image.js";

export type GeneratedPetFrameRole = "idle" | "tap_react";

export interface PetGenerationRequest {
  sourceImage: SourceImageInfo;
}

export interface GeneratedPetFrame {
  index: number;
  role: GeneratedPetFrameRole;
  png: Buffer;
}

export interface GeneratedPetAdapterOutput {
  adapterId: string;
  adapterVersion: string;
  petId: string;
  petName: string;
  previewFrameIndex: number;
  previewPng: Buffer;
  frames: GeneratedPetFrame[];
}

export interface PetGenerationAdapter {
  id: string;
  version: string;
  generate(request: PetGenerationRequest): Promise<GeneratedPetAdapterOutput>;
}
