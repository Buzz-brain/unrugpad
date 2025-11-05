import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Coins, Send, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import { getTokenInfo, interactWithToken } from '../utils/api';

const Dashboard = () => {
  const { isConnected, account, provider, signer } = useWeb3();
  const [tokens, setTokens] = useState([]);
  const [liveTokenDetails, setLiveTokenDetails] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [transferData, setTransferData] = useState({ to: '', amount: '' });
  const [approveData, setApproveData] = useState({ spender: '', amount: '' });
  const [balanceAddress, setBalanceAddress] = useState('');

  useEffect(() => {
    // Always use the Sepolia address from backend/deployed_addresses.json if available
    fetch('http://localhost:3000/deployed_addresses.json')
      .then(res => res.json())
      .then(data => {
        if (data.sepolia && data.sepolia.UnrugpadToken) {
          setTokens([
            {
              address: data.sepolia.UnrugpadToken,
              symbol: 'URP', // Optionally fetch from contract
              name: 'UnrugpadToken',
            },
          ]);
        } else {
          // fallback to localStorage if not found
          const storedTokens = localStorage.getItem('deployedTokens');
          if (storedTokens) {
            const parsed = JSON.parse(storedTokens);
            setTokens(parsed);
          }
        }
      })
      .catch(() => {
        // fallback to localStorage if fetch fails
        const storedTokens = localStorage.getItem('deployedTokens');
        if (storedTokens) {
          const parsed = JSON.parse(storedTokens);
          setTokens(parsed);
        }
      });
  }, []);

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
            name,
            symbol,
            totalSupply: totalSupply.toString(),
            userBalance: balance.toString(),
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
          <p className="text-gray-400 text-lg">Manage and interact with your deployed tokens</p>
        </motion.div>

  {liveTokenDetails.length === 0 ? (
          <Card className="text-center">
            <Coins size={64} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tokens Yet</h3>
            <p className="text-gray-400 mb-6">Deploy your first token to get started</p>
          </Card>
        ) : (
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
