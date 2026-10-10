import request from 'supertest';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Damage } from '../src/schemas.js';
import { renderProtocolPdf, type PdfData } from '../src/services/pdf.js';
import { signatureToInk } from '../src/services/signature.js';
import type { VisionClient } from '../src/services/vision.js';

const app = () => createApp({ client: {} as VisionClient, model: 'test-model', maxUploadMb: 1 });

let jpeg: Buffer;
let sigPng: Buffer;
beforeAll(async () => {
  jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#888' } }).jpeg().toBuffer();
  // light ink on a transparent canvas, like the client's signature pad
  const px = Buffer.alloc(20 * 10 * 4);
  for (let x = 5; x < 15; x++) px.set([243, 245, 248, 255], (5 * 20 + x) * 4);
  sigPng = await sharp(px, { raw: { width: 20, height: 10, channels: 4 } }).png().toBuffer();
});

const dmg = (slot: string, severity = 'minor') => ({
  type: 'Scratch', severity, location: 'Front bumper, lower left', slot, description: 'Surface scratch.',
});

/** Text of an uncompressed PDF: standard fonts are written as hex strings inside TJ arrays. */
function pdfText(pdf: Buffer): string {
  const out: string[] = [];
  for (const [, arr] of pdf.toString('latin1').matchAll(/\[([^\]]*)\]\s*TJ/g)) {
    out.push([...arr.matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join(''));
  }
  return out.join('\n');
}
const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

const baseData = (damages: Damage[]): PdfData => ({
  protocolId: 'HP-20261004-ABCD',
  date: '2026-10-04',
  plate: 'AB-123',
  makeModel: '',
  mileageKm: 45123,
  remarks: '',
  photos: { front: jpeg, left: jpeg, rear: jpeg },
  damages,
  signatures: {},
});

describe('POST /api/export', () => {
  it('returns a PDF attachment', async () => {
    const res = await request(app())
      .post('/api/export')
      .field('plate', 'AB-123')
      .field('mileageKm', '42000')
      .field('date', '2026-10-04')
      .field('remarks', 'Fuel level 3/4')
      .field('damages', JSON.stringify([dmg('front'), dmg('left', 'moderate')]))
      .attach('front', jpeg, 'f.jpg')
      .attach('left', jpeg, 'l.jpg')
      .attach('signatureHanded', sigPng, { filename: 's.png', contentType: 'image/png' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="handover-AB-123-2026-10-04.pdf"');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns 400 without photos', async () => {
    const res = await request(app()).post('/api/export').field('plate', 'x');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('no_photos');
  });

  it('returns 400 for malformed damages JSON', async () => {
    const res = await request(app()).post('/api/export').field('damages', '{nope').attach('front', jpeg, 'f.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });

  it('returns 400 for a damage on a slot that was not uploaded', async () => {
    const res = await request(app())
      .post('/api/export')
      .field('damages', JSON.stringify([dmg('rear')]))
      .attach('front', jpeg, 'f.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });

  it('returns 400 for non-image uploads and for a signature that is not a PNG', async () => {
    const text = await request(app())
      .post('/api/export')
      .attach('front', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(text.status).toBe(400);

    const sig = await request(app())
      .post('/api/export')
      .attach('front', jpeg, 'f.jpg')
      .attach('signatureHanded', jpeg, { filename: 's.jpg', contentType: 'image/jpeg' });
    expect(sig.status).toBe(400);
    expect(sig.body.error.code).toBe('invalid_signature');
  });
});

describe('renderProtocolPdf', () => {
  it('writes the mockup content on two pages', async () => {
    const pdf = await renderProtocolPdf(baseData([
      { id: 1, ...dmg('front') } as Damage,
      { id: 2, ...dmg('left', 'moderate') } as Damage,
      { id: 3, ...dmg('rear') } as Damage,
    ]), { compress: false });
    const text = pdfText(pdf);
    expect(text).toContain('Handover Protocol');
    expect(text).toContain('AB-123');
    expect(text).toContain('3 damages detected');
    expect(text).toContain('2 minor · 1 moderate · Right side, Dashboard not yet checked');
    expect(text).toContain('Not covered yet: right side, dashboard.');
    expect(text).toContain('Damage 2 marked');
    expect(text).toContain('Not captured');
    expect(text).toContain('Damages are suggested from photos. Review before signing.');
    expect(text).toContain('Page 2 of 2');
    expect(pageCount(pdf)).toBe(2);
  });

  it('reports no damages and omits the damages table', async () => {
    const text = pdfText(await renderProtocolPdf(baseData([]), { compress: false }));
    expect(text).toContain('No damages detected');
    expect(text).not.toContain('Evidence');
  });

  it('flows onto more pages when there are many damages', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, ...dmg('front') }) as Damage);
    const pdf = await renderProtocolPdf(baseData(many), { compress: false });
    expect(pageCount(pdf)).toBeGreaterThan(2);
    expect(pdfText(pdf)).toContain(`Page ${pageCount(pdf)} of ${pageCount(pdf)}`);
  });
});

describe('signatureToInk', () => {
  it('turns light ink on transparent into dark ink on white', async () => {
    const { data, info } = await sharp(await signatureToInk(sigPng)).raw().toBuffer({ resolveWithObject: true });
    expect(data[(5 * info.width + 10) * info.channels]).toBeLessThan(10); // stroke pixel
    expect(data[0]).toBeGreaterThan(245); // background
  });

  it('rejects images that are not PNG', async () => {
    await expect(signatureToInk(jpeg)).rejects.toMatchObject({ code: 'invalid_signature' });
  });
});
