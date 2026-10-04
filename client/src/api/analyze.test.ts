import { protocolFixture } from '../fixture';
import { copy } from '../copy';
import { analyze } from './analyze';

const blob = new Blob(['x'], { type: 'image/jpeg' });

afterEach(() => vi.unstubAllGlobals());

describe('analyze', () => {
  it('posts photos by slot name with vehicle fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(protocolFixture)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyze({ front: blob, rear: blob }, { plate: ' AB-123 ', mileage: '1000' });

    expect(result).toEqual(protocolFixture);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analyze');
    const form = init.body as FormData;
    expect([...form.keys()].sort()).toEqual(['front', 'mileageKm', 'plate', 'rear']);
    expect(form.get('plate')).toBe('AB-123');
  });

  it('maps backend error codes to readable messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'upstream_timeout', message: 'x' } }), { status: 504 })));
    await expect(analyze({ front: blob }, { plate: '', mileage: '' })).rejects.toThrow(copy.errors.upstream_timeout);
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    await expect(analyze({ front: blob }, { plate: '', mileage: '' })).rejects.toThrow(copy.errors.network);
  });
});
