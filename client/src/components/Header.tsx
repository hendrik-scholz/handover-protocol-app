import { copy } from '../copy';
import { BackIcon } from './Icons';

export function Header({ subtitle, onBack }: { subtitle: string; onBack?: () => void }) {
  return (
    <header className="header">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label={copy.back}><BackIcon /></button>
      ) : (
        <span className="icon-btn" style={{ visibility: 'hidden' }} />
      )}
      <div>
        <h1>{copy.appTitle}</h1>
        <p className="muted">{subtitle}</p>
      </div>
    </header>
  );
}
