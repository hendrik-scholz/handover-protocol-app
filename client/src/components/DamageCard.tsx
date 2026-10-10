import { useState } from 'react';
import { copy, SLOT_LABELS } from '../copy';
import type { Damage } from '../state';

export function DamageCard({ damage, onRemove }: { damage: Damage; onRemove?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="card damage">
      <header>
        <span className="badge">{damage.id}</span>
        <h3>{damage.type}</h3>
        <span className={`sev sev-${damage.severity}`}>{damage.severity}</span>
      </header>
      <p className="muted small">{damage.location} · {copy.photoOf(SLOT_LABELS[damage.slot])}</p>
      <p>{damage.description}</p>
      {onRemove && (
        <div className="actions">
          {confirming ? (
            <>
              <span>{copy.removeConfirm}</span>
              <button type="button" onClick={() => setConfirming(false)}>{copy.keepDamage}</button>
              <button type="button" className="danger" onClick={onRemove}>{copy.removeDamage}</button>
            </>
          ) : (
            <button type="button" aria-label={copy.removeDamageAria(damage.id)} onClick={() => setConfirming(true)}>
              {copy.removeDamage}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
