import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Slider, Tooltip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import { useWeb3 } from "../contexts/Web3Context";
import { useWalletModal } from "../contexts/WalletModalContext";
import UnrugpadTokenFactoryABI from "../abis/UnrugpadTokenFactory.json";
import { ethers } from "ethers";

const Deploy = () => {
  const navigate = useNavigate();
  const { isConnected, account, balance, chainId } = useWeb3();
  const [isDeploying, setIsDeploying] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const { open: openWalletModal } = useWalletModal();
  const [deploymentFee, setDeploymentFee] = useState(null);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    totalSupply: "",
    ownerAddress: account || "",
    marketingWallet: "",
    devWallet: "",
    buyMarketingFee: "",
    buyDevFee: "",
    buyLpFee: "",
    sellMarketingFee: "",
    sellDevFee: "",
    sellLpFee: "",
    maxTxPercent: 0.5,
    maxWalletPercent: 0.5,
  });

  const [errors, setErrors] = useState({});

  // Helper to compute token value for a percent
  const getTokenValue = (percent) => {
    const supply = Number(formData.totalSupply || 0);
    return supply > 0 ? ((supply * percent) / 100).toLocaleString() : "0";
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Token name is required";
    if (!formData.symbol.trim()) newErrors.symbol = "Token symbol is required";
    if (!formData.totalSupply || formData.totalSupply <= 0)
      newErrors.totalSupply = "Total supply must be greater than 0";
    if (!formData.ownerAddress.trim())
      newErrors.ownerAddress = "Owner address is required";
    if (!formData.marketingWallet.trim())
      newErrors.marketingWallet = "Marketing wallet is required";
    if (!formData.devWallet.trim())
      newErrors.devWallet = "Dev wallet is required";

    // Validate individual fees (0-30%)
    const feeFields = [
      "buyMarketingFee",
      "buyDevFee",
      "buyLpFee",
      "sellMarketingFee",
      "sellDevFee",
      "sellLpFee",
    ];
    feeFields.forEach((field) => {
      const val = Number(formData[field] || 0);
      if (val < 0 || val > 30) newErrors[field] = "Fee must be between 0-30%";
    });

    // Validate total buy/sell fee (≤ 30% each)
    const totalBuyFee = ["buyMarketingFee", "buyDevFee", "buyLpFee"]
      .map((f) => Number(formData[f] || 0))
      .reduce((a, b) => a + b, 0);
    const totalSellFee = ["sellMarketingFee", "sellDevFee", "sellLpFee"]
      .map((f) => Number(formData[f] || 0))
      .reduce((a, b) => a + b, 0);
    if (totalBuyFee > 30)
      newErrors.totalBuyFee = "Total buy fee must not exceed 30%";
    if (totalSellFee > 30)
      newErrors.totalSellFee = "Total sell fee must not exceed 30%";
    // Combined buy + sell must not exceed 60%
    if (totalBuyFee + totalSellFee > 60)
      newErrors.totalFee = "Total fee (Buy + Sell) must not exceed 60%";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    // Check if user has enough BNB for gas (e.g., 0.005 BNB)
    if (!isConnected || chainId !== 56) {
      setDeploymentFee(null);
      setInsufficientFunds(false);
      return;
    }
    // Set deploymentFee to 0n (free)
    setDeploymentFee(0n);
    try {
      const minGasBNB = 0.001; // Minimum BNB for gas (adjusted)
      const userBalance = parseFloat(balance || "0");
      setInsufficientFunds(userBalance < minGasBNB);
    } catch (err) {
      setInsufficientFunds(false);
      console.error("Error checking user balance for gas:", err);
    }
  }, [isConnected, account, balance, chainId]);

  // Keep ownerAddress synced to connected wallet
  useEffect(() => {
    if (account) {
      setFormData((prev) => ({
        ...prev,
        ownerAddress: account,
      }));
    }
  }, [account]);

  // Realtime validation for fee fields and totals
  const handleChange = (field, value) => {
    // Only allow numbers and empty string for fee fields
    let val = value;
    if (
      [
        "buyMarketingFee",
        "buyDevFee",
        "buyLpFee",
        "sellMarketingFee",
        "sellDevFee",
        "sellLpFee",
        "totalSupply",
      ].includes(field)
    ) {
      if (val === "") {
        val = "";
      } else {
        val = val.replace(/[^\d.]/g, "");
        // Prevent multiple decimals
        const parts = val.split(".");
        if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
        // Prevent leading zeros
        if (val.length > 1 && val[0] === "0" && val[1] !== ".")
          val = val.replace(/^0+/, "");
      }
    }

    // Update form data
    setFormData((prev) => ({ ...prev, [field]: val }));

    // Realtime validation logic
    let newErrors = { ...errors };
    // Individual fee validation
    // Individual fee validation
    if (
      [
        "buyMarketingFee",
        "buyDevFee",
        "buyLpFee",
        "sellMarketingFee",
        "sellDevFee",
        "sellLpFee",
      ].includes(field)
    ) {
      const numVal = Number(val);
      if (val !== "" && (numVal < 0 || numVal > 30)) {
        newErrors[field] = "Fee must be between 0-30%";
      } else {
        newErrors[field] = "";
      }
    }
    // Total buy/sell fee validation (≤ 30% each)
    const buyFees = ["buyMarketingFee", "buyDevFee", "buyLpFee"].map((f) =>
      Number(f === field ? val : formData[f] || 0)
    );
    const sellFees = ["sellMarketingFee", "sellDevFee", "sellLpFee"].map((f) =>
      Number(f === field ? val : formData[f] || 0)
    );
    const totalBuyFee = buyFees.reduce((a, b) => a + b, 0);
    const totalSellFee = sellFees.reduce((a, b) => a + b, 0);
    if (
      [
        "buyMarketingFee",
        "buyDevFee",
        "buyLpFee",
        "sellMarketingFee",
        "sellDevFee",
        "sellLpFee",
      ].includes(field)
    ) {
      if (totalBuyFee > 30) {
        newErrors.totalBuyFee = "Total buy fee must not exceed 30%";
      } else {
        newErrors.totalBuyFee = "";
      }
      if (totalSellFee > 30) {
        newErrors.totalSellFee = "Total sell fee must not exceed 30%";
      } else {
        newErrors.totalSellFee = "";
      }
      // Combined buy + sell must not exceed 60%
      if (totalBuyFee + totalSellFee > 60) {
        newErrors.totalFee = "Total fee (Buy + Sell) must not exceed 60%";
      } else {
        newErrors.totalFee = "";
      }
    }
    // Total supply validation
    if (field === "totalSupply") {
      const numVal = Number(val);
      if (val === "" || numVal <= 0) {
        newErrors.totalSupply = "Total supply must be greater than 0";
      } else {
        newErrors.totalSupply = "";
      }
    }
    setErrors(newErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Debug: log the owner address used for deployment
    console.log("Owner address for deployment:", formData.ownerAddress);

    if (!isConnected) {
      setGlobalError("Please connect your wallet first.");
      return;
    }

    if (!validateForm()) {
      setGlobalError("Please fix all errors before deploying.");
      return;
    }

    try {
      setIsDeploying(true);
      if (typeof window.ethereum === "undefined") {
        openWalletModal();
        setIsDeploying(false);
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      // Log chain/network info
      console.log("[DEPLOY] chainId:", chainId, "account:", account);
      // Fetch factory address from backend
      let factoryAddress;
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
        const res = await fetch(`${apiBaseUrl}/deployed_addresses.json`);
        const data = await res.json();
        factoryAddress = data.factory;
        console.log("[DEPLOY] Factory address:", factoryAddress);
        if (!factoryAddress) throw new Error("Factory address not found");
      } catch (err) {
        setGlobalError("Failed to fetch factory address. Please check your backend configuration.");
        setIsDeploying(false);
        return;
      }
      // Prepare TokenConfig struct
      const config = {
        name: formData.name,
        symbol: formData.symbol,
        totalSupply: ethers.parseUnits(formData.totalSupply || "0", 18),
        owner: formData.ownerAddress,
        marketingWallet: formData.marketingWallet,
        devWallet: formData.devWallet,
        buyFees: {
          marketing: Number(formData.buyMarketingFee || 0),
          dev: Number(formData.buyDevFee || 0),
          lp: Number(formData.buyLpFee || 0),
        },
        sellFees: {
          marketing: Number(formData.sellMarketingFee || 0),
          dev: Number(formData.sellDevFee || 0),
          lp: Number(formData.sellLpFee || 0),
        },
        buyFee: [
          Number(formData.buyMarketingFee || 0),
          Number(formData.buyDevFee || 0),
          Number(formData.buyLpFee || 0),
        ].reduce((a, b) => a + b, 0),
        sellFee: [
          Number(formData.sellMarketingFee || 0),
          Number(formData.sellDevFee || 0),
          Number(formData.sellLpFee || 0),
        ].reduce((a, b) => a + b, 0),
      };
      console.log("[DEPLOY] TokenConfig:", config);
      const metadata = "";
      const factory = new ethers.Contract(factoryAddress, UnrugpadTokenFactoryABI.abi, signer);
      try {
        let deploymentFee = 0n;
        try {
          deploymentFee = await factory.deploymentFee();
        } catch {}
        console.log("[DEPLOY] Deployment fee:", deploymentFee);
        const tx = await factory.createToken(config, metadata, { value: deploymentFee });
        console.log("[DEPLOY] TX:", tx);
        const receipt = await tx.wait();
        console.log("[DEPLOY] Receipt:", receipt);
        let newTokenAddress = null;
        for (const log of receipt.logs) {
          try {
            const parsed = factory.interface.parseLog(log);
            if (parsed.name === "TokenCreated") {
              newTokenAddress = parsed.args.tokenAddress;
              break;
            }
          } catch {}
        }
        console.log("[DEPLOY] New token address:", newTokenAddress);
        // Immediately query userTokens mapping after deployment
        try {
          const userTokens = await factory.getUserTokens(account);
          console.log("[DEPLOY] User tokens after deployment:", userTokens);
        } catch (err) {
          console.error("[DEPLOY] Error querying userTokens after deployment:", err);
        }
        if (!newTokenAddress) {
          setGlobalError("Token deployed but address not found in events.");
          setIsDeploying(false);
          return;
        }
        toast.success("Token deployed successfully!");
        navigate("/result", {
          state: {
            deployment: {
              address: newTokenAddress,
              txHash: tx.hash,
              fee: deploymentFee?.toString(),
            },
            formData: {
              ...formData,
              buyFee: config.buyFee,
              sellFee: config.sellFee,
            },
          },
        });
        setGlobalError("");
      } catch (err) {
        setGlobalError("Contract error: Failed to deploy token. Please check your network and contract configuration.");
        setIsDeploying(false);
        return;
      }
    } catch (error) {
      console.error("[DEPLOY] Deployment error:", error);
      const backendMsg = error.response?.data?.error || error.response?.data?.message;
      setGlobalError(backendMsg || "Failed to deploy token. Please try again later.");
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Wallet Not Connected
          </h2>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to deploy a token
          </p>
        </Card>
      </div>
    );
  }

  if (chainId !== 56) {
    const handleSwitchNetwork = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x38",
                    chainName: "Binance Smart Chain Mainnet",
                    nativeCurrency: {
                      name: "BNB",
                      symbol: "BNB",
                      decimals: 18,
                    },
                    rpcUrls: ["https://bsc-dataseed.binance.org/"],
                    blockExplorerUrls: ["https://bscscan.com/"],
                  },
                ],
              });
            } catch (addError) {
              alert("Failed to add BSC Mainnet to MetaMask.");
            }
          } else {
            alert("Failed to switch network.");
          }
        }
      } else {
        alert("MetaMask is not available.");
      }
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center border border-yellow-500">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">
            Wrong Network
          </h2>
          <p className="text-gray-300 mb-6">
            Please switch your wallet to{" "}
            <span className="font-bold">BSC Mainnet</span> to deploy a token.
          </p>
          <div className="flex justify-center mt-4">
            <Button variant="primary" onClick={handleSwitchNetwork}>
              Switch Network
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // No need for a local modal overlay, handled globally

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
            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4">
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-cyan-400 rounded" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Token Details
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Basic token identity and supply settings.
                    </p>
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

            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4 mt-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-6 bg-cyan-400 rounded" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Wallets</h3>
                  <p className="text-sm text-gray-400">
                    Addresses to receive fees and platform shares.
                  </p>
                </div>
              </div>
              <Input
                label="Owner Address"
                value={formData.ownerAddress}
                onChange={() => {}}
                placeholder="0x..."
                error={errors.ownerAddress}
                required
                tooltip="The address that will own and control the token"
                readOnly
                disabled
              />
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4 mt-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-6 bg-cyan-400 rounded" />
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Fee Configuration
                  </h3>
                  <p className="text-sm text-gray-400">
                    Configure buy and sell fee splits (marketing, dev, LP).
                  </p>
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
                      placeholder="0-30"
                      error={errors.buyMarketingFee}
                      tooltip="% of buy fee to marketing wallet"
                    />
                    <Input
                      label="Dev Buy Fee (%)"
                      type="number"
                      value={formData.buyDevFee}
                      onChange={(e) =>
                        handleChange("buyDevFee", e.target.value)
                      }
                      placeholder="0-30"
                      error={errors.buyDevFee}
                      tooltip="% of buy fee to dev wallet"
                    />
                    <Input
                      label="LP Buy Fee (%)"
                      type="number"
                      value={formData.buyLpFee}
                      onChange={(e) => handleChange("buyLpFee", e.target.value)}
                      placeholder="0-30"
                      error={errors.buyLpFee}
                      tooltip="% of buy fee to liquidity pool (no wallet)"
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
                      {["buyMarketingFee", "buyDevFee", "buyLpFee"]
                        .map((f) => Number(formData[f] || 0))
                        .reduce((a, b) => a + b, 0)}
                      %
                    </span>{" "}
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
                      placeholder="0-30"
                      error={errors.sellMarketingFee}
                      tooltip="% of sell fee to marketing wallet"
                    />
                    <Input
                      label="Dev Sell Fee (%)"
                      type="number"
                      value={formData.sellDevFee}
                      onChange={(e) =>
                        handleChange("sellDevFee", e.target.value)
                      }
                      placeholder="0-30"
                      error={errors.sellDevFee}
                      tooltip="% of sell fee to dev wallet"
                    />
                    <Input
                      label="LP Sell Fee (%)"
                      type="number"
                      value={formData.sellLpFee}
                      onChange={(e) =>
                        handleChange("sellLpFee", e.target.value)
                      }
                      placeholder="0-30"
                      error={errors.sellLpFee}
                      tooltip="% of sell fee to liquidity pool (no wallet)"
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
                      {["sellMarketingFee", "sellDevFee", "sellLpFee"]
                        .map((f) => Number(formData[f] || 0))
                        .reduce((a, b) => a + b, 0)}
                      %
                    </span>{" "}
                    {errors.totalSellFee && (
                      <span className="ml-2 text-red-400 font-semibold">
                        ({errors.totalSellFee})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-center mt-6">
                <motion.div
                  initial={{ scale: 1 }}
                  animate={
                    errors.totalFee
                      ? { scale: [1, 1.05, 1], x: [0, -5, 5, 0] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.5 }}
                  className={
                    errors.totalFee
                      ? "rounded-lg px-4 py-3 text-base font-semibold flex items-center gap-2 shadow-md bg-red-900 text-red-200 border-2 border-red-400"
                      : "rounded-lg px-4 py-3 text-base font-semibold flex items-center gap-2 shadow-md bg-yellow-900 text-yellow-200 border border-yellow-600"
                  }
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
                        "sellMarketingFee",
                        "sellDevFee",
                        "sellLpFee",
                      ]
                        .map((f) => Number(formData[f] || 0))
                        .reduce((a, b) => a + b, 0)}
                      %
                      {errors.totalFee ? (
                        <span className="text-red-400 font-bold ml-2">
                          ({errors.totalFee})
                        </span>
                      ) : (
                        <span className="text-yellow-300 font-bold ml-2">
                          (must not exceed 60%)
                        </span>
                      )}
                    </span>
                  </span>
                </motion.div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4 mt-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-1.5 h-6 bg-cyan-400 rounded" />
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Anti-Whale Limits
                  </h3>
                  <p className="text-sm text-gray-400">
                    Set limits to prevent large transfers or wallet holdings.
                  </p>
                </div>
              </div>

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

            <div className="bg-gray-800 rounded-lg p-4 mt-8 border border-cyan-900">
              <h4 className="text-xl text-cyan-300 font-semibold mb-2">
                Summary
              </h4>
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
                  {formData.buyDevFee || 0}%, LP {formData.buyLpFee || 0}%
                </li>
                <li>
                  <span className="font-bold">Sell Fees:</span> Marketing{" "}
                  {formData.sellMarketingFee || 0}%, Dev{" "}
                  {formData.sellDevFee || 0}%, LP {formData.sellLpFee || 0}%
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
                  !!errors.totalSellFee ||
                  !isConnected ||
                  chainId !== 56 ||
                  insufficientFunds
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
              {insufficientFunds && (
                <div className="text-red-400 text-sm mt-2 text-center">
                  You need at least 0.005 BNB for gas to deploy a token. Your
                  current balance is {balance || "1"} BNB.
                </div>
              )}
            </motion.div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Deploy;
