import { copy } from '../copy';
import { FlashIcon, ImageIcon } from './Icons';

interface Props {
  onGallery: () => void;
  onShutter: () => void;
  onFlash: () => void;
  flashSupported: boolean;
  flashOn: boolean;
}

export function ShutterBar({ onGallery, onShutter, onFlash, flashSupported, flashOn }: Props) {
  return (
    <div className="shutter-bar">
      <button className="icon-btn" onClick={onGallery} aria-label={copy.gallery}><ImageIcon /></button>
      <button className="shutter" onClick={onShutter} aria-label={copy.shutter}><span /></button>
      <button className="icon-btn" onClick={onFlash} disabled={!flashSupported} aria-pressed={flashOn}
        aria-label={copy.flash}><FlashIcon /></button>
    </div>
  );
}
