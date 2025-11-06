
// import { createConfig, http } from "wagmi";
// import { sepolia } from "wagmi/chains";
// import { injected, walletConnect } from "wagmi/connectors";

// const INFURA_SEPOLIA = import.meta.env.VITE_SEPOLIA_RPC_URL;
// // Read WalletConnect project id from Vite env (prefix VITE_). Fallback to previous id if missing.
// const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// export const wagmiConfig = createConfig({
//   chains: [sepolia] as const,
//   transports: {
//     [sepolia.id]: http(INFURA_SEPOLIA),
//   },
//   connectors: [
//     injected(),
//     walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
//   ],
// });
