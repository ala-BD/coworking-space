// components/ui/ConfirmDialog.jsx
import React from 'react';
import { Modal } from './Modal';

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmer', cancelText = 'Annuler', variant = 'danger' }) {
  const footer = (
    <div className="d-flex justify-content-end gap-2 w-100">
      <button type="button" className="btn btn-light" onClick={onClose}>
        {cancelText}
      </button>
      <button type="button" className={`btn btn-${variant}`} onClick={() => { onConfirm(); onClose(); }}>
        {confirmText}
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Confirmation'} footer={footer} size="sm">
      <p className="mb-0 text-muted">{message || 'Êtes-vous sûr de vouloir effectuer cette action ?'}</p>
    </Modal>
  );
}
