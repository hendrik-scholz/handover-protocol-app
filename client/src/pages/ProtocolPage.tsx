import { useRef, useState, type Dispatch } from 'react';
import { copy } from '../copy';
import { CoverageNotice } from '../components/CoverageNotice';
import { DamageCard } from '../components/DamageCard';
import { Header } from '../components/Header';
import { PhotoGrid } from '../components/PhotoGrid';
import { SeverityBanner } from '../components/SeverityBanner';
import { SignaturePad, type SignatureGetter } from '../components/SignaturePad';
import { VehicleCard } from '../components/VehicleCard';
import { downloadBlob, exportPdf } from '../api/exportPdf';
import { photoCount, type Action, type State } from '../state';

export function ProtocolPage({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  const { protocol } = state;
  const [inked, setInked] = useState({ handed: false, received: false });
  const [signed, setSigned] = useState(false);
  const getters = useRef<{ handed?: SignatureGetter; received?: SignatureGetter }>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  if (!protocol) return null;

  const ink = (who: 'handed' | 'received') => (has: boolean, getPng: SignatureGetter) => {
    setInked((s) => ({ ...s, [who]: has }));
    getters.current[who] = has ? getPng : undefined;
  };

  const onExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const [handed, received] = await Promise.all([getters.current.handed?.() ?? null, getters.current.received?.() ?? null]);
      const { blob, filename } = await exportPdf({
        photos: state.photos, protocol, plate: state.plate, mileage: state.mileage, remarks: state.remarks,
        signatures: { handed, received },
      });
      downloadBlob(blob, filename);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : copy.errors.export);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="screen result">
      <Header subtitle={copy.stepResult(photoCount(state.photos))} onBack={() => dispatch({ type: 'goCapture' })} />
      <VehicleCard plate={state.plate} onPlate={(value) => dispatch({ type: 'setPlate', value })}
        date={protocol.vehicle.date} mileage={state.mileage}
        plateFromPhoto={protocol.vehicle.plateSource === 'photo' && state.plate === protocol.vehicle.plate}
        mileageFromPhoto={protocol.vehicle.mileageSource === 'photo' && state.mileage === String(protocol.vehicle.mileageKm)}
        onMileage={(value) => dispatch({ type: 'setMileage', value })} />
      <SeverityBanner protocol={protocol} />

      <h2 className="section-title">{copy.photos}</h2>
      <PhotoGrid photos={state.photos} damages={protocol.damages}
        onAdd={(slot) => dispatch({ type: 'goCapture', slot })} />

      {protocol.damages.length > 0 && (
        <>
          <h2 className="section-title">{copy.damages}</h2>
          {protocol.damages.map((d) => (<DamageCard key={d.id} damage={d}
            onRemove={signed ? undefined : () => dispatch({ type: 'removeDamage', id: d.id })} />))}
        </>
      )}
      <CoverageNotice missing={protocol.missingSlots} />

      <h2 className="section-title">{copy.remarks}</h2>
      <textarea className="card remarks" rows={3} value={state.remarks} disabled={signed}
        placeholder={copy.remarksPlaceholder} onChange={(e) => dispatch({ type: 'setRemarks', value: e.target.value })} />

      <div className="sig-row">
        <SignaturePad label={copy.handedOverBy} locked={signed} onChange={ink('handed')} />
        <SignaturePad label={copy.receivedBy} locked={signed} onChange={ink('received')} />
      </div>

      <button className="btn-primary" disabled={signed || !inked.handed || !inked.received} onClick={() => setSigned(true)}>
        {signed ? copy.signed : copy.confirmSign}
      </button>
      <button className="btn-secondary" disabled={exporting} onClick={onExport}>
        {exporting ? copy.exporting : copy.exportPdf}
      </button>
      {exportError && <div className="banner warn" role="alert">{exportError}</div>}
      <p className="muted small center">{copy.disclaimer}</p>
    </main>
  );
}
