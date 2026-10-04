import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const BackIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>);
export const CarIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 16V12l2-5h10l2 5v4M3 16h18M7 16v2M17 16v2" /><circle cx="8" cy="13" r=".6" /><circle cx="16" cy="13" r=".6" /></svg>);
export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-5 4 4 3-3 4 4" /></svg>);
export const FlashIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg>);
export const ClockIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} width={14} height={14}><path d="M5 12l5 5 9-10" /></svg>);
export const CameraIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const ArrowIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const WarnIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></svg>);
export const InfoIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></svg>);
