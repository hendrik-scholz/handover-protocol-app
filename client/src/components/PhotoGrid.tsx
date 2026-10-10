import { copy, SLOT_LABELS } from '../copy';
import { damagesBySlot, SLOTS, type Damage, type Photos, type Slot } from '../state';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { PlusIcon } from './Icons';

function Tile({ slot, blob, damages }: { slot: Slot; blob: Blob; damages: Damage[] }) {
  const url = useObjectUrl(blob);
  return (
    <figure className="tile-wrap">
      <div className="tile">
        {url && <img src={url} alt={SLOT_LABELS[slot]} />}
        <span className="badges">
          {damages.map((d) => (<span key={d.id} className="badge" aria-label={`Damage ${d.id}`}>{d.id}</span>))}
        </span>
      </div>
      <figcaption>{SLOT_LABELS[slot]}</figcaption>
    </figure>
  );
}

export function PhotoGrid({ photos, damages, onAdd }: { photos: Photos; damages: Damage[]; onAdd: (s: Slot) => void }) {
  const firstMissing = SLOTS.find((s) => !photos[s]);
  return (
    <div className="grid">
      {SLOTS.filter((s) => photos[s]).map((slot) => (
        <Tile key={slot} slot={slot} blob={photos[slot]!} damages={damagesBySlot(damages, slot)} />
      ))}
      {firstMissing && (
        <figure className="tile-wrap">
          <button className="tile add" onClick={() => onAdd(firstMissing)}>
            <PlusIcon />
            <span>{copy.addSlot(SLOT_LABELS[firstMissing])}</span>
          </button>
          <figcaption className="muted">{copy.notCaptured}</figcaption>
        </figure>
      )}
    </div>
  );
}
