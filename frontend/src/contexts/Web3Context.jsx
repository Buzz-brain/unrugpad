import { createContext, useContext, useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address });
  const [localChainId, setLocalChainId] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.ethereum && window.ethereum.chainId) {
        return parseInt(window.ethereum.chainId, 16);
      }
    } catch (e) {}
    return undefined;
  });

  useEffect(() => {
    // Keep localChainId in sync with wagmi `chain` when available
    if (chain && chain.id) setLocalChainId(chain.id);
  }, [chain]);

  useEffect(() => {
    // Listen for provider chain changes (MetaMask network switch)
    const handler = (chainHex) => {
      try {
        setLocalChainId(parseInt(chainHex, 16));
      } catch (e) {
        setLocalChainId(undefined);
      }
    };
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.on) {
      window.ethereum.on('chainChanged', handler);
    }
    return () => {
      if (typeof window !== 'undefined' && window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('chainChanged', handler);
      }
    };
  }, []);

  const chainId = chain?.id ?? localChainId;

  const value = {
    account: address,
    isConnected,
    connectWallet: (opts) => connect(opts ? { connector: opts.connector } : { connector: connectors[0] }),
    disconnectWallet: disconnect,
    connectors,
    chain,
    chainId,
    balance: balanceData ? balanceData.formatted : "0",
    isConnecting: isPending,
    provider: null,
    signer: null,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};