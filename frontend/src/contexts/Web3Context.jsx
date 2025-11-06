import { createContext, useContext } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useChainId } from 'wagmi';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address });
  const chainId = useChainId();

  const value = {
    account: address,
    isConnected,
    connectWallet: (opts) => connect(opts ? { connector: opts.connector } : { connector: connectors[0] }),
    disconnectWallet: disconnect,
    connectors,
    chainId,
    balance: balanceData ? balanceData.formatted : "0",
    isConnecting: isPending,
    provider: null,
    signer: null,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};