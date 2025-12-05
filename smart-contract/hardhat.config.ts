
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";

// Add a small module augmentation so TypeScript knows about the `etherscan` config
declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    etherscan?: {
      apiKey?: Record<string, string | ConfigurationVariable | undefined>;
    };
  }

  export interface HardhatConfig {
    etherscan?: {
      apiKey?: Record<string, string | ConfigurationVariable | undefined>;
    };
  }
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
      {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    sepolia: {
      type: "http",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    // Add other networks here if needed
  },
  etherscan: {
    apiKey: {
      bsc: configVariable("BSCSCAN_API_KEY")
    }
  }
};

export default config;
