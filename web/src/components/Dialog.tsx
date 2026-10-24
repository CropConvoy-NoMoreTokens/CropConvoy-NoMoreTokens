import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import type { ModalProps } from './ui';
export default function DialogContent({ open, onOpenChange, title, description, children, className = '' }: ModalProps) {
  const previous = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  if (open && !previous.current) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previous.current = open;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className={`modal ${className}`} onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); }}>
    <div className="modal-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close dialog"><X /></Dialog.Close></div>
    {description ? <Dialog.Description className="muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}{children}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
