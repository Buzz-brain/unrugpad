import { motion } from 'framer-motion';
import { useState } from 'react';
import { Slider, Tooltip } from '@mui/material';
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
    buyMarketingFee: '',
    buyDevFee: '',
    buyLpFee: '',
    buyBurnFee: '',
    sellMarketingFee: '',
    sellDevFee: '',
    sellLpFee: '',
  sellBurnFee: '',
  maxTxPercent: 0.5,
  maxWalletPercent: 0.5,
  });

  const [errors, setErrors] = useState({});

  // Helper to compute token value for a percent
  const getTokenValue = (percent) => {
    const supply = Number(formData.totalSupply || 0);
    return supply > 0 ? ((supply * percent) / 100).toLocaleString() : '0';
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Token name is required';
    if (!formData.symbol.trim()) newErrors.symbol = 'Token symbol is required';
    if (!formData.totalSupply || formData.totalSupply <= 0)
      newErrors.totalSupply = 'Total supply must be greater than 0';
    if (!formData.ownerAddress.trim()) newErrors.ownerAddress = 'Owner address is required';
    if (!formData.marketingWallet.trim()) newErrors.marketingWallet = 'Marketing wallet is required';
    if (!formData.devWallet.trim()) newErrors.devWallet = 'Dev wallet is required';

    // Validate individual fees (0-15%)
    const feeFields = [
      'buyMarketingFee', 'buyDevFee', 'buyLpFee', 'buyBurnFee',
      'sellMarketingFee', 'sellDevFee', 'sellLpFee', 'sellBurnFee',
    ];
    feeFields.forEach((field) => {
      const val = Number(formData[field] || 0);
      if (val < 0 || val > 15) newErrors[field] = 'Fee must be between 0-15%';
    });

    // Validate total buy/sell fee (0-30%)
    const totalBuyFee = ['buyMarketingFee', 'buyDevFee', 'buyLpFee', 'buyBurnFee']
      .map((f) => Number(formData[f] || 0)).reduce((a, b) => a + b, 0);
    const totalSellFee = ['sellMarketingFee', 'sellDevFee', 'sellLpFee', 'sellBurnFee']
      .map((f) => Number(formData[f] || 0)).reduce((a, b) => a + b, 0);
    const totalFee = totalBuyFee + totalSellFee;
    if (totalFee < 0 || totalFee > 30) newErrors.totalFee = 'Total fee (Buy + Sell) must be between 0-30%';
    // New: Validate total buy fee (≤ 15%)
    if (totalBuyFee > 15) newErrors.totalBuyFee = 'Total buy fee must not exceed 15%';
    // New: Validate total sell fee (≤ 15%)
    if (totalSellFee > 15) newErrors.totalSellFee = 'Total sell fee must not exceed 15%';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Realtime validation for fee fields and totals
  const handleChange = (field, value) => {
    // Only allow numbers and empty string for fee fields
    let val = value;
    if ([
      'buyMarketingFee', 'buyDevFee', 'buyLpFee', 'buyBurnFee',
      'sellMarketingFee', 'sellDevFee', 'sellLpFee', 'sellBurnFee',
      'totalSupply'
    ].includes(field)) {
      if (val === '') {
        val = '';
      } else {
        val = val.replace(/[^\d.]/g, '');
        // Prevent multiple decimals
        const parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        // Prevent leading zeros
        if (val.length > 1 && val[0] === '0' && val[1] !== '.') val = val.replace(/^0+/, '');
      }
    }

    // Update form data
    setFormData((prev) => ({ ...prev, [field]: val }));

    // Realtime validation logic
    let newErrors = { ...errors };
    // Individual fee validation
    // Individual fee validation
    if ([
      'buyMarketingFee', 'buyDevFee', 'buyLpFee', 'buyBurnFee',
      'sellMarketingFee', 'sellDevFee', 'sellLpFee', 'sellBurnFee'
    ].includes(field)) {
      const numVal = Number(val);
      if (val !== '' && (numVal < 0 || numVal > 15)) {
        newErrors[field] = 'Fee must be between 0-15%';
      } else {
        newErrors[field] = '';
      }
    }
    // Total fee validation (Buy + Sell), and new: total buy/sell fee (≤ 15%)
    const buyFees = [
      'buyMarketingFee', 'buyDevFee', 'buyLpFee', 'buyBurnFee'
    ].map(f => Number(f === field ? val : formData[f] || 0));
    const sellFees = [
      'sellMarketingFee', 'sellDevFee', 'sellLpFee', 'sellBurnFee'
    ].map(f => Number(f === field ? val : formData[f] || 0));
    const totalBuyFee = buyFees.reduce((a, b) => a + b, 0);
    const totalSellFee = sellFees.reduce((a, b) => a + b, 0);
    const totalFee = totalBuyFee + totalSellFee;
    if ([
      'buyMarketingFee', 'buyDevFee', 'buyLpFee', 'buyBurnFee',
      'sellMarketingFee', 'sellDevFee', 'sellLpFee', 'sellBurnFee'
    ].includes(field)) {
      if (totalFee > 30) {
        newErrors.totalFee = 'Total fee (Buy + Sell) must not exceed 30%';
      } else {
        newErrors.totalFee = '';
      }
      // New: total buy fee (≤ 15%)
      if (totalBuyFee > 15) {
        newErrors.totalBuyFee = 'Total buy fee must not exceed 15%';
      } else {
        newErrors.totalBuyFee = '';
      }
      // New: total sell fee (≤ 15%)
      if (totalSellFee > 15) {
        newErrors.totalSellFee = 'Total sell fee must not exceed 15%';
      } else {
        newErrors.totalSellFee = '';
      }
    }
    // Total supply validation
    if (field === 'totalSupply') {
      const numVal = Number(val);
      if (val === '' || numVal <= 0) {
        newErrors.totalSupply = 'Total supply must be greater than 0';
      } else {
        newErrors.totalSupply = '';
      }
    }
    setErrors(newErrors);
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
          <p className="text-gray-400 text-lg">
            Configure your token parameters and launch in minutes
          </p>
        </motion.div>

        <Card glow>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* === Token Details === */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4">
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-cyan-400 rounded" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">Token Details</h2>
                    <p className="text-sm text-gray-400 mt-1">Basic token identity and supply settings.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <Input
                label="Token Name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g., My Awesome Token"
                error={errors.name}
                required
                tooltip="The full name of your token"
              />

              <Input
                label="Token Symbol"
                value={formData.symbol}
                onChange={(e) =>
                  handleChange("symbol", e.target.value.toUpperCase())
                }
                placeholder="e.g., MAT"
                error={errors.symbol}
                required
                tooltip="The ticker symbol (3-5 characters recommended)"
              />
            </div>
              <div className="mt-4">
                <Input
                  label="Total Supply"
                  type="number"
                  value={formData.totalSupply}
                  onChange={(e) => handleChange("totalSupply", e.target.value)}
                  placeholder="1000000000"
                  error={errors.totalSupply}
                  required
                  tooltip="Total number of tokens to mint"
                />
              </div>
            </div>

            {/* === Wallets === */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4 mt-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-6 bg-cyan-400 rounded" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Wallets</h3>
                  <p className="text-sm text-gray-400">Addresses to receive fees and platform shares.</p>
                </div>
              </div>

              <Input
                label="Owner Address"
                value={formData.ownerAddress}
                onChange={(e) => handleChange("ownerAddress", e.target.value)}
                placeholder="0x..."
                error={errors.ownerAddress}
                required
                tooltip="The address that will own and control the token"
              />
            </div>

            {/* === Fee Configuration === */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4 mt-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-6 bg-cyan-400 rounded" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Fee Configuration</h3>
                  <p className="text-sm text-gray-400">Configure buy and sell fee splits (marketing, dev, LP, burn).</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <Input
                label="Marketing Wallet"
                value={formData.marketingWallet}
                onChange={(e) =>
                  handleChange("marketingWallet", e.target.value)
                }
                placeholder="0x..."
                error={errors.marketingWallet}
                required
                tooltip="Address to receive marketing fees"
              />
              <Input
                label="Dev Wallet"
                value={formData.devWallet}
                onChange={(e) => handleChange("devWallet", e.target.value)}
                placeholder="0x..."
                error={errors.devWallet}
                required
                tooltip="Address to receive development fees"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Buy Fee Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Marketing Buy Fee (%)"
                    type="number"
                    value={formData.buyMarketingFee}
                    onChange={(e) =>
                      handleChange("buyMarketingFee", e.target.value)
                    }
                    placeholder="0-15"
                    error={errors.buyMarketingFee}
                    tooltip="% of buy fee to marketing wallet"
                  />
                  <Input
                    label="Dev Buy Fee (%)"
                    type="number"
                    value={formData.buyDevFee}
                    onChange={(e) => handleChange("buyDevFee", e.target.value)}
                    placeholder="0-15"
                    error={errors.buyDevFee}
                    tooltip="% of buy fee to dev wallet"
                  />
                  <Input
                    label="LP Buy Fee (%)"
                    type="number"
                    value={formData.buyLpFee}
                    onChange={(e) => handleChange("buyLpFee", e.target.value)}
                    placeholder="0-15"
                    error={errors.buyLpFee}
                    tooltip="% of buy fee to liquidity pool (no wallet)"
                  />
                  <Input
                    label="Burn Buy Fee (%)"
                    type="number"
                    value={formData.buyBurnFee}
                    onChange={(e) => handleChange("buyBurnFee", e.target.value)}
                    placeholder="0-15"
                    error={errors.buyBurnFee}
                    tooltip="% of buy fee to burning (optional)"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Total Buy Fee:{" "}
                  <span
                    className={
                      errors.totalBuyFee
                        ? "text-red-400 font-bold"
                        : "text-cyan-400"
                    }
                  >
                    {["buyMarketingFee", "buyDevFee", "buyLpFee", "buyBurnFee"]
                      .map((f) => Number(formData[f] || 0))
                      .reduce((a, b) => a + b, 0)}
                    %
                  </span>
                  {errors.totalBuyFee && (
                    <span className="ml-2 text-red-400 font-semibold">
                      ({errors.totalBuyFee})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Sell Fee Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Marketing Sell Fee (%)"
                    type="number"
                    value={formData.sellMarketingFee}
                    onChange={(e) =>
                      handleChange("sellMarketingFee", e.target.value)
                    }
                    placeholder="0-15"
                    error={errors.sellMarketingFee}
                    tooltip="% of sell fee to marketing wallet"
                  />
                  <Input
                    label="Dev Sell Fee (%)"
                    type="number"
                    value={formData.sellDevFee}
                    onChange={(e) => handleChange("sellDevFee", e.target.value)}
                    placeholder="0-15"
                    error={errors.sellDevFee}
                    tooltip="% of sell fee to dev wallet"
                  />
                  <Input
                    label="LP Sell Fee (%)"
                    type="number"
                    value={formData.sellLpFee}
                    onChange={(e) => handleChange("sellLpFee", e.target.value)}
                    placeholder="0-15"
                    error={errors.sellLpFee}
                    tooltip="% of sell fee to liquidity pool (no wallet)"
                  />
                  <Input
                    label="Burn Sell Fee (%)"
                    type="number"
                    value={formData.sellBurnFee}
                    onChange={(e) =>
                      handleChange("sellBurnFee", e.target.value)
                    }
                    placeholder="0-15"
                    error={errors.sellBurnFee}
                    tooltip="% of sell fee to burning (optional)"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Total Sell Fee:{" "}
                  <span
                    className={
                      errors.totalSellFee
                        ? "text-red-400 font-bold"
                        : "text-cyan-400"
                    }
                  >
                    {[
                      "sellMarketingFee",
                      "sellDevFee",
                      "sellLpFee",
                      "sellBurnFee",
                    ]
                      .map((f) => Number(formData[f] || 0))
                      .reduce((a, b) => a + b, 0)}
                    %
                  </span>
                  {errors.totalSellFee && (
                    <span className="ml-2 text-red-400 font-semibold">
                      ({errors.totalSellFee})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Total Fee Warning - spans full form below buy/sell config */}
            <div className="w-full flex justify-center mt-6">
              <motion.div
                initial={{ scale: 1 }}
                animate={
                  errors.totalFee
                    ? { scale: [1, 1.05, 1], x: [0, -5, 5, 0] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.5 }}
                className={`rounded-lg px-4 py-3 text-base font-semibold flex items-center gap-2 shadow-md ${
                  errors.totalFee
                    ? "bg-red-900 text-red-200 border-2 border-red-400"
                    : "bg-yellow-900 text-yellow-200 border border-yellow-600"
                }`}
                style={{ minWidth: "320px", maxWidth: "500px" }}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
                  />
                </svg>
                <span>
                  Total Fee (Buy + Sell):{" "}
                  <span
                    className={
                      errors.totalFee
                        ? "text-red-300 font-bold"
                        : "text-yellow-300 font-bold"
                    }
                  >
                    {[
                      "buyMarketingFee",
                      "buyDevFee",
                      "buyLpFee",
                      "buyBurnFee",
                      "sellMarketingFee",
                      "sellDevFee",
                      "sellLpFee",
                      "sellBurnFee",
                    ]
                      .map((f) => Number(formData[f] || 0))
                      .reduce((a, b) => a + b, 0)}
                    %
                  </span>
                  {errors.totalFee
                    ? ` (${errors.totalFee})`
                    : " (must not exceed 30%)"}
                </span>
              </motion.div>
            </div>

            </div>

            {/* === Anti-Whale Limits === */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4 mt-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-6 bg-cyan-400 rounded" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Anti-Whale Limits</h3>
                  <p className="text-sm text-gray-400">Set limits to prevent large transfers or wallet holdings.</p>
                </div>
              </div>
              {/* Max Transaction & Wallet Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white font-semibold mb-1 flex items-center gap-1">
                  Max Transaction Amount
                  <Tooltip
                    title="Maximum % of total supply allowed per transaction. Adjustable from 0.5% to 100%."
                    placement="top"
                    arrow
                  >
                    <span className="text-cyan-400 cursor-pointer">
                      &#9432;
                    </span>
                  </Tooltip>
                </label>
                <div className="flex items-center gap-4">
                  <Slider
                    min={0.5}
                    max={100}
                    step={0.1}
                    value={formData.maxTxPercent}
                    onChange={(_, v) => handleChange("maxTxPercent", v)}
                    sx={{ color: "#06b6d4", width: 180 }}
                  />
                  <span className="text-cyan-300 font-bold">
                    {formData.maxTxPercent}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  = {getTokenValue(formData.maxTxPercent)} tokens
                </div>
              </div>
              <div>
                <label className="block text-white font-semibold mb-1 flex items-center gap-1">
                  Max Wallet Amount
                  <Tooltip
                    title="Maximum % of total supply a wallet can hold. Adjustable from 0.5% to 100%."
                    placement="top"
                    arrow
                  >
                    <span className="text-cyan-400 cursor-pointer">
                      &#9432;
                    </span>
                  </Tooltip>
                </label>
                <div className="flex items-center gap-4">
                  <Slider
                    min={0.5}
                    max={100}
                    step={0.1}
                    value={formData.maxWalletPercent}
                    onChange={(_, v) => handleChange("maxWalletPercent", v)}
                    sx={{ color: "#06b6d4", width: 180 }}
                  />
                  <span className="text-cyan-300 font-bold">
                    {formData.maxWalletPercent}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  = {getTokenValue(formData.maxWalletPercent)} tokens
                </div>
              </div>
            </div>

            </div>

            {/* Summary Panel */}
            <div className="bg-gray-800 rounded-lg p-4 mt-8 border border-cyan-900">
              <h4 className="text-xl text-cyan-300 font-semibold mb-2">Summary</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>
                  <span className="font-bold">Token Name:</span>{" "}
                  {formData.name || <span className="text-gray-500">—</span>}
                </li>
                <li>
                  <span className="font-bold">Symbol:</span>{" "}
                  {formData.symbol || <span className="text-gray-500">—</span>}
                </li>
                <li>
                  <span className="font-bold">Total Supply:</span>{" "}
                  {formData.totalSupply || (
                    <span className="text-gray-500">—</span>
                  )}
                </li>
                <li>
                  <span className="font-bold">Max Tx Amount:</span>{" "}
                  {formData.maxTxPercent}% (
                  {getTokenValue(formData.maxTxPercent)} tokens)
                </li>
                <li>
                  <span className="font-bold">Max Wallet Amount:</span>{" "}
                  {formData.maxWalletPercent}% (
                  {getTokenValue(formData.maxWalletPercent)} tokens)
                </li>
                <li>
                  <span className="font-bold">Buy Fees:</span> Marketing{" "}
                  {formData.buyMarketingFee || 0}%, Dev{" "}
                  {formData.buyDevFee || 0}%, LP {formData.buyLpFee || 0}%, Burn{" "}
                  {formData.buyBurnFee || 0}%
                </li>
                <li>
                  <span className="font-bold">Sell Fees:</span> Marketing{" "}
                  {formData.sellMarketingFee || 0}%, Dev{" "}
                  {formData.sellDevFee || 0}%, LP {formData.sellLpFee || 0}%,
                  Burn {formData.sellBurnFee || 0}%
                </li>
              </ul>
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
                disabled={
                  isDeploying ||
                  !!errors.totalFee ||
                  !!errors.totalBuyFee ||
                  !!errors.totalSellFee
                }
                className="w-full"
                title={
                  errors.totalFee
                    ? errors.totalFee
                    : errors.totalBuyFee
                    ? errors.totalBuyFee
                    : errors.totalSellFee
                    ? errors.totalSellFee
                    : ""
                }
              >
                {isDeploying ? "Deploying Token..." : "Deploy Token"}
              </Button>
            </motion.div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Deploy;
