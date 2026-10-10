import { z } from 'zod';

export const SLOTS = ['front', 'left', 'rear', 'right', 'dashboard'] as const;
export const SlotSchema = z.enum(SLOTS);
export type Slot = z.infer<typeof SlotSchema>;

export const SeveritySchema = z.enum(['minor', 'moderate', 'severe']);
export type Severity = z.infer<typeof SeveritySchema>;

/** What the model must return. */
export const VisionResultSchema = z.object({
  damages: z.array(
    z.object({
      type: z.string().min(1),
      severity: SeveritySchema,
      location: z.string().min(1),
      slot: SlotSchema,
      description: z.string().min(1),
    }),
  ),
  /** Total odometer reading as shown, or null if not visible/readable. */
  odometerValue: z.number().int().nonnegative().max(2_000_000).nullable(),
  odometerUnit: z.enum(['km', 'mi']).nullable(),
  /** License plate of the photographed vehicle as printed, or null if not legible. */
  plateText: z.string().max(32).nullable(),
});
export type VisionResult = z.infer<typeof VisionResultSchema>;

export type Damage = VisionResult['damages'][number] & { id: number };

export interface Vehicle {
  plate: string;
  /** 'photo' when read from a license plate, 'user' when typed, null when unknown. */
  plateSource: 'photo' | 'user' | null;
  makeModel: string;
  mileageKm: number | null;
  /** 'photo' when read from the odometer, 'user' when typed, null when unknown. */
  mileageSource: 'photo' | 'user' | null;
  date: string;
}

export interface ProtocolDraft {
  vehicle: Vehicle;
  capturedSlots: Slot[];
  missingSlots: Slot[];
  damages: Damage[];
  summary: { total: number } & Record<Severity, number>;
}

export const VehicleFieldsSchema = z.object({
  plate: z.string().trim().max(32).default(''),
  makeModel: z.string().trim().max(100).default(''),
  mileageKm: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().nonnegative().nullable()),
});

/** Damage as the client re-sends it for export; ids are reassigned by the server. */
export const ExportDamageSchema = z.object({
  type: z.string().trim().min(1).max(100),
  severity: SeveritySchema,
  location: z.string().trim().min(1).max(200),
  slot: SlotSchema,
  description: z.string().trim().min(1).max(1000),
});

export const ExportFieldsSchema = VehicleFieldsSchema.extend({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  remarks: z.string().max(2000).default(''),
  /** JSON-encoded array, because multipart text fields are flat strings. */
  damages: z
    .string()
    .default('[]')
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.issues.push({ code: 'custom', message: 'must be valid JSON', input: raw });
        return z.NEVER;
      }
    })
    .pipe(z.array(ExportDamageSchema).max(50)),
});
export type ExportFields = z.infer<typeof ExportFieldsSchema>;
