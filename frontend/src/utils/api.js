import axios from 'axios';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import { BrowserProvider, Contract, parseUnits } from 'ethers';

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
      const provider = new BrowserProvider(window.ethereum);
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
    const browserProvider = new BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(tokenAddress, UnrugpadTokenABI.abi, signer || browserProvider);

    if (action === 'transfer') {
      // amount expected in human units (e.g. '1.5')
      const value = typeof amount === 'string' ? amount : String(amount);
      const tx = await contract.transfer(to, parseUnits(value, 18));
      await tx.wait();
      return { txHash: tx.hash };
    }

    if (action === 'approve') {
      const value = typeof amount === 'string' ? amount : String(amount);
      const tx = await contract.approve(spender, parseUnits(value, 18));
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

export default api;
