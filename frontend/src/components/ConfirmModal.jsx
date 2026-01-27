import React from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title = 'Confirm Transaction', children, details }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="text-sm text-gray-300">{children}</div>
        {details && (
          <div className="text-xs text-gray-400">
            <div>Estimated Gas: {details.gas ? details.gas.toString() : '—'}</div>
            <div>Estimated Cost: {details.cost || '—'}</div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={onConfirm} className="flex-1">Confirm</Button>
        </div>
      </div>
    </Modal>
  );
}
