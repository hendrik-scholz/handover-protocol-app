import { z } from 'zod';

export const SLOTS = ['front', 'left', 'rear', 'right', 'interior', 'dashboard'] as const;
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
