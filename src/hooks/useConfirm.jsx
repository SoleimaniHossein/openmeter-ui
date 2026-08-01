import React, { useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

// Small helper for Tailwind-styled confirmation dialogs.
// `requestConfirm(opts)` returns a Promise that resolves to `true` when the
// user confirms, `false` when they cancel.
export const useConfirm = () => {
  const [state, setState] = useState(null);

  const requestConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        ...opts,
        onConfirm: () => {
          resolve(true);
          setState(null);
        },
      });
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  const confirmDialog = state && (
    <ConfirmDialog
      open={!!state}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      icon={state.icon}
      onConfirm={state.onConfirm}
      onClose={close}
    />
  );

  return { requestConfirm, confirmDialog };
};
