import { copy } from '../copy';
import { capturedSlots, type Photos, type Protocol } from '../state';

export class ExportError extends Error {}

export interface ExportInput {
  photos: Photos;
  protocol: Protocol;
  plate: string;
  mileage: string;
  remarks: string;
  signatures: { handed: Blob | null; received: Blob | null };
}

/** The server is stateless, so everything the PDF needs is sent again; it keeps nothing. */
export function buildExportForm({ photos, protocol, plate, mileage, remarks, signatures }: ExportInput): FormData {
  const form = new FormData();
  if (plate.trim()) form.append('plate', plate.trim());
  if (mileage.trim()) form.append('mileageKm', mileage.trim());
  form.append('date', protocol.vehicle.date);
  if (remarks.trim()) form.append('remarks', remarks);
  form.append('damages', JSON.stringify(protocol.damages.map(({ id: _id, ...d }) => d)));
  for (const slot of capturedSlots(photos)) form.append(slot, photos[slot]!, `${slot}.jpg`);
  if (signatures.handed) form.append('signatureHanded', signatures.handed, 'handed.png');
  if (signatures.received) form.append('signatureReceived', signatures.received, 'received.png');
  return form;
}

export async function exportPdf(input: ExportInput): Promise<{ blob: Blob; filename: string }> {
  let res: Response;
  try {
    res = await fetch('/api/export', { method: 'POST', body: buildExportForm(input) });
  } catch {
    throw new ExportError(copy.errors.network);
  }
  if (!res.ok) {
    let code = '';
    try {
      code = (await res.json()).error?.code ?? '';
    } catch {
      /* non-JSON error body */
    }
    throw new ExportError(copy.errors[code] ?? copy.errors.export);
  }
  const filename = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'handover-protocol.pdf';
  return { blob: await res.blob(), filename };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
