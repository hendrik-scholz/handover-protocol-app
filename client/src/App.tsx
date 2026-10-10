import { useCallback, useReducer, useRef } from 'react';
import { analyze, AnalyzeError } from './api/analyze';
import { copy } from './copy';
import { CapturePage } from './pages/CapturePage';
import { ProtocolPage } from './pages/ProtocolPage';
import { initialState, reducer } from './state';

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abort = useRef<AbortController | null>(null);

  const onAnalyze = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    dispatch({ type: 'analyzeStart' });
    try {
      const protocol = await analyze(state.photos, { plate: state.plate, mileage: state.mileage }, controller.signal);
      dispatch({ type: 'analyzeSuccess', protocol });
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({ type: 'analyzeError', message: err instanceof AnalyzeError ? err.message : copy.errors.generic });
    }
  }, [state.photos, state.plate, state.mileage]);

  const onCancel = useCallback(() => {
    abort.current?.abort();
    dispatch({ type: 'analyzeCancel' });
  }, []);

  return state.step === 'capture' ? (
    <CapturePage state={state} dispatch={dispatch} onAnalyze={onAnalyze} onCancel={onCancel} />
  ) : (
    <ProtocolPage state={state} dispatch={dispatch} />
  );
}
