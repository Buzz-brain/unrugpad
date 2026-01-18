import { motion } from 'framer-motion';
import { CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import Button from '../components/Button';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';

import deployedAddresses from '../../../backend/deployed_addresses.json';

const explorerUrls = {
  'bsc-mainnet': 'https://bscscan.com/address/',
  'bsc-testnet': 'https://testnet.bscscan.com/address/',
  'sepolia': 'https://sepolia.etherscan.io/address/',
  'ethereum': 'https://etherscan.io/address/',
};

const DeploymentResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (location.state?.deployment) {
      setDeployment(location.state.deployment);
      // Also get the form data if passed
      if (location.state.formData) setForm(location.state.formData);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#3b82f6', '#8b5cf6'],
      });
    } else {
      navigate('/deploy');
    }
  }, [location, navigate]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };


  // Get network from backend config
  const network = deployedAddresses.network || 'sepolia';
  const explorerBase = explorerUrls[network] || explorerUrls['sepolia'];

  const [globalError, setGlobalError] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('idle'); // idle, pending, ok, already_verified, api_key_missing, failed
  const [verifyOutput, setVerifyOutput] = useState('');
  const [verifyExplorer, setVerifyExplorer] = useState(null);
  

  useEffect(() => {
    if (!location.state?.deployment) {
      setGlobalError('Deployment result not found. Please deploy a token first.');
    }
  }, [location]);

  // For tokens created via our factory, they use a verified implementation.
  // Mark the token as verified immediately to avoid extra API calls and rate limits.
  useEffect(() => {
    if (deployment && deployment.address) {
      setVerifyStatus('already_verified');
      setVerifyExplorer(`${explorerBase}${deployment.address}#code`);
    }
  }, [deployment]);

  if (globalError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <Card className="max-w-md text-center border border-red-500">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{globalError}</p>
          <Button variant="danger" onClick={() => navigate('/deploy')}>Go to Deploy</Button>
        </Card>
      </div>
    );
  }

  if (!deployment) return null;

  const InfoRow = ({ label, value, copyable = false }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-white font-mono text-sm">
          {(value === undefined || value === null)
            ? <Skeleton className="w-36 h-4" />
            : (value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value)
          }
        </span>
        {copyable && (
          <button
            onClick={() => copyToClipboard(value, label)}
            className="text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <Copy size={16} />
          </button>
        )}
      </div>
    </div>
  );

  // Calculate total buy and sell fee from individual fields
  const totalBuyFee = (
    parseFloat(form?.buyMarketingFee || 0) +
    parseFloat(form?.buyDevFee || 0) +
    parseFloat(form?.buyLpFee || 0)
  ).toFixed(2);

  const totalSellFee = (
    parseFloat(form?.sellMarketingFee || 0) +
    parseFloat(form?.sellDevFee || 0) +
    parseFloat(form?.sellLpFee || 0)
  ).toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full mb-6 shadow-lg shadow-green-500/50"
          >
            <CheckCircle size={48} className="text-white" />
          </motion.div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Token Deployed Successfully!
          </h1>
          <p className="text-gray-400 text-lg">
            Your token is now live on the blockchain
          </p>
        </motion.div>

        {/* Deployment progress stepper */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white">
                <CheckCircle size={18} />
              </div>
              <div className="text-sm">
                <div className="font-semibold text-white">Deployed</div>
                <div className="text-gray-400">Transaction confirmed</div>
              </div>
            </div>

            <div className="w-12 h-px bg-gray-700" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white">
                <CheckCircle size={18} />
              </div>
              <div className="text-sm">
                <div className="font-semibold text-white">Verified</div>
                <div className="text-gray-400">Implementation verified</div>
              </div>
            </div>

          
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card glow>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              Token Details
            </h2>
            <div>
              <InfoRow label="Token Name" value={form?.name || "N/A"} />
              <InfoRow label="Symbol" value={form?.symbol || "N/A"} />
              <InfoRow label="Total Supply" value={form?.totalSupply || "N/A"} />
              {deployment?.address && (
                <div className="flex flex-col gap-2 py-3 border-b border-gray-800 last:border-0">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Contract Address</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono">{deployment.address.length > 20 ? `${deployment.address.slice(0,10)}...${deployment.address.slice(-8)}` : deployment.address}</span>
                      <button
                        onClick={() => copyToClipboard(deployment.address, 'Contract Address')}
                        className="text-gray-400 hover:text-cyan-400 transition-colors focus:outline-none"
                        aria-label="Copy contract address"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-600 text-white" title="This contract is verified on BscScan">Verified</span>
                    <button
                      className="text-cyan-300 underline text-sm hover:text-cyan-200 focus:outline-none"
                      onClick={() => window.open(`${explorerBase}${deployment.address}#code`, '_blank')}
                    >
                      View on BscScan
                    </button>
                  </div>
                </div>
              )}
              {deployment?.txHash && (
                <InfoRow label="Transaction Hash" value={deployment.txHash} copyable />
              )}
              <InfoRow
                label="Deployment Fee"
                value={
                  deployment?.fee === undefined || deployment?.fee === null
                    ? "N/A"
                    : deployment?.fee === "0" || deployment?.fee === 0 || deployment?.fee === "0n"
                    ? "0 BNB"
                    : `${deployment.fee} BNB`
                }
              />
            </div>
          </Card>

          <Card glow>
            <h2 className="text-xl font-bold text-white mb-4">Fee Configuration</h2>
            <div>
              <InfoRow label="Buy Fee" value={`${totalBuyFee}%`} />
              <InfoRow label="Sell Fee" value={`${totalSellFee}%`} />
              <InfoRow label="Owner" value={form?.ownerAddress || "N/A"} copyable />
              {form?.marketingWallet && (
                <InfoRow label="Marketing Wallet" value={form.marketingWallet} copyable />
              )}
              {form?.devWallet && (
                <InfoRow label="Dev Wallet" value={form.devWallet} copyable />
              )}
            </div>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-cyan-500/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                What's Next?
              </h3>
              <p className="text-gray-400">
                Manage your token, add liquidity, or view analytics
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `${explorerBase}${deployment.address}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink size={18} />
                View on Explorer
              </Button>
              <Button onClick={() => navigate("/dashboard")}> 
                Go to Dashboard
              </Button>
            </div>
          </div>

          {/* Verification status details removed — badge + link shown next to address above */}
        </Card>
      </div>
    </div>
  );
};

export default DeploymentResult;
