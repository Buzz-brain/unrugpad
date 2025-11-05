// // scripts/deploy.js

// // Export default function so Hardhat will call it with the Hardhat Runtime Environment (hre)
// export default async function (hre) {
// 	console.log(`Running deploy script — network: ${hre.network.name}`);
// 	const UnrugpadToken = await hre.ethers.getContractFactory("UnrugpadToken");
// 	console.log('Got contract factory for UnrugpadToken');
// 	const instance = await UnrugpadToken.deploy(/* constructor args if any */);
// 	console.log('Deploy transaction sent, waiting for deployment...');
// 	await instance.deployed();
// 	console.log("UnrugpadToken deployed to:", instance.address);
// }

// scripts/deploy.js
import fs from "fs";
import path from "path";

console.log('scripts/deploy.js loaded');

async function deploy(hre) {
  console.log("--- Starting UnrugpadToken deployment (function) ---");
  try {
    const UnrugpadToken = await hre.ethers.getContractFactory("UnrugpadToken");
    console.log("Got contract factory for UnrugpadToken");
    // TODO: Add constructor args if needed
    const instance = await UnrugpadToken.deploy();
    console.log("Deploy transaction sent, waiting for deployment...");
    await instance.deployed();
    console.log("UnrugpadToken deployed to:", instance.address);

    // Save deployed address to backend/deployed_addresses.json
    const addressesPath = path.join(
      __dirname,
      "../../backend/deployed_addresses.json"
    );
    let addresses = {};
    if (fs.existsSync(addressesPath)) {
      addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    }
    addresses[hre.network.name] = { UnrugpadToken: instance.address };
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`Saved deployed address to ${addressesPath}`);
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

export default deploy;

// Auto-invoke deploy when the script is imported directly by Hardhat's runner
(async () => {
  try {
    const hre = await import('hardhat');
    if (hre && hre.network) {
      console.log('Auto-invoking deploy using dynamic hardhat import — network:', hre.network.name);
      await deploy(hre);
    }
  } catch (e) {
    // It's OK if this fails when Hardhat manages execution differently
    console.log('Auto-deploy skipped or failed (this is fine if running under hardhat run):', e && e.message ? e.message : e);
  }
})();