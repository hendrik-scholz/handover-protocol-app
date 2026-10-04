import { useEffect, useRef } from 'react';
import { copy } from '../copy';

export function SignaturePad({ label, locked, onChange }: { label: string; locked: boolean; onChange: (hasInk: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#f3f5f8';
    }
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    if (locked) return;
    drawing.current = true;
    ref.current!.setPointerCapture?.(e.pointerId);
    const ctx = ref.current!.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(...pos(e));
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d');
    ctx?.lineTo(...pos(e));
    ctx?.stroke();
    if (!inked.current) { inked.current = true; onChange(true); }
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    inked.current = false;
    onChange(false);
  };

  return (
    <div className="sig">
      <canvas ref={ref} aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div className="sig-foot">
        <span className="muted small">{label}</span>
        {!locked && <button className="link" onClick={clear}>{copy.clear}</button>}
      </div>
    </div>
  );
}
