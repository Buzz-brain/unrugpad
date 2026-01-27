import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function EditModal({ isOpen, onClose, title, initialValue = '', onConfirm, confirmLabel = 'Save', children, validate }) {
  const [value, setValue] = useState(initialValue);

  // update internal value when initialValue changes
  React.useEffect(() => setValue(initialValue), [initialValue]);

  const validation = typeof validate === 'function' ? validate(value) : { valid: true };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {children ? (
          children({ value, setValue })
        ) : (
          <input
            className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        {validation && validation.message && (
          <div className="text-xs text-red-400">{validation.message}</div>
        )}

        <div className="flex gap-2 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(value)}
            className="flex-1"
            disabled={!validation.valid}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
