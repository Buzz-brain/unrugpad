import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { WagmiConfig } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmiConfig";

const queryClient = new QueryClient();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <WagmiConfig client={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiConfig>
  );
}
