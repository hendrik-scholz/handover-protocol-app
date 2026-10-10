import { copy, SLOT_LABELS } from '../copy';
import type { Slot } from '../state';
import { InfoIcon } from './Icons';

export function CoverageNotice({ missing }: { missing: Slot[] }) {
  if (!missing.length) return null;
  return (
    <p className="notice">
      <InfoIcon width={18} height={18} />
      <span>{copy.coverage(missing.map((s) => SLOT_LABELS[s].toLowerCase()).join(', '))}</span>
    </p>
  );
}
