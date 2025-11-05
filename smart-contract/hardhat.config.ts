import dotenv from "dotenv";
dotenv.config();
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      type: "http",
      url: process.env.ALCHEMY_API_URL || "",
      accounts: process.env.PRIVATE_KEY
        ? ([process.env.PRIVATE_KEY] as string[])
        : [],
      chainId: 11155111,
    },
    // Add other networks here if needed
  },
};

module.exports = {
  ...config,
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
