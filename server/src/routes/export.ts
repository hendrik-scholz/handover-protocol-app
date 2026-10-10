import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { HttpError } from '../middleware/errorHandler.js';
import { ExportFieldsSchema, SLOTS, type Damage, type Slot } from '../schemas.js';
import { prepareImage } from '../services/images.js';
import { renderProtocolPdf } from '../services/pdf.js';
import { signatureToInk } from '../services/signature.js';

const SIGNATURE_FIELDS = ['signatureHanded', 'signatureReceived'] as const;

export function exportRouter(opts: { maxUploadMb: number }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: opts.maxUploadMb * 1024 * 1024, files: SLOTS.length + SIGNATURE_FIELDS.length },
    fileFilter: (_req, file, cb) =>
      file.mimetype.startsWith('image/')
        ? cb(null, true)
        : cb(new HttpError(400, 'invalid_file_type', `${file.fieldname}: only image uploads are allowed`)),
  });
  const fields = [...SLOTS, ...SIGNATURE_FIELDS].map((name) => ({ name, maxCount: 1 }));

  const router = Router();

  router.post('/export', upload.fields(fields), async (req, res, next) => {
    try {
      const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
      const captured = SLOTS.filter((s) => files[s]?.length);
      if (captured.length === 0) {
        throw new HttpError(400, 'no_photos', `Upload at least one photo (fields: ${SLOTS.join(', ')})`);
      }

      const body = ExportFieldsSchema.parse(req.body ?? {});
      const stray = body.damages.find((d) => !captured.includes(d.slot));
      if (stray) {
        throw new HttpError(400, 'invalid_input', `damage references "${stray.slot}", which was not uploaded`);
      }
      // Ids are reassigned so the numbering in the document is always 1..n in list order.
      const damages: Damage[] = body.damages.map((d, i) => ({ id: i + 1, ...d }));

      const photoEntries = await Promise.all(
        captured.map(async (slot) => [slot, await prepareImage(files[slot][0].buffer)] as const),
      );
      const photos = Object.fromEntries(photoEntries) as Partial<Record<Slot, Buffer>>;
      const [handed, received] = await Promise.all(
        SIGNATURE_FIELDS.map(async (f) => (files[f]?.length ? signatureToInk(files[f][0].buffer) : undefined)),
      );

      const date = body.date ?? new Date().toISOString().slice(0, 10);
      const protocolId = `HP-${date.replaceAll('-', '')}-${randomBytes(2).toString('hex').toUpperCase()}`;
      const pdf = await renderProtocolPdf({
        protocolId,
        date,
        plate: body.plate,
        makeModel: body.makeModel,
        mileageKm: body.mileageKm,
        remarks: body.remarks.trim(),
        photos,
        damages,
        signatures: { handed, received },
      });

      const safePlate = body.plate.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      res
        .status(200)
        .type('application/pdf')
        .set('Content-Disposition', `attachment; filename="handover-${safePlate ? `${safePlate}-` : ''}${date}.pdf"`)
        .send(pdf);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
