import { copy, SLOT_LABELS } from '../copy';
import type { Protocol } from '../state';
import { WarnIcon, CheckIcon } from './Icons';

export function SeverityBanner({ protocol }: { protocol: Protocol }) {
  const { summary, missingSlots } = protocol;
  const none = summary.total === 0;
  const detail = [
    copy.severityCounts(summary.minor, summary.moderate, summary.severe),
    missingSlots.length && copy.notChecked(missingSlots.map((s) => SLOT_LABELS[s]).join(', ')),
  ].filter(Boolean).join(' · ');
  return (
    <div className={`banner ${none ? 'ok' : 'warn'}`} role="status">
      {none ? <CheckIcon width={26} height={26} /> : <WarnIcon width={26} height={26} />}
      <div>
        <strong>{none ? copy.noDamages : copy.damagesDetected(summary.total)}</strong>
        {detail && <p>{detail}</p>}
      </div>
    </div>
  );
}
