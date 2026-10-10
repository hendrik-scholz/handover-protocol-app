import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler.js';

const MAX_SIDE = 4000;

/**
 * The signature pad draws light ink on a transparent canvas (it sits on a dark UI), which would be
 * invisible on paper. Use the alpha channel as the stroke mask and render dark ink on white.
 */
export async function signatureToInk(input: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(input).metadata();
    if (meta.format !== 'png' || !meta.width || !meta.height || meta.width > MAX_SIDE || meta.height > MAX_SIDE) {
      throw new Error('unsupported signature image');
    }
    // sharp runs negate() before extractChannel() regardless of call order, so invert in a second pass.
    const mask = await sharp(input).ensureAlpha().extractChannel('alpha').png().toBuffer();
    return await sharp(mask).negate().png().toBuffer();
  } catch {
    throw new HttpError(400, 'invalid_signature', 'Signature must be a PNG image');
  }
}
