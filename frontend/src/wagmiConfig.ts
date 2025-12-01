
import { createConfig, http } from "wagmi";
import { bsc, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const BSC_RPC_URL = import.meta.env.VITE_BSC_RPC_URL;
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [bsc, sepolia] as const,
  transports: {
    [bsc.id]: http(BSC_RPC_URL),
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  connectors: [
    injected(),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
  ],
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