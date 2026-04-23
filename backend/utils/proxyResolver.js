const { ethers } = require("ethers");
const cache = require("./cache");

const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Explicit network object — prevents ethers from auto-detecting (eth_chainId handshake
// fails in some environments even when the RPC is reachable)
const BSC_NETWORK = { name: "bnb", chainId: 56 };

async function getProvider() {
  const rpc = process.env.BSC_RPC_URL;
  if (!rpc) throw new Error("[proxyResolver] BSC_RPC_URL is not set in .env");

  const provider = new ethers.providers.JsonRpcProvider(
    { url: rpc, timeout: 15_000 },
    BSC_NETWORK, // skip auto-detect
  );

  // Quick liveness check
  await provider.getBlockNumber();
  return provider;
}

async function getImplementationAddress(proxyAddress) {
  const key = `impl:${proxyAddress.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const provider = await getProvider();

  const storage = await provider.getStorageAt(
    proxyAddress,
    IMPLEMENTATION_SLOT,
  );
  if (!storage || storage === "0x" || /^0x0+$/.test(storage)) return null;

  // Storage is 32 bytes; implementation address is right-aligned (last 20 bytes)
  const implHex = "0x" + storage.slice(-40);
  try {
    const impl = ethers.utils.getAddress(implHex);
    if (impl === ethers.constants.AddressZero) return null;
    cache.set(key, impl, 60 * 60);
    return impl;
  } catch (err) {
    return null;
  }
}

module.exports = {
  getImplementationAddress,
};