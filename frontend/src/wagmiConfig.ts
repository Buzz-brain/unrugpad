import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const INFURA_SEPOLIA =
  "https://sepolia.infura.io/v3/7a66e12f0edb43fe938a194a18f3d65b";
// Read WalletConnect project id from Vite env (prefix VITE_). Fallback to previous id if missing.
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "05fdab2df0ec6dedfccb659e16d7b0b5";

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
