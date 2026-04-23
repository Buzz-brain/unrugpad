import axios from 'axios';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import { Contract, providers, utils } from 'ethers';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const deployToken = async (tokenData) => {
  // Server-side deploy is disabled in production; keep for local/dev usage if needed
  const response = await api.post('/deploy', tokenData);
  return response.data;
};

export const getTokenInfo = async (address) => {
  // Try backend first (returns cached info), fallback to on-chain read via MetaMask provider
  try {
    const response = await api.get(`/tokens/${address}`);
    return response.data;
  } catch (e) {
    // Fallback: read minimal on-chain info using MetaMask provider if available
    if (typeof window !== 'undefined' && window.ethereum) {
      const provider = new providers.Web3Provider(window.ethereum);
      const contract = new Contract(address, UnrugpadTokenABI.abi, provider);
      const [name, symbol, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.totalSupply(),
      ]);
      return { name, symbol, totalSupply: totalSupply.toString() };
    }
    throw e;
  }
};

export const interactWithToken = async (interactionData) => {
  // Use MetaMask (client-side) to sign and send txs when available
  const { action, tokenAddress, to, amount, spender, address } = interactionData;

  if (typeof window !== 'undefined' && window.ethereum) {
  const browserProvider = new providers.Web3Provider(window.ethereum);
  const signer = browserProvider.getSigner();
  const contract = new Contract(tokenAddress, UnrugpadTokenABI.abi, signer || browserProvider);

    if (action === 'transfer') {
      // amount expected in human units (e.g. '1.5')
      const value = typeof amount === 'string' ? amount : String(amount);
      const tx = await contract.transfer(to, utils.parseUnits(value, 18));
      await tx.wait();
      return { txHash: tx.hash };
    }

    if (action === 'approve') {
      const value = typeof amount === 'string' ? amount : String(amount);
      const tx = await contract.approve(spender, utils.parseUnits(value, 18));
      await tx.wait();
      return { txHash: tx.hash };
    }

    if (action === 'balanceOf') {
      const bal = await contract.balanceOf(address);
      return { balance: bal.toString() };
    }
  }

  // Fallback to backend if no MetaMask available
  const response = await api.post('/interact', interactionData);
  return response.data;
};

const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_API_KEY || "";

/**
 * Called right after deployment on the Result page.
 * Fires in background and the backend handles everything — no sourceCode needed from frontend.
 */
export const triggerVerification = async (proxyAddress, initCalldata = undefined) => {
  const postWithRetries = async (url, body, attempts = 3, delayMs = 1000) => {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const resp = await api.post(url, body, { headers: { "x-internal-key": INTERNAL_KEY } });
        return resp;
      } catch (err) {
        lastErr = err;
        const backoff = delayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastErr;
  };

  const body = initCalldata ? { proxyAddress, initCalldata } : { proxyAddress };
  const resp = await postWithRetries("/api/verify-proxy", body, 3, 1000);
  return resp; // { status, data }
  // Returns: { status: "verified" | "already_verified", implAddress, explorerUrl }
};

/**
 * Check if a contract address is verified on BscScan.
 * Use this to show/hide the verified badge on token cards.
 */
export const checkVerificationStatus = async (address) => {
  const response = await api.get(
    `/api/verify-status/${address}`,
    { headers: { "x-internal-key": INTERNAL_KEY } }
  );
  return response.data;
  // Returns: { address, verified: bool, explorerUrl: string | null }
};

export default api;
