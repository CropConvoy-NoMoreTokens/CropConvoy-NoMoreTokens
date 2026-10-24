import { cloneElement, isValidElement, useRef, useState, useEffect, lazy, Suspense, type ReactNode, type ReactElement } from 'react';
import { CopySimple, Check, WarningCircle } from '@phosphor-icons/react';
import { m as motion, useReducedMotion } from 'motion/react';
import { ApiError } from '../api/client';
import { useApp } from '../state/AppContext';
export type ModalProps = { open: boolean; onOpenChange(open: boolean): void; title: string; description?: string; children: ReactNode; className?: string };
const LazyDialog = lazy(() => import('./Dialog'));
export function Modal(props: ModalProps) {
  const seen = useRef(false);
  if (props.open) seen.current = true;
  if (!seen.current) return null;
  return <Suspense fallback={<span className="dialog-loading" role="status">Opening dialog…</span>}><LazyDialog {...props} /></Suspense>;
}
export function Confirm({ open, onClose, onConfirm, title, children, label = 'Confirm', busy = false }: { open: boolean; onClose(): void; onConfirm(): void; title: string; children: ReactNode; label?: string; busy?: boolean }) {
  return <Modal open={open} onOpenChange={value => { if (!value && !busy) onClose(); }} title={title}><div className="dialog-body">{children}</div><div className="button-row"><button className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : label}</button></div></Modal>;
}
export function Field({ name, label, error, hint, children }: { name: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const control = isValidElement(children) && typeof children.type === 'string' && ['input', 'select', 'textarea'].includes(children.type) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id: name, name, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${name}-error` : hint ? `${name}-hint` : undefined }) : children;
  return <div className={`field ${error ? 'has-error' : ''}`}><label htmlFor={name}>{label}</label>{control}{error ? <p className="field-error" id={`${name}-error`}>{error}</p> : hint ? <p className="field-hint" id={`${name}-hint`}>{hint}</p> : null}</div>;
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return <div className="notice notice-error" role="alert"><WarningCircle size={22} /><div><strong>{error instanceof ApiError && error.status === 409 ? 'This proposal needs attention' : 'Something needs your attention'}</strong><p>{error instanceof Error ? error.message : String(error)}</p>{error instanceof ApiError && error.requestId && <small>Reference: {error.requestId}</small>}{retry && <button className="text-button" onClick={retry}>Try again</button>}</div></div>;
}
export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const items = Object.entries(errors);
  if (!items.length) return null;
  return <div className="notice notice-error" role="alert" tabIndex={-1}><WarningCircle /><div><strong>Please check {items.length === 1 ? 'this field' : 'these fields'}</strong><ul>{items.map(([field, error]) => <li key={field}><a href={`#${field}`} onClick={event => { event.preventDefault(); document.getElementById(field)?.focus(); }}>{error}</a></li>)}</ul></div></div>;
}
export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const { notify } = useApp();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); setFailed(false); setCopied(true); notify(`${label} completed.`); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); setFailed(true); notify('Copy is unavailable in this browser. Select the visible text and copy it manually.'); }
  }
  return <span className="copy-wrap"><button type="button" className={`copy-button ${className}`} onClick={copy} aria-label={label}>{copied ? <Check /> : <CopySimple />}<span>{copied ? 'Copied' : label}</span></button>{failed && <span className="copy-fallback" role="status" tabIndex={0}>Copy manually: {text}</span>}</span>;
}
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .55, delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}
export function Skeleton({ label = 'Loading…' }: { label?: string }) { return <div className="skeleton-group" role="status" aria-label={label}><span className="skeleton" /><span className="skeleton" /><span className="skeleton short" /><span className="sr-only">{label}</span></div>; }
