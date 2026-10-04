import { SLOT_LABELS } from '../copy';
import { SLOTS, type Photos, type Slot } from '../state';
import { CheckIcon } from './Icons';

export function SlotChips({ photos, active, onSelect }: { photos: Photos; active: Slot; onSelect: (s: Slot) => void }) {
  return (
    <div className="chips" role="tablist" aria-label="Photo slots">
      {SLOTS.map((slot) => {
        const done = Boolean(photos[slot]);
        const cls = slot === active ? 'chip active' : done ? 'chip done' : 'chip empty';
        return (
          <button key={slot} role="tab" aria-selected={slot === active} className={cls} onClick={() => onSelect(slot)}>
            {done && slot !== active && <CheckIcon />} {SLOT_LABELS[slot].replace(' side', '')}
          </button>
        );
      })}
    </div>
  );
}
