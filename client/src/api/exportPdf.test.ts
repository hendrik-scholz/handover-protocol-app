import { protocolFixture } from '../fixture';
import { initialState, reducer } from '../state';
import { buildExportForm } from './exportPdf';

const blob = new Blob(['x'], { type: 'image/jpeg' });

describe('buildExportForm', () => {
  it('sends the edited damages without ids, the captured photos and the signatures', () => {
    let s = reducer(initialState, { type: 'analyzeSuccess', protocol: protocolFixture });
    s = reducer(s, { type: 'removeDamage', id: 1 });
    const form = buildExportForm({
      photos: { front: blob, left: blob }, protocol: s.protocol!, plate: ' AB-123 ', mileage: '42000', remarks: 'Fuel 3/4',
      signatures: { handed: new Blob(['p'], { type: 'image/png' }), received: null },
    });
    const damages = JSON.parse(form.get('damages') as string);
    expect(damages.map((d: { type: string }) => d.type)).toEqual(['Dent', 'Scuff marks']);
    expect(damages[0]).not.toHaveProperty('id');
    expect(form.get('plate')).toBe('AB-123');
    expect(form.get('mileageKm')).toBe('42000');
    expect(form.get('date')).toBe(protocolFixture.vehicle.date);
    expect(form.get('front')).toBeInstanceOf(File);
    expect(form.get('left')).toBeInstanceOf(File);
    expect(form.get('rear')).toBeNull();
    expect(form.get('signatureHanded')).toBeInstanceOf(File);
    expect(form.get('signatureReceived')).toBeNull();
  });
});
