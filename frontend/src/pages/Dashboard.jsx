import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Coins, Send, CheckCircle, Eye, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

// --- AdvancedTokenDetailsModal: Modal-based advanced info section ---
import { ChevronRight } from 'lucide-react';

function AdvancedTokenDetailsModal({ token, isOpen, onClose }) {
  if (!token) return null;
  const advancedFields = [
    { label: 'Buy Fee', value: token.buyFee },
    { label: 'Sell Fee', value: token.sellFee },
    { label: 'Buy Fees (Struct)', value: token.buyFees && typeof token.buyFees === 'object' ? JSON.stringify(token.buyFees) : token.buyFees },
    { label: 'Sell Fees (Struct)', value: token.sellFees && typeof token.sellFees === 'object' ? JSON.stringify(token.sellFees) : token.sellFees },
    { label: 'Platform Fee', value: token.platformFee },
    { label: 'Total Buy Fee', value: token.getTotalBuyFee },
    { label: 'Total Sell Fee', value: token.getTotalSellFee },
    { label: 'Max Transaction Amount', value: token.maxTransactionAmount },
    { label: 'Max Wallet Amount', value: token.maxWalletAmount },
    { label: 'Limits In Effect', value: token.limitsInEffect ? 'Yes' : 'No' },
    { label: 'Marketing Wallet', value: token.marketingWallet },
    { label: 'Dev Wallet', value: token.devWallet },
    { label: 'Platform Wallet', value: token.platformWallet },
    { label: 'Factory', value: token.factory },
    { label: 'DEX Pair', value: token.pancakePair },
    { label: 'DEX Router', value: token.pancakeRouter },
    { label: 'Deployment Metadata', value: token.deploymentMetadata },
    { label: 'Circulating Supply', value: token.circulatingSupply },
    { label: 'Swap Tokens At Amount', value: token.swapTokensAtAmount },
    { label: 'Tokens For Marketing', value: token.tokensForMarketing },
    { label: 'Tokens For Dev', value: token.tokensForDev },
    { label: 'Tokens For Liquidity', value: token.tokensForLiquidity },
    { label: 'Tokens For Platform', value: token.tokensForPlatform },
    { label: 'Tokens For Buy Fee', value: token.tokensForBuyFee },
    { label: 'Tokens For Sell Fee', value: token.tokensForSellFee },
    { label: 'Version', value: token.version },
    { label: 'Fee Exempt (You)', value: token.isFeeExempt ? 'Yes' : 'No' },
    { label: 'Excluded From Fees (You)', value: token.userIsFeeExempt ? 'Yes' : 'No' }
  ];
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Advanced Details: ${token.symbol}`} size="lg">
      <div className="space-y-2">
        <div className="flex flex-col gap-2">
          {advancedFields.map((field, idx) => (
            field.value !== undefined && field.value !== null && field.value !== '' && (
              <div key={idx} className="flex justify-between text-sm border-b border-gray-800 pb-1">
                <span className="text-gray-400">{field.label}:</span>
                <span className="text-white font-mono text-right break-all max-w-[60%]">{field.value}</span>
              </div>
            )
          ))}
        </div>
      </div>
    </Modal>
  );
}
import { toast } from 'react-toastify';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import Skeleton from '../components/Skeleton';
import { useWalletModal } from '../contexts/WalletModalContext';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import UnrugpadTokenFactoryABI from '../abis/UnrugpadTokenFactory.json';
import { interactWithToken } from '../utils/api';
// import { getTokenInfo, interactWithToken } from '../utils/api';
import Modal from '../components/Modal';

const Dashboard = () => {
  const { isConnected, account, provider, signer, chainId } = useWeb3();
  // --- Modal state for advanced details ---
  const [advancedModalToken, setAdvancedModalToken] = useState(null);
  // Log chainId for debugging
  // console.log('Current chainId:', chainId);

  // Show warning if not on BSC mainnet
  const showWrongNetworkWarning = isConnected && chainId !== 56;
  const [tokens, setTokens] = useState([]);
  const [liveTokenDetails, setLiveTokenDetails] = useState([]);
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  // Removed local wallet modal state, now using global WalletModalContext
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const [transferData, setTransferData] = useState({ to: '', amount: '' });
  const [approveData, setApproveData] = useState({ spender: '', amount: '' });
  const [balanceAddress, setBalanceAddress] = useState('');
  // Modal state for transfer/approve/balance
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('transfer');

  const { open: openWalletModal } = useWalletModal();
  // Fetch tokens function for manual refresh and useEffect
  const fetchTokens = async () => {
    if (!account) return;
    if (chainId !== 56) return;
    setIsFetchingTokens(true);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    try {
      const res = await fetch(`${apiBaseUrl}/deployed_addresses.json`);
      const data = await res.json();
      const factoryAddress = data.factory;
      // Log factory address separately for clarity
      console.log("[DASHBOARD] Factory address:", factoryAddress);
      if (!factoryAddress) {
        setTokens([]);
        setGlobalError('Factory contract address not found. Please check your backend configuration.');
        return;
      }
      let providerOrSigner = null;
      if (window.ethereum) {
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);
        providerOrSigner = await ethersProvider.getSigner();
      } else if (provider) {
        providerOrSigner = provider;
      } else {
        setTokens([]);
        setGlobalError('No Ethereum provider found. Please install MetaMask or use a supported wallet.');
        openWalletModal();
        return;
      }
      console.log("[DASHBOARD] chainId:", chainId, "account:", account);
      const factory = new ethers.Contract(factoryAddress, UnrugpadTokenFactoryABI.abi, providerOrSigner);
      let userTokens = [];
      try {
        userTokens = await factory.getUserTokens(account);
        // Log userTokens separately for clarity
        console.log("[DASHBOARD] userTokens:", userTokens);
        setGlobalError('');
      } catch (err) {
        console.error("[DASHBOARD] Error fetching userTokens:", err);
        setGlobalError('Failed to fetch tokens from factory contract. Please check your network and contract deployment.');
        setTokens([]);
        return;
      }
      // Convert Proxy result to array for ethers v6 compatibility
      const tokenArray = Array.from(userTokens);
      // Tokens created by our factory use a verified implementation; mark as verified locally.
      const tokenObjs = tokenArray.map(addr => ({ address: addr, verifyStatus: 'already_verified', verifyExplorer: null }));
      setTokens(tokenObjs);
    } catch (err) {
      console.error("[DASHBOARD] Network error:", err);
      setTokens([]);
      setGlobalError('Network error: Unable to fetch contract addresses. Please check your connection.');
    } finally {
      setIsFetchingTokens(false);
    }
  };

  useEffect(() => {
    fetchTokens();
    // Refetch tokens when account, provider, chainId, or after deployment
    // Listen for navigation from deployment result
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchTokens();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [account, provider, openWalletModal, chainId]);

  // Fetch live token details from blockchain
  useEffect(() => {
    const fetchLiveDetails = async () => {
      if (!tokens.length) return;

      // Build a provider or signer fallback so we can query the chain
      let providerOrSigner = signer || provider;
      if (!providerOrSigner && typeof window !== 'undefined' && window.ethereum) {
        try {
          const ethersProvider = new ethers.BrowserProvider(window.ethereum);
          providerOrSigner = await ethersProvider.getSigner();
        } catch (err) {
          console.warn('[DASHBOARD] Could not create fallback signer from window.ethereum:', err);
        }
      }

      if (!providerOrSigner) {
        console.warn('[DASHBOARD] No provider or signer available for fetching token details');
        return;
      }

      console.log('[DASHBOARD] Fetching live details for tokens:', tokens.map(t => t.address));

      // Use API base from env to contact backend rather than the Vite dev server
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

      // Fetch live token details from blockchain (do not call BscScan per-token here to avoid rate limits).
      const details = await Promise.all(tokens.map(async (token) => {
        try {
          const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, providerOrSigner);
          // Fetch all recommended fields in parallel
          const [
            name, symbol, totalSupply, balance, decimals, owner, tradingPaused, buyFee, sellFee, buyFees, sellFees,
            platformFee, getTotalBuyFee, getTotalSellFee, maxTransactionAmount, maxWalletAmount, limitsInEffect,
            marketingWallet, devWallet, platformWallet, factory, pancakePair, pancakeRouter, deploymentMetadata,
            circulatingSupply, swapTokensAtAmount, tokensForMarketing, tokensForDev, tokensForLiquidity, tokensForPlatform,
            tokensForBuyFee, tokensForSellFee, version, isFeeExempt, userIsFeeExempt
          ] = await Promise.all([
            contract.name().catch(() => null),
            contract.symbol().catch(() => null),
            contract.totalSupply().catch(() => null),
            account ? contract.balanceOf(account).catch(() => null) : Promise.resolve('0'),
            contract.decimals().catch(() => null),
            contract.owner().catch(() => null),
            contract.tradingPaused().catch(() => null),
            contract.buyFee().catch(() => null),
            contract.sellFee().catch(() => null),
            contract.buyFees().catch(() => null),
            contract.sellFees().catch(() => null),
            contract.PLATFORM_FEE ? contract.PLATFORM_FEE().catch(() => null) : Promise.resolve(null),
            contract.getTotalBuyFee ? contract.getTotalBuyFee().catch(() => null) : Promise.resolve(null),
            contract.getTotalSellFee ? contract.getTotalSellFee().catch(() => null) : Promise.resolve(null),
            contract.maxTransactionAmount().catch(() => null),
            contract.maxWalletAmount().catch(() => null),
            contract.limitsInEffect().catch(() => null),
            contract.marketingWallet().catch(() => null),
            contract.devWallet().catch(() => null),
            contract.platformWallet().catch(() => null),
            contract.factory().catch(() => null),
            contract.pancakePair().catch(() => null),
            contract.pancakeRouter().catch(() => null),
            contract.deploymentMetadata().catch(() => null),
            contract.getCirculatingSupply ? contract.getCirculatingSupply().catch(() => null) : Promise.resolve(null),
            contract.swapTokensAtAmount().catch(() => null),
            contract.tokensForMarketing().catch(() => null),
            contract.tokensForDev().catch(() => null),
            contract.tokensForLiquidity().catch(() => null),
            contract.tokensForPlatform().catch(() => null),
            contract.tokensForBuyFee().catch(() => null),
            contract.tokensForSellFee().catch(() => null),
            contract.VERSION ? contract.VERSION().catch(() => null) : Promise.resolve(null),
            contract.isFeeExempt ? contract.isFeeExempt(account).catch(() => null) : Promise.resolve(null),
            contract.isExcludedFromFees ? contract.isExcludedFromFees(account).catch(() => null) : Promise.resolve(null)
          ]);

          // Tokens from our factory are considered verified (implementation is verified).
          const verifyStatus = token.verifyStatus || 'already_verified';
          const verifyExplorer = token.verifyExplorer || null;

          if (!name || !symbol || !totalSupply) {
            console.warn(`[DASHBOARD] Missing details for token ${token.address}:`, { name, symbol, totalSupply });
            return { ...token, error: 'Could not fetch live details', verifyStatus, verifyExplorer };
          }

          // Normalize values to strings for display
          const norm = (v) => (v && v.toString ? v.toString() : String(v));
          const normStruct = (s) => (s && typeof s === 'object' ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, norm(v)])) : s);

          return {
            ...token,
            name: norm(name),
            symbol: norm(symbol),
            totalSupply: norm(totalSupply),
            userBalance: norm(balance),
            decimals: norm(decimals),
            owner: owner,
            tradingPaused: tradingPaused,
            buyFee: norm(buyFee),
            sellFee: norm(sellFee),
            buyFees: normStruct(buyFees),
            sellFees: normStruct(sellFees),
            platformFee: norm(platformFee),
            getTotalBuyFee: norm(getTotalBuyFee),
            getTotalSellFee: norm(getTotalSellFee),
            maxTransactionAmount: norm(maxTransactionAmount),
            maxWalletAmount: norm(maxWalletAmount),
            limitsInEffect: limitsInEffect,
            marketingWallet: marketingWallet,
            devWallet: devWallet,
            platformWallet: platformWallet,
            factory: factory,
            pancakePair: pancakePair,
            pancakeRouter: pancakeRouter,
            deploymentMetadata: deploymentMetadata,
            circulatingSupply: norm(circulatingSupply),
            swapTokensAtAmount: norm(swapTokensAtAmount),
            tokensForMarketing: norm(tokensForMarketing),
            tokensForDev: norm(tokensForDev),
            tokensForLiquidity: norm(tokensForLiquidity),
            tokensForPlatform: norm(tokensForPlatform),
            tokensForBuyFee: norm(tokensForBuyFee),
            tokensForSellFee: norm(tokensForSellFee),
            version: norm(version),
            isFeeExempt: isFeeExempt,
            userIsFeeExempt: userIsFeeExempt,
            verifyStatus,
            verifyExplorer
          };
        } catch (e) {
          console.error(`[DASHBOARD] Error fetching details for token ${token.address}:`, e);
          return { ...token, error: 'Could not fetch live details', verifyStatus: 'unknown', verifyExplorer: null };
        }
      }));

      console.log('[DASHBOARD] Live token details:', details);
      setLiveTokenDetails(details);
    };
    fetchLiveDetails();
    // Set up periodic verification refresh for tokens
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const interval = setInterval(async () => {
      if (!details || details.length === 0) return;
      try {
        const refreshed = await Promise.all(details.map(async (t) => {
          try {
            const resp = await fetch(`${apiBaseUrl}/api/verify-proxy/status?proxyAddress=${t.address}`);
            if (!resp.ok) return t;
            const d = await resp.json();
            return { ...t, verifyStatus: d.status || t.verifyStatus, verifyExplorer: d.explorer || t.verifyExplorer };
          } catch (e) {
            return t;
          }
        }));
        setLiveTokenDetails(refreshed);
      } catch (e) {
        // ignore periodic errors
      }
    }, 60000); // every 60s

    return () => clearInterval(interval);
  }, [tokens, signer, provider, account]);

  const openModal = (type, token) => {
    setModalType(type);
    setSelectedToken(token);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTransferData({ to: '', amount: '' });
    setApproveData({ spender: '', amount: '' });
    setBalanceAddress('');
  };

  const handleTransfer = async () => {
    if (!transferData.to || !transferData.amount) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsLoading(true);
      await interactWithToken({
        action: 'transfer',
        tokenAddress: selectedToken.address,
        to: transferData.to,
        amount: transferData.amount,
      });
      toast.success('Transfer successful!');
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transfer failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveData.spender || !approveData.amount) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsLoading(true);
      await interactWithToken({
        action: 'approve',
        tokenAddress: selectedToken.address,
        spender: approveData.spender,
        amount: approveData.amount,
      });
      toast.success('Approval successful!');
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approval failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!balanceAddress) {
      toast.error('Please enter an address');
      return;
    }

    try {
      setIsLoading(true);
      const response = await interactWithToken({
        action: 'balanceOf',
        tokenAddress: selectedToken.address,
        address: balanceAddress,
      });
      toast.success(`Balance: ${response.balance || '0'} ${selectedToken.symbol}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to check balance');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Wallet Not Connected</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to view your dashboard</p>
        </Card>
      </div>
    );
  }

  if (chainId !== 56) {
    // Handler for switching network to BSC Mainnet
    const handleSwitchNetwork = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }], // 0x38 = 56 in hex
          });
        } catch (switchError) {
          // This error code indicates the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0x38',
                    chainName: 'Binance Smart Chain Mainnet',
                    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                    rpcUrls: ['https://bsc-dataseed.binance.org/'],
                    blockExplorerUrls: ['https://bscscan.com/'],
                  },
                ],
              });
            } catch (addError) {
              // handle "add" error
              alert('Failed to add BSC Mainnet to MetaMask.');
            }
          } else {
            alert('Failed to switch network.');
          }
        }
      } else {
        alert('MetaMask is not available.');
      }
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center border border-yellow-500">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">Wrong Network</h2>
          <p className="text-gray-300 mb-6">Please switch your wallet to <span className="font-bold">BSC Mainnet</span> to use the dashboard.</p>
                  <div className="flex justify-center mt-4">
                  <Button variant="primary" onClick={handleSwitchNetwork}>Switch Network</Button>
                  </div>
        </Card>
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center border border-red-500">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{globalError}</p>
          <div className="flex justify-center mt-4">
            <Button variant="danger" onClick={async () => {
              setIsLoading(true);
              await fetchTokens();
              setIsLoading(false);
            }}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between w-full mb-1">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Token Dashboard
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={async () => {
                setIsLoading(true);
                await fetchTokens();
                setIsLoading(false);
              }}
              aria-label="Refresh token list"
              title="Refresh token list"
              disabled={isLoading}
            >
              <RefreshCw size={16} className={`inline-block transition-transform ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 text-lg">View your deployed tokens</p>
            {/* No banner, keep UI clean */}
          </div>
        </motion.div>

  {isFetchingTokens ? (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div key={`skeleton-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="w-32 h-6 mb-2" />
                <Skeleton className="w-20 h-4" />
              </div>
              <div className="w-12 h-12">
                <Skeleton className="w-12 h-12 rounded-full" circle />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-full h-4" />
              <div className="flex gap-2">
                <Skeleton className="w-1/2 h-4" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  ) : (!globalError && liveTokenDetails.length === 0) ? (
    <Card className="text-center">
      <Coins size={64} className="text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">No Tokens Yet</h3>
      <p className="text-gray-400 mb-6">Deploy your first token to get started</p>
    </Card>
  ) : (
    liveTokenDetails.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {liveTokenDetails.map((token, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card glow>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">{token.symbol}</h3>
                  <p className="text-gray-400 text-sm">{token.name}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Coins size={24} className="text-white" />
                </div>
              </div>
              {/* Essential Fields */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Token Name:</span>
                  <span className="text-white font-semibold">{token.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Symbol:</span>
                  <span className="text-white font-mono">{token.symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Supply:</span>
                  <span className="text-white font-mono">{token.totalSupply}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Your Balance:</span>
                  <span className="text-white font-mono">{token.userBalance}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Decimals:</span>
                  <span className="text-white font-mono">{token.decimals}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Owner:</span>
                  <span className="text-white font-mono">{token.owner?.slice(0, 6)}...{token.owner?.slice(-4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Paused:</span>
                  <span className={`font-mono ${token.tradingPaused ? 'text-yellow-400' : 'text-green-400'}`}>{token.tradingPaused ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Address:</span>
                  <span className="text-white font-mono flex items-center gap-2">
                    <span className="font-mono">{token.address?.slice(0, 6)}...{token.address?.slice(-4)}</span>
                    {token.verifyStatus === 'already_verified' && (
                      <>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-600 text-white">Verified</span>
                        <button
                          className="ml-2 text-cyan-300 underline text-xs hover:text-cyan-200"
                          onClick={() => window.open(`https://bscscan.com/address/${token.address}#code`, '_blank')}
                          title="View on BscScan"
                        >
                          View on BscScan
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {/* Verification Status Row */}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-400">Verification:</span>
                  <span className="flex items-center gap-2">
                    {token.verifyStatus === 'pending' && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full animate-pulse bg-yellow-400" /> Pending</span>
                    )}
                    {token.verifyStatus === 'ok' && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400" /> Verified {token.verifyExplorer && (<button className="ml-1 text-cyan-300 underline" onClick={() => window.open(token.verifyExplorer, '_blank')}>BscScan</button>)}</span>
                    )}
                    {token.verifyStatus === 'already_verified' && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400" aria-hidden /> <span className="text-sm font-medium">Verified</span> {token.verifyExplorer && (<button className="ml-1 text-cyan-300 underline" onClick={() => window.open(token.verifyExplorer, '_blank')}>BscScan</button>)}</span>
                    )}
                    {token.verifyStatus === 'api_key_missing' && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> API Key Missing</span>
                    )}
                    {token.verifyStatus === 'failed' && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> Failed</span>
                    )}
                    {token.verifyStatus === 'unknown' && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500" /> Unknown</span>
                    )}
                  </span>
                </div>
                
                {token.error && (
                  <div className="text-red-400 text-xs">{token.error}</div>
                )}
              </div>
              {/* Advanced Section (Modal) */}
              <button
                className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 focus:outline-none mt-2 mb-1"
                onClick={() => setAdvancedModalToken(token)}
                aria-label="Show Advanced"
              >
                <ChevronRight size={16} />
                Show Advanced
              </button>
{/* 
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openModal('transfer', token)}
                  className="text-xs"
                >
                  <Send size={14} />
                  Transfer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openModal('approve', token)}
                  className="text-xs"
                >
                  <CheckCircle size={14} />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openModal('balance', token)}
                  className="text-xs"
                >
                  <Eye size={14} />
                  Balance
                </Button>
              </div> */}
            </Card>
          </motion.div>
        ))}
      </div>
      
    )
  )}

      {/* Advanced Details Modal - only one rendered, outside the map */}
      <AdvancedTokenDetailsModal
        token={advancedModalToken}
        isOpen={!!advancedModalToken}
        onClose={() => setAdvancedModalToken(null)}
      />

        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={
            modalType === 'transfer'
              ? 'Transfer Tokens'
              : modalType === 'approve'
              ? 'Approve Spending'
              : 'Check Balance'
          }
        >
          {modalType === 'transfer' && (
            <div className="space-y-4">
              <Input
                label="Recipient Address"
                value={transferData.to}
                onChange={(e) => setTransferData({ ...transferData, to: e.target.value })}
                placeholder="0x..."
              />
              <Input
                label="Amount"
                type="number"
                value={transferData.amount}
                onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                placeholder="0.0"
              />
              <Button onClick={handleTransfer} loading={isLoading} className="w-full">
                Transfer
              </Button>
            </div>
          )}

          {modalType === 'approve' && (
            <div className="space-y-4">
              <Input
                label="Spender Address"
                value={approveData.spender}
                onChange={(e) => setApproveData({ ...approveData, spender: e.target.value })}
                placeholder="0x..."
              />
              <Input
                label="Amount"
                type="number"
                value={approveData.amount}
                onChange={(e) => setApproveData({ ...approveData, amount: e.target.value })}
                placeholder="0.0"
              />
              <Button onClick={handleApprove} loading={isLoading} className="w-full">
                Approve
              </Button>
            </div>
          )}

          {modalType === 'balance' && (
            <div className="space-y-4">
              <Input
                label="Address to Check"
                value={balanceAddress}
                onChange={(e) => setBalanceAddress(e.target.value)}
                placeholder="0x..."
              />
              <Button onClick={handleCheckBalance} loading={isLoading} className="w-full">
                Check Balance
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default Dashboard;
