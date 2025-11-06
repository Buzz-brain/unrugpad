import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const INFURA_SEPOLIA = import.meta.env.VITE_SEPOLIA_RPC_URL;
// Read WalletConnect project id from Vite env (prefix VITE_). Fallback to previous id if missing.
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [sepolia] as const,
  transports: {
    [sepolia.id]: http(INFURA_SEPOLIA),
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