import request from 'supertest';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { VisionClient } from '../src/services/vision.js';

function fakeClient(responses: Array<string | Error>) {
  const calls: unknown[] = [];
  const client = {
    chat: {
      completions: {
        create: async (args: unknown) => {
          calls.push(args);
          const next = responses.shift();
          if (next instanceof Error) throw next;
          return { choices: [{ message: { content: next } }] };
        },
      },
    },
  } as unknown as VisionClient;
  return { client, calls };
}

const app = (client: VisionClient) => createApp({ client, model: 'test-model', maxUploadMb: 1 });

let jpeg: Buffer;
beforeAll(async () => {
  jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#888' } }).jpeg().toBuffer();
});

const damage = (slot: string, severity = 'minor') => ({
  type: 'Scratch', severity, location: 'Front bumper', slot, description: 'Surface scratch.',
});

describe('POST /api/analyze', () => {
  it('returns a protocol draft with ids, summary and missing slots', async () => {
    const { client, calls } = fakeClient([
      JSON.stringify({ damages: [damage('front'), damage('left', 'moderate')], odometerValue: null, odometerUnit: null, plateText: null }),
    ]);
    const res = await request(app(client))
      .post('/api/analyze')
      .field('plate', 'AB-123')
      .field('mileageKm', '42000')
      .attach('front', jpeg, 'f.jpg')
      .attach('left', jpeg, 'l.jpg');

    expect(res.status).toBe(200);
    expect(res.body.vehicle).toMatchObject({ plate: 'AB-123', mileageKm: 42000 });
    expect(res.body.capturedSlots).toEqual(['front', 'left']);
    expect(res.body.missingSlots).toEqual(['rear', 'right', 'interior', 'dashboard']);
    expect(res.body.damages.map((d: { id: number }) => d.id)).toEqual([1, 2]);
    expect(res.body.summary).toEqual({ total: 2, minor: 1, moderate: 1, severe: 0 });
    expect(calls).toHaveLength(1);
  });

  it('uses the odometer reading from the photo over the typed mileage', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: 45123, odometerUnit: 'km', plateText: null })]);
    const res = await request(app(client)).post('/api/analyze').field('mileageKm', '1').attach('dashboard', jpeg, 'd.jpg');
    expect(res.body.vehicle).toMatchObject({ mileageKm: 45123, mileageSource: 'photo' });
  });

  it('converts miles to km', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: 10000, odometerUnit: 'mi', plateText: null })]);
    const res = await request(app(client)).post('/api/analyze').attach('dashboard', jpeg, 'd.jpg');
    expect(res.body.vehicle).toMatchObject({ mileageKm: 16093, mileageSource: 'photo' });
  });

  it('keeps the typed mileage when the odometer is unreadable', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: null, odometerUnit: null, plateText: null })]);
    const res = await request(app(client)).post('/api/analyze').field('mileageKm', '777').attach('dashboard', jpeg, 'd.jpg');
    expect(res.body.vehicle).toMatchObject({ mileageKm: 777, mileageSource: 'user' });
  });

  it('ignores a reading without a unit and reports no source when nothing is known', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: 5000, odometerUnit: null, plateText: null })]);
    const res = await request(app(client)).post('/api/analyze').attach('dashboard', jpeg, 'd.jpg');
    expect(res.body.vehicle).toMatchObject({ mileageKm: null, mileageSource: null });
  });

  it('reads the plate from the photo, normalized, when none was typed', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: null, odometerUnit: null, plateText: ' ab 123*cd ' })]);
    const res = await request(app(client)).post('/api/analyze').attach('front', jpeg, 'f.jpg');
    expect(res.body.vehicle).toMatchObject({ plate: 'AB 123CD', plateSource: 'photo' });
  });

  it('keeps a typed plate over the photo reading', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: null, odometerUnit: null, plateText: 'XX-999' })]);
    const res = await request(app(client)).post('/api/analyze').field('plate', 'AB-123').attach('front', jpeg, 'f.jpg');
    expect(res.body.vehicle).toMatchObject({ plate: 'AB-123', plateSource: 'user' });
  });

  it('reports no plate when it is unreadable', async () => {
    const { client } = fakeClient([JSON.stringify({ damages: [], odometerValue: null, odometerUnit: null, plateText: '*' })]);
    const res = await request(app(client)).post('/api/analyze').attach('front', jpeg, 'f.jpg');
    expect(res.body.vehicle).toMatchObject({ plate: '', plateSource: null });
  });

  it('accepts code-fenced JSON', async () => {
    const { client } = fakeClient(['```json\n{"damages":[],"odometerValue":null,"odometerUnit":null,"plateText":null}\n```']);
    const res = await request(app(client)).post('/api/analyze').attach('rear', jpeg, 'r.jpg');
    expect(res.status).toBe(200);
    expect(res.body.damages).toEqual([]);
  });

  it('retries once on invalid output, then succeeds', async () => {
    const { client, calls } = fakeClient(['not json', JSON.stringify({ damages: [damage('front')], odometerValue: null, odometerUnit: null, plateText: null })]);
    const res = await request(app(client)).post('/api/analyze').attach('front', jpeg, 'f.jpg');
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('returns 422 after two invalid outputs', async () => {
    const { client } = fakeClient(['nope', 'still nope']);
    const res = await request(app(client)).post('/api/analyze').attach('front', jpeg, 'f.jpg');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('unusable_model_output');
  });

  it('rejects damages for slots that were not uploaded', async () => {
    const { client } = fakeClient([
      JSON.stringify({ damages: [damage('rear')], odometerValue: null, odometerUnit: null, plateText: null }),
      JSON.stringify({ damages: [damage('rear')], odometerValue: null, odometerUnit: null, plateText: null }),
    ]);
    const res = await request(app(client)).post('/api/analyze').attach('front', jpeg, 'f.jpg');
    expect(res.status).toBe(422);
  });

  it('returns 502 when the upstream call fails', async () => {
    const { client } = fakeClient([Object.assign(new Error('boom'), { status: 500 })]);
    const res = await request(app(client)).post('/api/analyze').attach('front', jpeg, 'f.jpg');
    expect(res.status).toBe(502);
  });

  it('returns 400 without photos', async () => {
    const res = await request(app(fakeClient([]).client)).post('/api/analyze').field('plate', 'x');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('no_photos');
  });

  it('returns 400 for non-image uploads', async () => {
    const res = await request(app(fakeClient([]).client))
      .post('/api/analyze')
      .attach('front', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an image file that cannot be decoded', async () => {
    const res = await request(app(fakeClient([]).client))
      .post('/api/analyze')
      .attach('front', Buffer.from('garbage'), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_image');
  });

  it('returns 413 for oversized uploads', async () => {
    const big = Buffer.alloc(1024 * 1024 + 10);
    const res = await request(app(fakeClient([]).client))
      .post('/api/analyze')
      .attach('front', big, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(413);
  });
});

describe('GET /api/health', () => {
  it('is ok', async () => {
    const res = await request(app(fakeClient([]).client)).get('/api/health');
    expect(res.body).toEqual({ ok: true });
  });
});
