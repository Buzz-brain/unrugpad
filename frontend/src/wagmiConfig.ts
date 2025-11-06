import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const INFURA_SEPOLIA =
  "https://sepolia.infura.io/v3/7a66e12f0edb43fe938a194a18f3d65b";
const WALLETCONNECT_PROJECT_ID = "ab50b5347de98a540ac2bcfe58b9ed10";

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
