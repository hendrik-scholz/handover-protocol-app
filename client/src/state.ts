export const SLOTS = ['front', 'left', 'rear', 'right', 'dashboard'] as const;
export type Slot = (typeof SLOTS)[number];
export type Severity = 'minor' | 'moderate' | 'severe';

export interface Damage {
  id: number;
  type: string;
  severity: Severity;
  location: string;
  slot: Slot;
  description: string;
}

export interface Protocol {
  vehicle: {
    plate: string;
    plateSource: 'photo' | 'user' | null;
    makeModel: string;
    mileageKm: number | null;
    mileageSource: 'photo' | 'user' | null;
    date: string;
  };
  capturedSlots: Slot[];
  missingSlots: Slot[];
  damages: Damage[];
  summary: { total: number } & Record<Severity, number>;
}

export type Photos = Partial<Record<Slot, Blob>>;

export interface State {
  step: 'capture' | 'result';
  photos: Photos;
  activeSlot: Slot;
  plate: string;
  mileage: string;
  protocol: Protocol | null;
  remarks: string;
  analysis: { status: 'idle' | 'loading' | 'error'; error?: string };
}

export type Action =
  | { type: 'setPhoto'; slot: Slot; blob: Blob }
  | { type: 'setActiveSlot'; slot: Slot }
  | { type: 'setPlate'; value: string }
  | { type: 'setMileage'; value: string }
  | { type: 'setRemarks'; value: string }
  | { type: 'removeDamage'; id: number }
  | { type: 'analyzeStart' }
  | { type: 'analyzeSuccess'; protocol: Protocol }
  | { type: 'analyzeError'; message: string }
  | { type: 'analyzeCancel' }
  | { type: 'goCapture'; slot?: Slot };

export const initialState: State = {
  step: 'capture',
  photos: {},
  activeSlot: 'front',
  plate: '',
  mileage: '',
  protocol: null,
  remarks: '',
  analysis: { status: 'idle' },
};

export const capturedSlots = (photos: Photos): Slot[] => SLOTS.filter((s) => photos[s]);
export const photoCount = (photos: Photos) => capturedSlots(photos).length;
export const nextEmptySlot = (photos: Photos, from?: Slot): Slot => {
  const start = from ? SLOTS.indexOf(from) + 1 : 0;
  const order = [...SLOTS.slice(start), ...SLOTS.slice(0, start)];
  return order.find((s) => !photos[s]) ?? from ?? SLOTS[0];
};
export const damagesBySlot = (damages: Damage[], slot: Slot) => damages.filter((d) => d.slot === slot);

// Damages are renumbered 1..n so photo badges and the list always match.
export function withoutDamage(protocol: Protocol, id: number): Protocol {
  const damages = protocol.damages.filter((d) => d.id !== id).map((d, i) => ({ ...d, id: i + 1 }));
  const summary = { total: damages.length, minor: 0, moderate: 0, severe: 0 };
  for (const d of damages) summary[d.severity] += 1;
  return { ...protocol, damages, summary };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setPhoto': {
      const photos = { ...state.photos, [action.slot]: action.blob };
      return { ...state, photos, activeSlot: nextEmptySlot(photos, action.slot) };
    }
    case 'setActiveSlot':
      return { ...state, activeSlot: action.slot };
    case 'setPlate':
      return { ...state, plate: action.value };
    case 'setMileage':
      return { ...state, mileage: action.value };
    case 'setRemarks':
      return { ...state, remarks: action.value };
    case 'removeDamage':
      return state.protocol ? { ...state, protocol: withoutDamage(state.protocol, action.id) } : state;
    case 'analyzeStart':
      return { ...state, analysis: { status: 'loading' } };
    case 'analyzeSuccess':
      return {
        ...state,
        step: 'result',
        protocol: action.protocol,
        plate: state.plate || action.protocol.vehicle.plate,
        mileage: action.protocol.vehicle.mileageKm?.toString() ?? state.mileage,
        analysis: { status: 'idle' },
      };
    case 'analyzeError':
      return { ...state, analysis: { status: 'error', error: action.message } };
    case 'analyzeCancel':
      return { ...state, analysis: { status: 'idle' } };
    case 'goCapture':
      return {
        ...state,
        step: 'capture',
        activeSlot: action.slot ?? state.activeSlot,
        analysis: { status: 'idle' },
      };
  }
}
