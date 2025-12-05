// smart-contract/scripts/verifyProxy.js
// Usage: npx hardhat run --network <network> scripts/verifyProxy.js -- <proxyAddress> <arg1> <arg2> ...

const { ethers, run } = require("hardhat");

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  const args = process.argv.slice(2);
  // If called with Hardhat, args after '--' will be in process.argv
  // Find index of '--' if present
  const dashIndex = args.indexOf('--');
  const scriptArgs = dashIndex >= 0 ? args.slice(dashIndex + 1) : args;

  if (scriptArgs.length < 1) {
    console.error("Usage: npx hardhat run --network <network> scripts/verifyProxy.js -- <proxyAddress> <constructorArg1> <constructorArg2> ...");
    process.exit(1);
  }

  const proxyAddress = scriptArgs[0];
  const constructorArgs = scriptArgs.slice(1).map((a) => {
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

  console.log('verifyProxy.js received proxyAddress:', proxyAddress);
  console.log('verifyProxy.js parsed constructorArgs:', constructorArgs);

  // Fetch implementation address from proxy
  const implStorage = await ethers.provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
  const implementation = "0x" + implStorage.slice(-40);
  console.log("Implementation contract address:", implementation);

  // Run Hardhat verify for the implementation contract
  try {
    await run("verify:verify", {
      address: implementation,
      constructorArguments: constructorArgs,
      contract: "contracts/UnrugpadToken.sol:UnrugpadToken"
    });
    console.log("Implementation contract verified on BscScan!");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
