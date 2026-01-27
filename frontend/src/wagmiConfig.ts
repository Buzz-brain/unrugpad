
import { createClient, configureChains } from 'wagmi';
import { bsc, sepolia } from 'wagmi/chains';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';

const BSC_RPC_URL = import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org/';

const { chains, provider, webSocketProvider } = configureChains([
  bsc,
  sepolia,
], [
  jsonRpcProvider({
    rpc: (chain) => {
      if (chain.id === bsc.id) return { http: BSC_RPC_URL };
      if (chain.id === sepolia.id) return { http: SEPOLIA_RPC_URL };
      return null;
    },
  }),
]);

export const wagmiConfig = createClient({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({ chains, options: { projectId: WALLETCONNECT_PROJECT_ID } }),
  ],
  provider,
  webSocketProvider,
});
































// import { createAppKit } from "@reown/appkit-wagmi/react";
// import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";


// const INFURA_SEPOLIA = import.meta.env.VITE_SEPOLIA_RPC_URL;
// const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// // Define Sepolia network in AppKit format
// const SEPOLIA_NETWORK = {
//   id: "eip155:11155111",
//   chainId: 11155111,
//   chainNamespace: "eip155",
//   currency: {
//     name: "SepoliaETH",
//     symbol: "ETH",
//     decimals: 18,
//   },
//   explorerUrl: "https://sepolia.etherscan.io",
//   rpcUrl: INFURA_SEPOLIA,
//   name: "Sepolia",
//   testnet: true,
// };

// // Create the Wagmi adapter
// export const wagmiAdapter = new WagmiAdapter({
//   networks: [SEPOLIA_NETWORK],
//   projectId: WALLETCONNECT_PROJECT_ID,
// });

// // Use wagmiAdapter.wagmiConfig for WagmiProvider
// export const wagmiConfig = wagmiAdapter.wagmiConfig;
// // Initialize Reown AppKit (WalletConnect, social login, etc.)
// export const appKit = createAppKit({
//   adapters: [wagmiAdapter],
//   networks: [SEPOLIA_NETWORK],
//   projectId: WALLETCONNECT_PROJECT_ID,
// });