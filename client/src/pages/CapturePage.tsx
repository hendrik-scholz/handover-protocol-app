import { useRef, type ChangeEvent, type Dispatch } from 'react';
import { copy } from '../copy';
import { useCamera } from '../hooks/useCamera';
import { ArrowIcon } from '../components/Icons';
import { Header } from '../components/Header';
import { ShutterBar } from '../components/ShutterBar';
import { SlotChips } from '../components/SlotChips';
import { VehicleCard } from '../components/VehicleCard';
import { Viewfinder } from '../components/Viewfinder';
import { photoCount, SLOTS, type Action, type State } from '../state';

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
  onAnalyze: () => void;
  onCancel: () => void;
  onBack?: () => void;
}

export function CapturePage({ state, dispatch, onAnalyze, onCancel, onBack }: Props) {
  const camera = useCamera();
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const count = photoCount(state.photos);
  const { status, error } = state.analysis;

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    let idx = SLOTS.indexOf(state.activeSlot);
    for (const blob of files.slice(0, SLOTS.length)) {
      dispatch({ type: 'setPhoto', slot: SLOTS[idx % SLOTS.length], blob });
      idx++;
    }
  };

  const shutter = async () => {
    if (camera.ready) {
      const blob = await camera.capture();
      if (blob) dispatch({ type: 'setPhoto', slot: state.activeSlot, blob });
    } else {
      cameraInput.current?.click();
    }
  };

  return (
    <main className="screen capture">
      <Header subtitle={copy.stepCapture} onBack={onBack} />
      <VehicleCard plate={state.plate} onPlate={(value) => dispatch({ type: 'setPlate', value })}
        photoCount={count} totalSlots={SLOTS.length} />
      <Viewfinder slot={state.activeSlot} videoRef={camera.videoRef} cameraReady={camera.ready}
        cameraFailed={camera.failed} photo={state.photos[state.activeSlot]} />
      <SlotChips photos={state.photos} active={state.activeSlot}
        onSelect={(slot) => dispatch({ type: 'setActiveSlot', slot })} />
      <ShutterBar onGallery={() => galleryInput.current?.click()} onShutter={shutter} onFlash={camera.toggleTorch}
        flashSupported={camera.torchSupported} flashOn={camera.torchOn} />
      <input ref={galleryInput} type="file" accept="image/*" multiple hidden data-testid="gallery-input" onChange={onFiles} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden data-testid="camera-input" onChange={onFiles} />

      {status === 'error' && (
        <div className="banner warn" role="alert">
          <div><strong>{error}</strong></div>
        </div>
      )}
      <button className="btn-primary cta" disabled={count === 0 || status === 'loading'} onClick={onAnalyze}>
        {status === 'error' ? copy.retry : copy.analyze(count)} <ArrowIcon />
      </button>

      {status === 'loading' && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={copy.analyzing}>
          <div className="spinner" />
          <p><strong>{copy.analyzing}</strong></p>
          <p className="muted">{copy.analyzingHint}</p>
          <button className="btn-secondary" style={{ maxWidth: 200 }} onClick={onCancel}>{copy.cancel}</button>
        </div>
      )}
    </main>
  );
}
