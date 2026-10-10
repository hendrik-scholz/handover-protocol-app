import { protocolFixture } from './fixture';
import { initialState, nextEmptySlot, photoCount, reducer } from './state';

const blob = new Blob(['x'], { type: 'image/jpeg' });

describe('reducer', () => {
  it('stores a photo and advances to the next empty slot', () => {
    const s = reducer(initialState, { type: 'setPhoto', slot: 'front', blob });
    expect(photoCount(s.photos)).toBe(1);
    expect(s.activeSlot).toBe('left');
  });

  it('replacing a photo does not change the count', () => {
    let s = reducer(initialState, { type: 'setPhoto', slot: 'front', blob });
    s = reducer(s, { type: 'setPhoto', slot: 'front', blob });
    expect(photoCount(s.photos)).toBe(1);
  });

  it('skips captured slots and wraps around', () => {
    const photos = { front: blob, left: blob, rear: blob };
    expect(nextEmptySlot(photos, 'rear')).toBe('right');
    expect(nextEmptySlot({ ...photos, right: blob, dashboard: blob }, 'rear')).toBe('rear');
  });

  it('goCapture keeps photos and can preselect a slot', () => {
    let s = reducer(initialState, { type: 'setPhoto', slot: 'front', blob });
    s = reducer(s, { type: 'analyzeSuccess', protocol: protocolFixture });
    expect(s.step).toBe('result');
    s = reducer(s, { type: 'goCapture', slot: 'right' });
    expect(s.step).toBe('capture');
    expect(s.activeSlot).toBe('right');
    expect(photoCount(s.photos)).toBe(1);
  });

  it('tracks analysis errors', () => {
    const s = reducer(initialState, { type: 'analyzeError', message: 'boom' });
    expect(s.analysis).toEqual({ status: 'error', error: 'boom' });
  });

  it('removes a damage, renumbers the rest and recomputes the summary', () => {
    let s = reducer(initialState, { type: 'analyzeSuccess', protocol: protocolFixture });
    s = reducer(s, { type: 'removeDamage', id: 1 });
    expect(s.protocol!.damages.map((d) => [d.id, d.type])).toEqual([[1, 'Dent'], [2, 'Scuff marks']]);
    expect(s.protocol!.summary).toEqual({ total: 2, minor: 1, moderate: 1, severe: 0 });
  });
});
