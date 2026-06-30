import { z } from "zod";

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/).min(1).max(64);
const relativePngPathSchema = z.string().min(1).max(240);

const atlasSchema = z.object({
  id: idSchema,
  path: relativePngPathSchema,
  mime: z.literal("image/png"),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  frameWidth: z.literal(256),
  frameHeight: z.literal(256),
  columns: z.literal(4),
  rows: z.literal(2)
});

const animationFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  durationMs: z.number().int().min(16).max(1000)
});

const animationSchema = z.object({
  atlas: idSchema,
  loop: z.boolean(),
  frames: z.array(animationFrameSchema).min(1).max(120),
  next: idSchema.optional()
});

export const petManifestSchema = z.object({
  schemaVersion: z.string(),
  id: idSchema,
  name: z.string().min(1).max(80),
  assetFormat: z.literal("png_sprite_atlas_grid"),
  canvas: z.object({
    width: z.literal(256),
    height: z.literal(256),
    anchor: z.object({
      x: z.number().int().min(0).max(256),
      y: z.number().int().min(0).max(256)
    })
  }),
  assets: z.object({
    preview: relativePngPathSchema,
    atlases: z.array(atlasSchema).min(1).max(4)
  }),
  animations: z.record(idSchema, animationSchema),
  behavior: z.object({
    initial: idSchema,
    onTap: idSchema
  }),
  hitArea: z.object({
    type: z.literal("alpha"),
    alphaThreshold: z.number().int().min(0).max(255),
    fallbackRect: z.object({
      x: z.number().int().min(0).max(255),
      y: z.number().int().min(0).max(255),
      width: z.number().int().min(1).max(256),
      height: z.number().int().min(1).max(256)
    })
  }),
  privacy: z.object({
    sourceImageStored: z.boolean(),
    cloudGenerated: z.boolean()
  }),
  provenance: z.object({
    sourceMeta: relativePngPathSchema
  })
}).strict();

export type PetManifest = z.infer<typeof petManifestSchema>;
export type PetAtlas = PetManifest["assets"]["atlases"][number];
export type PetAnimation = PetManifest["animations"][string];
