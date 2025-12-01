import React, { createContext, useContext, useState, useCallback } from 'react';

const WalletModalContext = createContext({
  show: false,
  error: '',
  loading: false,
  open: () => {},
  close: () => {},
    setError: (_msg) => {},
    setLoading: (_b) => {},
});

export const WalletModalProvider = ({ children }) => {
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const open = useCallback(() => setShow(true), []);
  const close = useCallback(() => {
    setShow(false);
    setError('');
    setLoading(false);
  }, []);

  return (
    <WalletModalContext.Provider value={{ show, error, loading, open, close, setError, setLoading }}>
      {children}
    </WalletModalContext.Provider>
  );
};

export const useWalletModal = () => useContext(WalletModalContext);
