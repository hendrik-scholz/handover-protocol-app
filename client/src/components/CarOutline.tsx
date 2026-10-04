import type { Slot } from '../state';

const dash = { fill: 'none', stroke: '#c9d2e0', strokeWidth: 3, strokeDasharray: '8 7', strokeLinecap: 'round' as const };

export function CarOutline({ slot }: { slot: Slot }) {
  return (
    <svg viewBox="0 0 320 160" className="outline" aria-hidden>
      {(slot === 'left' || slot === 'right') && (
        <g {...dash} transform={slot === 'left' ? 'translate(320 0) scale(-1 1)' : undefined}>
          <path d="M20 112V92c0-8 6-12 14-13l36-6 30-26c4-4 8-5 14-5h68c6 0 10 1 14 5l30 26 32 6c6 1 10 5 10 11v22H20z" />
          <circle cx="82" cy="112" r="20" />
          <circle cx="238" cy="112" r="20" />
        </g>
      )}
      {(slot === 'front' || slot === 'rear') && (
        <g {...dash}>
          <path d="M70 118V84c0-6 3-9 8-11l14-30c3-6 7-8 13-8h110c6 0 10 2 13 8l14 30c5 2 8 5 8 11v34z" />
          <path d="M104 52h112M90 92h20M210 92h20" />
          <circle cx="102" cy="124" r="14" />
          <circle cx="218" cy="124" r="14" />
        </g>
      )}
      {slot === 'interior' && (
        <g {...dash}>
          <path d="M100 120V60c0-8 6-14 14-14h20c8 0 14 6 14 14v60M186 120V60c0-8 6-14 14-14h20c8 0 14 6 14 14v60M90 120h140" />
        </g>
      )}
      {slot === 'dashboard' && (
        <g {...dash}>
          <path d="M40 70c40-20 200-20 240 0v30H40z" />
          <circle cx="110" cy="88" r="22" />
          <circle cx="210" cy="88" r="22" />
        </g>
      )}
    </svg>
  );
}
