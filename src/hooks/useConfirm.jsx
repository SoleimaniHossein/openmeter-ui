import React, { useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

// Small helper for Tailwind-styled confirmation dialogs.
// `requestConfirm(opts)` returns a Promise that resolves to `true` when the
// user confirms, `false` when they cancel (the resolved value is the input
// value when the dialog collects one).
//
// Optional `opts.action`: an async function. When provided, the dialog stays
// open with a loading spinner while it runs, closes on success, and the
// promise rejects with the action's error so callers can handle it in a
// try/catch.
export const useConfirm = () => {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const requestConfirm = useCallback((opts) => {
    return new Promise((resolve, reject) => {
      resolverRef.current = { resolve, reject };
      setState({
        ...opts,
        onConfirm: async (val) => {
          const result = opts.inputLabel ? (val ?? '') : true;
          if (!opts.action) {
            setState(null);
            resolverRef.current = null;
            resolve(result);
            return;
          }
          setState((s) => ({ ...s, loading: true }));
          try {
            await opts.action(val);
            setState(null);
            resolverRef.current = null;
            resolve(result);
          } catch (error) {
            setState(null);
            resolverRef.current = null;
            reject(error);
          }
        },
      });
    });
  }, []);

  const close = useCallback(() => {
    setState(null);
    if (resolverRef.current) {
      const { resolve } = resolverRef.current;
      resolverRef.current = null;
      resolve(false);
    }
  }, []);

  const confirmDialog = state && (
    <ConfirmDialog
      open={!!state}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      icon={state.icon}
      loading={state.loading}
      onConfirm={state.onConfirm}
      onClose={close}
    />
  );

  return { requestConfirm, confirmDialog };
};
