import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import { useContractRead } from 'wagmi';

// Read-only convenience hook for token admin state. For writes, use wagmi's
// prepare/write hooks directly in your UI components (see AdminPanel.jsx for example).
export function useTokenAdminReads(tokenAddress, options = {}) {
  const read = (fn, args = []) => useContractRead({
    address: tokenAddress,
    abi: UnrugpadTokenABI.abi,
    functionName: fn,
    args,
    enabled: Boolean(tokenAddress),
    watch: options.watch || false,
  });

  return {
    owner: read('owner'),
    buyFees: read('buyFees'),
    sellFees: read('sellFees'),
    buyFee: read('buyFee'),
    sellFee: read('sellFee'),
    marketingWallet: read('marketingWallet'),
    devWallet: read('devWallet'),
    isFeeExempt: read('isFeeExempt', [options.account || '0x0000000000000000000000000000000000000000']),
    maxTransactionAmount: read('maxTransactionAmount'),
    maxWalletAmount: read('maxWalletAmount'),
    limitsInEffect: read('limitsInEffect'),
    tradingPaused: read('tradingPaused'),
    swapTokensAtAmount: read('swapTokensAtAmount'),
  };
}

export default useTokenAdminReads;
