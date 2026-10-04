import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler.js';

const MAX_SIDE = 1568;

/** Resize and re-encode as JPEG. sharp drops EXIF unless withMetadata() is used. */
export async function prepareImage(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch {
    throw new HttpError(400, 'invalid_image', 'Uploaded file is not a readable image');
  }
}
