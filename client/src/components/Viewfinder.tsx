import type { RefObject } from 'react';
import { copy, SLOT_LABELS, SLOT_TIPS } from '../copy';
import type { Slot } from '../state';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { CarOutline } from './CarOutline';
import { ClockIcon } from './Icons';

interface Props {
  slot: Slot;
  videoRef: RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  cameraFailed: boolean;
  photo?: Blob;
}

export function Viewfinder({ slot, videoRef, cameraReady, cameraFailed, photo }: Props) {
  const url = useObjectUrl(photo);
  return (
    <section className="card viewfinder">
      <div className="viewfinder-top">
        <span className="pill-dark">{SLOT_LABELS[slot]}</span>
        <span className="muted light"><ClockIcon width={18} height={18} /> {copy.goodLight}</span>
      </div>
      <div className="frame">
        <video ref={videoRef} playsInline muted className="video" hidden={!cameraReady || Boolean(url)} />
        {url && <img src={url} alt={`${SLOT_LABELS[slot]} photo`} className="video" />}
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        {!url && <CarOutline slot={slot} />}
      </div>
      <p className="muted tip">
        {url ? copy.retake : cameraFailed ? copy.cameraUnavailable : SLOT_TIPS[slot]}
      </p>
    </section>
  );
}
