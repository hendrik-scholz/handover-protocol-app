import { copy, SLOT_LABELS } from '../copy';
import type { Damage } from '../state';

export function DamageCard({ damage }: { damage: Damage }) {
  return (
    <article className="card damage">
      <header>
        <span className="badge">{damage.id}</span>
        <h3>{damage.type}</h3>
        <span className={`sev sev-${damage.severity}`}>{damage.severity}</span>
      </header>
      <p className="muted small">{damage.location} · {copy.photoOf(SLOT_LABELS[damage.slot])}</p>
      <p>{damage.description}</p>
    </article>
  );
}
