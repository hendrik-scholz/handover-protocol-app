import { copy } from '../copy';
import { CarIcon } from './Icons';

interface Props {
  plate: string;
  onPlate: (v: string) => void;
  /** capture step: show photo count. result step: show date + mileage. */
  photoCount?: number;
  totalSlots?: number;
  date?: string;
  mileage?: string;
  onMileage?: (v: string) => void;
  mileageFromPhoto?: boolean;
  plateFromPhoto?: boolean;
}

export function VehicleCard({ plate, onPlate, photoCount, totalSlots, date, mileage, onMileage, mileageFromPhoto, plateFromPhoto }: Props) {
  if (date === undefined) {
    return (
      <div className="card vehicle-row">
        <CarIcon className="muted" />
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="plate" className="sr-only">{copy.plate}</label>
          <input id="plate" value={plate} placeholder={copy.platePlaceholder} autoCapitalize="characters"
            maxLength={32} onChange={(e) => onPlate(e.target.value)} />
        </div>
        <span className="muted">{copy.photosCount(photoCount ?? 0, totalSlots ?? 0)}</span>
      </div>
    );
  }
  return (
    <div className="card vehicle-grid">
      <div className="field">
        <label htmlFor="plate">{copy.plate}</label>
        <input id="plate" value={plate} placeholder="—" maxLength={32} onChange={(e) => onPlate(e.target.value)} />
        {plateFromPhoto && <span className="muted small">{copy.plateFromPhoto}</span>}
      </div>
      <div className="field">
        <label htmlFor="date">{copy.date}</label>
        <input id="date" value={date} readOnly />
      </div>
      <div className="field">
        <label htmlFor="mileage">{copy.mileage}</label>
        <input id="mileage" value={mileage ?? ''} placeholder="—" inputMode="numeric"
          onChange={(e) => onMileage?.(e.target.value.replace(/\D/g, ''))} />
        {mileageFromPhoto && <span className="muted small">{copy.mileageFromPhoto}</span>}
      </div>
    </div>
  );
}
