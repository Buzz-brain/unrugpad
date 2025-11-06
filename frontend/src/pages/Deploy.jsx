import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import { useWeb3 } from '../contexts/Web3Context';
import UnrugpadTokenABI from '../abis/UnrugpadToken.json';
import { BrowserProvider, ContractFactory, parseUnits } from 'ethers';

const Deploy = () => {
  const navigate = useNavigate();
  const { isConnected, account } = useWeb3();
  const [isDeploying, setIsDeploying] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    ownerAddress: account || '',
    marketingWallet: '',
    devWallet: '',
    platformWallet: '',
    buyFee: '',
    sellFee: '',
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Token name is required';
    if (!formData.symbol.trim()) newErrors.symbol = 'Token symbol is required';
    if (!formData.totalSupply || formData.totalSupply <= 0)
      newErrors.totalSupply = 'Total supply must be greater than 0';
    if (!formData.ownerAddress.trim()) newErrors.ownerAddress = 'Owner address is required';
    if (formData.buyFee < 0 || formData.buyFee > 100) newErrors.buyFee = 'Buy fee must be between 0-100%';
    if (formData.sellFee < 0 || formData.sellFee > 100) newErrors.sellFee = 'Sell fee must be between 0-100%';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fix all errors before deploying');
      return;
    }

    try {
      setIsDeploying(true);
      // Prepare contract deployment using MetaMask
      if (typeof window.ethereum === 'undefined') {
        toast.error('MetaMask is not available');
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      // Prepare constructor args (update as needed for your contract)
      // If your contract has no constructor args, pass []
      const constructorArgs = [];
      // If your contract expects args, build them from formData here
      // Example: [formData.name, formData.symbol, ...]
      // If you need to pass supply as uint256, use parseUnits(formData.totalSupply, 18)
      // const constructorArgs = [formData.name, formData.symbol, parseUnits(formData.totalSupply, 18), ...];

      const factory = new ContractFactory(UnrugpadTokenABI.abi, UnrugpadTokenABI.bytecode, signer);
      let contract;
      try {
        contract = await factory.deploy(...constructorArgs);
        await contract.waitForDeployment();
        toast.success('Token deployed successfully!');
        navigate('/result', { state: { deployment: { address: contract.target, txHash: contract.deploymentTransaction().hash }, formData } });
      } catch (err) {
        console.error('Deployment error:', err);
        toast.error(err?.message || 'Failed to deploy token');
      }
    } catch (error) {
      console.error('Deployment error:', error);
      // Show backend error message if available
      const backendMsg = error.response?.data?.error || error.response?.data?.message;
      toast.error(backendMsg || 'Failed to deploy token');
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Wallet Not Connected</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to deploy a token</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            Deploy Your Token
          </h1>
          <p className="text-gray-400 text-lg">Configure your token parameters and launch in minutes</p>
        </motion.div>

        <Card glow>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Token Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., My Awesome Token"
                error={errors.name}
                required
                tooltip="The full name of your token"
              />

              <Input
                label="Token Symbol"
                value={formData.symbol}
                onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
                placeholder="e.g., MAT"
                error={errors.symbol}
                required
                tooltip="The ticker symbol (3-5 characters recommended)"
              />
            </div>

            <Input
              label="Total Supply"
              type="number"
              value={formData.totalSupply}
              onChange={(e) => handleChange('totalSupply', e.target.value)}
              placeholder="1000000000"
              error={errors.totalSupply}
              required
              tooltip="Total number of tokens to mint"
            />

            <Input
              label="Owner Address"
              value={formData.ownerAddress}
              onChange={(e) => handleChange('ownerAddress', e.target.value)}
              placeholder="0x..."
              error={errors.ownerAddress}
              required
              tooltip="The address that will own and control the token"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Marketing Wallet"
                value={formData.marketingWallet}
                onChange={(e) => handleChange('marketingWallet', e.target.value)}
                placeholder="0x..."
                tooltip="Address to receive marketing fees (optional)"
              />

              <Input
                label="Dev Wallet"
                value={formData.devWallet}
                onChange={(e) => handleChange('devWallet', e.target.value)}
                placeholder="0x..."
                tooltip="Address to receive development fees (optional)"
              />

              <Input
                label="Platform Wallet"
                value={formData.platformWallet}
                onChange={(e) => handleChange('platformWallet', e.target.value)}
                placeholder="0x..."
                tooltip="Address to receive platform fees (optional)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Buy Fee (%)"
                type="number"
                value={formData.buyFee}
                onChange={(e) => handleChange('buyFee', e.target.value)}
                placeholder="0-100"
                error={errors.buyFee}
                tooltip="Fee percentage charged on buy transactions"
              />

              <Input
                label="Sell Fee (%)"
                type="number"
                value={formData.sellFee}
                onChange={(e) => handleChange('sellFee', e.target.value)}
                placeholder="0-100"
                error={errors.sellFee}
                tooltip="Fee percentage charged on sell transactions"
              />
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-6 border-t border-gray-800"
            >
              <Button
                type="submit"
                size="lg"
                loading={isDeploying}
                disabled={isDeploying}
                className="w-full"
              >
                {isDeploying ? 'Deploying Token...' : 'Deploy Token'}
              </Button>
            </motion.div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Deploy;
