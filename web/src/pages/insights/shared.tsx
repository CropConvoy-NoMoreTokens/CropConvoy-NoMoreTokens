import { useEffect, useRef, useState } from 'react';
import { Plant } from '@phosphor-icons/react';
import { ApiError } from '../../api/client';

export const money = (minor: number) => new Intl.NumberFormat('en-LK', {
  style:'currency', currency:'LKR', minimumFractionDigits:2, maximumFractionDigits:2,
}).format(minor / 100);
export const monthLabel = (month: string) => new Intl.DateTimeFormat('en', {
  month:'long', year:'numeric', timeZone:'Asia/Colombo',
}).format(new Date(month + '-01T06:00:00Z'));

export function ProduceImage({id, label, eager = false}: {id:string; label:string; eager?:boolean}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  return failed ? <span className="produce-image-fallback"><Plant size={38}/><span>{label}</span></span> :
    <img className="produce-cutout" src={'/images/produce/' + id + '-320.webp'}
      srcSet={'/images/produce/' + id + '-160.webp 160w, /images/produce/' + id + '-320.webp 320w, /images/produce/' + id + '-640.webp 640w'}
      sizes="(max-width: 767px) 35vw, 180px" width="320" height="320" alt=""
      loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>;
}

export function usePrediction<T>() {
  const [result, setResult] = useState<T | null>(null);
  const [signature, setSignature] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const busy = useRef(false);
  useEffect(() => () => { sequence.current++; controller.current?.abort(); busy.current = false; }, []);
  async function run(fn:(signal:AbortSignal) => Promise<T>, inputSignature:string, success?:() => void) {
    if (busy.current) return;
    busy.current = true;
    const seq = ++sequence.current;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setLoading(true); setError(null);
    try {
      const value = await fn(next.signal);
      if (sequence.current !== seq || next.signal.aborted) return;
      setResult(value); setSignature(inputSignature); success?.();
    } catch (err) {
      if (sequence.current === seq && !next.signal.aborted) setError(err);
    } finally {
      if (sequence.current === seq) { busy.current = false; setLoading(false); }
    }
  }
  const fields = error instanceof ApiError ? Object.fromEntries(error.fields.map(f => [f.path, f.message])) : {};
  return {result, signature, error, loading, fields, run};
}
