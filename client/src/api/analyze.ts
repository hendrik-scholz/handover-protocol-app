import { copy } from '../copy';
import { capturedSlots, type Photos, type Protocol } from '../state';

export class AnalyzeError extends Error {}

export async function analyze(
  photos: Photos,
  vehicle: { plate: string; mileage: string },
  signal?: AbortSignal,
): Promise<Protocol> {
  const form = new FormData();
  if (vehicle.plate.trim()) form.append('plate', vehicle.plate.trim());
  if (vehicle.mileage.trim()) form.append('mileageKm', vehicle.mileage.trim());
  for (const slot of capturedSlots(photos)) {
    form.append(slot, photos[slot]!, `${slot}.jpg`);
  }

  let res: Response;
  try {
    res = await fetch('/api/analyze', { method: 'POST', body: form, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new AnalyzeError(copy.errors.network);
  }

  if (!res.ok) {
    let code = '';
    try {
      code = (await res.json()).error?.code ?? '';
    } catch {
      /* non-JSON error body */
    }
    throw new AnalyzeError(copy.errors[code] ?? copy.errors.generic);
  }
  return (await res.json()) as Protocol;
}
