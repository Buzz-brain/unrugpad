// backend/verifyProxy.js
// Usage: node backend/verifyProxy.js <proxyAddress> <arg1> <arg2> ...

const { ethers, run } = require("hardhat");

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node backend/verifyProxy.js <proxyAddress> <constructorArg1> <constructorArg2> ...");
    process.exit(1);
  }
  const proxyAddress = args[0];
  // Parse constructor args: JSON strings (arrays/objects) will be parsed back to JS types
  const constructorArgs = args.slice(1).map((a) => {
    if (a === 'true') return true;
    if (a === 'false') return false;
    if (a && (a.startsWith('{') || a.startsWith('['))) {
      try {
        return JSON.parse(a);
      } catch (e) {
        return a;
      }
    }
    return a;
  });

  // Fetch implementation address from proxy
  const implStorage = await ethers.provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
  const implementation = "0x" + implStorage.slice(-40);
  console.log("Implementation contract address:", implementation);

  // Run Hardhat verify for the implementation contract
  try {
    console.log('Running verify with constructorArguments:', constructorArgs);
    await run("verify:verify", {
      address: implementation,
      constructorArguments: constructorArgs,
      contract: "contracts/UnrugpadToken.sol:UnrugpadToken"
    });
    console.log("Implementation contract verified on BscScan!");
  } catch (err) {
    console.error("Verification failed:", err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
