import { motion } from 'framer-motion';

import { useState, useEffect } from 'react';
import { Coins, Send, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
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
  // Log chainId for debugging
  // console.log('Current chainId:', chainId);

  // Show warning if not on BSC mainnet
  const showWrongNetworkWarning = isConnected && chainId !== 56;
  const [tokens, setTokens] = useState([]);
  const [liveTokenDetails, setLiveTokenDetails] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  // Removed local wallet modal state, now using global WalletModalContext
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const [transferData, setTransferData] = useState({ to: '', amount: '' });
  const [approveData, setApproveData] = useState({ spender: '', amount: '' });
  const [balanceAddress, setBalanceAddress] = useState('');

  const { open: openWalletModal } = useWalletModal();
  useEffect(() => {
    // Fetch factory address from backend and get tokens for connected user
    const fetchTokens = async () => {
      if (!account) return;
      if (chainId !== 56) return; // Don't fetch tokens if not on BSC
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      try {
        const res = await fetch(`${apiBaseUrl}/deployed_addresses.json`);
        const data = await res.json();
        const factoryAddress = data.factory;
        if (!factoryAddress) {
          setTokens([]);
          setGlobalError('Factory contract address not found. Please check your backend configuration.');
          return;
        }
        // Use ethers to instantiate the factory contract
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
        const factory = new ethers.Contract(factoryAddress, UnrugpadTokenFactoryABI.abi, providerOrSigner);
        let userTokens = [];
        try {
          userTokens = await factory.getUserTokens(account);
          setGlobalError('');
        } catch (err) {
          setGlobalError('Failed to fetch tokens from factory contract. Please check your network and contract deployment.');
          setTokens([]);
          return;
        }
        // Map to array of { address }
        const tokenObjs = userTokens.map(addr => ({ address: addr }));
        setTokens(tokenObjs);
      } catch (err) {
        setTokens([]);
        setGlobalError('Network error: Unable to fetch contract addresses. Please check your connection.');
      }
    };
    fetchTokens();
    // Only refetch when account changes
  }, [account, provider, openWalletModal, chainId]);

  // Fetch live token details from blockchain
  useEffect(() => {
    const fetchLiveDetails = async () => {
      if (!signer && !provider) return;
      if (!tokens.length) return;
      const details = await Promise.all(tokens.map(async (token) => {
        try {
          const contract = new ethers.Contract(token.address, UnrugpadTokenABI.abi, signer || provider);
          const [name, symbol, totalSupply, balance] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.totalSupply(),
            account ? contract.balanceOf(account) : Promise.resolve('0')
          ]);
          return {
            ...token,
            name: name.toString ? name.toString() : name,
            symbol: symbol.toString ? symbol.toString() : symbol,
            totalSupply: totalSupply.toString ? totalSupply.toString() : String(totalSupply),
            userBalance: balance.toString ? balance.toString() : String(balance),
          };
        } catch (e) {
          return { ...token, error: 'Could not fetch live details' };
        }
      }));
      setLiveTokenDetails(details);
    };
    fetchLiveDetails();
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
            <Button variant="danger" onClick={() => window.location.reload()}>
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
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            Token Dashboard
          </h1>
          {/* <p className="text-gray-400 text-lg">Manage and interact with your deployed tokens</p> */}
          <p className="text-gray-400 text-lg">View your deployed tokens</p>
        </motion.div>

  {(!globalError && liveTokenDetails.length === 0) ? (
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

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Supply:</span>
                  <span className="text-white font-mono">{token.totalSupply}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Your Balance:</span>
                  <span className="text-white font-mono">{token.userBalance}</span>
                </div>
                {token.error && (
                  <div className="text-red-400 text-xs">{token.error}</div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Address:</span>
                  <span className="text-white font-mono">
                    {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
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
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    )
  )}

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
