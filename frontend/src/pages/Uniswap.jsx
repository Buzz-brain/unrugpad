import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowDownUp, Plus, Minus, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import { useWeb3 } from '../contexts/Web3Context';

const Uniswap = () => {
  const { isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState('swap');
  const [isLoading, setIsLoading] = useState(false);

  const [swapData, setSwapData] = useState({
    fromToken: 'ETH',
    toToken: '',
    fromAmount: '',
    toAmount: '',
  });

  const [liquidityData, setLiquidityData] = useState({
    tokenA: '',
    tokenB: '',
    amountA: '',
    amountB: '',
  });

  const mockPriceData = [
    { time: '00:00', price: 2800 },
    { time: '04:00', price: 2850 },
    { time: '08:00', price: 2820 },
    { time: '12:00', price: 2900 },
    { time: '16:00', price: 2880 },
    { time: '20:00', price: 2950 },
    { time: '24:00', price: 2920 },
  ];

  const handleSwap = async () => {
    if (!swapData.fromAmount || !swapData.toToken) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success('Swap executed successfully!');
      setSwapData({ fromToken: 'ETH', toToken: '', fromAmount: '', toAmount: '' });
    } catch (error) {
      toast.error('Swap failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!liquidityData.tokenA || !liquidityData.tokenB || !liquidityData.amountA || !liquidityData.amountB) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success('Liquidity added successfully!');
      setLiquidityData({ tokenA: '', tokenB: '', amountA: '', amountB: '' });
    } catch (error) {
      toast.error('Failed to add liquidity');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'swap', label: 'Swap', icon: <ArrowDownUp size={18} /> },
    { id: 'liquidity', label: 'Liquidity', icon: <Plus size={18} /> },
    { id: 'pools', label: 'Pools', icon: <TrendingUp size={18} /> },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Wallet Not Connected</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to use Uniswap features</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            Mock Uniswap
          </h1>
          <p className="text-gray-400 text-lg">Simulate swaps and liquidity management</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card glow className="lg:col-span-2">
            <div className="flex gap-2 mb-6 border-b border-gray-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors relative ${
                    activeTab === tab.id ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"
                    />
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'swap' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">From</label>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="number"
                        value={swapData.fromAmount}
                        onChange={(e) => setSwapData({ ...swapData, fromAmount: e.target.value })}
                        placeholder="0.0"
                        className="bg-transparent text-2xl text-white outline-none w-full"
                      />
                      <div className="bg-gray-700 px-3 py-2 rounded-lg text-white font-medium">
                        ETH
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">Balance: 5.0 ETH</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button className="bg-gray-800 p-2 rounded-xl hover:bg-gray-700 transition-colors">
                    <ArrowDownUp size={20} className="text-cyan-400" />
                  </button>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">To</label>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={swapData.toAmount}
                        readOnly
                        placeholder="0.0"
                        className="bg-transparent text-2xl text-white outline-none w-full"
                      />
                      <input
                        type="text"
                        value={swapData.toToken}
                        onChange={(e) => setSwapData({ ...swapData, toToken: e.target.value })}
                        placeholder="Select token"
                        className="bg-gray-700 px-3 py-2 rounded-lg text-white font-medium max-w-[120px] outline-none"
                      />
                    </div>
                    <p className="text-sm text-gray-500">Balance: 0.0</p>
                  </div>
                </div>

                <Button onClick={handleSwap} loading={isLoading} className="w-full mt-6">
                  Swap Tokens
                </Button>
              </div>
            )}

            {activeTab === 'liquidity' && (
              <div className="space-y-4">
                <Input
                  label="Token A Address"
                  value={liquidityData.tokenA}
                  onChange={(e) => setLiquidityData({ ...liquidityData, tokenA: e.target.value })}
                  placeholder="0x..."
                />
                <Input
                  label="Token A Amount"
                  type="number"
                  value={liquidityData.amountA}
                  onChange={(e) => setLiquidityData({ ...liquidityData, amountA: e.target.value })}
                  placeholder="0.0"
                />
                <Input
                  label="Token B Address"
                  value={liquidityData.tokenB}
                  onChange={(e) => setLiquidityData({ ...liquidityData, tokenB: e.target.value })}
                  placeholder="0x..."
                />
                <Input
                  label="Token B Amount"
                  type="number"
                  value={liquidityData.amountB}
                  onChange={(e) => setLiquidityData({ ...liquidityData, amountB: e.target.value })}
                  placeholder="0.0"
                />
                <Button onClick={handleAddLiquidity} loading={isLoading} className="w-full mt-6">
                  <Plus size={18} />
                  Add Liquidity
                </Button>
              </div>
            )}

            {activeTab === 'pools' && (
              <div>
                <p className="text-gray-400 text-center py-8">
                  No active pools found. Add liquidity to create a pool.
                </p>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card glow>
              <h3 className="text-lg font-bold text-white mb-4">Price Chart</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mockPriceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card glow>
              <h3 className="text-lg font-bold text-white mb-4">Pool Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">TVL</span>
                  <span className="text-white font-semibold">$125.4M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">24h Volume</span>
                  <span className="text-white font-semibold">$45.2M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">24h Fees</span>
                  <span className="text-white font-semibold">$135.6K</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Uniswap;
