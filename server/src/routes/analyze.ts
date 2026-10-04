import { Router } from 'express';
import multer from 'multer';
import { HttpError } from '../middleware/errorHandler.js';
import {
  SLOTS,
  VehicleFieldsSchema,
  type Damage,
  type ProtocolDraft,
  type Severity,
  type Slot,
} from '../schemas.js';
import { prepareImage } from '../services/images.js';
import { detectDamages, type SlotImage, type VisionClient } from '../services/vision.js';

const MILES_TO_KM = 1.609344;

/** A reading without a visible unit is treated as unusable rather than guessed. */
function odometerToKm(value: number | null, unit: 'km' | 'mi' | null): number | null {
  if (value === null || unit === null) return null;
  return unit === 'mi' ? Math.round(value * MILES_TO_KM) : value;
}

/** Uppercase and keep only characters that occur on plates; empty result means unusable. */
function normalizePlate(raw: string | null): string | null {
  if (!raw) return null;
  const plate = raw.toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
  return plate.length >= 2 ? plate : null;
}

export function analyzeRouter(opts: { client: VisionClient; model: string; maxUploadMb: number }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: opts.maxUploadMb * 1024 * 1024, files: SLOTS.length },
    fileFilter: (_req, file, cb) =>
      file.mimetype.startsWith('image/')
        ? cb(null, true)
        : cb(new HttpError(400, 'invalid_file_type', `${file.fieldname}: only image uploads are allowed`)),
  });

  const router = Router();

  router.post('/analyze', upload.fields(SLOTS.map((name) => ({ name, maxCount: 1 }))), async (req, res, next) => {
    try {
      const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
      const captured = SLOTS.filter((s) => files[s]?.length);
      if (captured.length === 0) {
        throw new HttpError(400, 'no_photos', `Upload at least one photo (fields: ${SLOTS.join(', ')})`);
      }

      const vehicle = VehicleFieldsSchema.parse(req.body ?? {});
      const images: SlotImage[] = await Promise.all(
        captured.map(async (slot) => ({ slot, jpeg: await prepareImage(files[slot][0].buffer) })),
      );

      const result = await detectDamages(opts.client, opts.model, images);
      const damages: Damage[] = result.damages.map((d, i) => ({ id: i + 1, ...d }));

      const summary = { total: damages.length, minor: 0, moderate: 0, severe: 0 } as ProtocolDraft['summary'];
      for (const d of damages) summary[d.severity as Severity]++;

      const fromPhoto = odometerToKm(result.odometerValue, result.odometerUnit);
      const mileageKm = fromPhoto ?? vehicle.mileageKm;
      // A plate the user typed wins over the photo, so manual corrections are never overwritten.
      const platePhoto = vehicle.plate ? null : normalizePlate(result.plateText);
      const plate = vehicle.plate || platePhoto || '';

      const body: ProtocolDraft = {
        vehicle: {
          ...vehicle,
          plate,
          plateSource: platePhoto ? 'photo' : vehicle.plate ? 'user' : null,
          mileageKm,
          mileageSource: fromPhoto !== null ? 'photo' : vehicle.mileageKm !== null ? 'user' : null,
          date: new Date().toISOString().slice(0, 10),
        },
        capturedSlots: captured as Slot[],
        missingSlots: SLOTS.filter((s) => !captured.includes(s)),
        damages,
        summary,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
