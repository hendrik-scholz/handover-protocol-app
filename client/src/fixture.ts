import type { Protocol } from './state';

export const protocolFixture: Protocol = {
  vehicle: { plate: 'AB-123', plateSource: 'user', makeModel: '', mileageKm: null, mileageSource: null, date: '2026-10-04' },
  capturedSlots: ['front', 'left', 'rear'],
  missingSlots: ['right', 'dashboard'],
  damages: [
    { id: 1, type: 'Scratch', severity: 'minor', location: 'Front bumper, lower left', slot: 'front', description: 'Surface scratch.' },
    { id: 2, type: 'Dent', severity: 'moderate', location: 'Left door, lower third', slot: 'left', description: 'Shallow dent.' },
    { id: 3, type: 'Scuff marks', severity: 'minor', location: 'Rear bumper, right corner', slot: 'rear', description: 'Scuffing.' },
  ],
  summary: { total: 3, minor: 2, moderate: 1, severe: 0 },
};
