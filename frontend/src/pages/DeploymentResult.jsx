import { motion } from 'framer-motion';
import { CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import Button from '../components/Button';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';
import { triggerVerification, checkVerificationStatus } from '../utils/api';

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
  const [verifyStatus, setVerifyStatus] = useState('pending');
  // "pending" | "verifying" | "verified" | "already_verified" | "failed"
  const [implAddress, setImplAddress] = useState(null);
  const [verifyExplorer, setVerifyExplorer] = useState(null);

  useEffect(() => {
    if (!location.state?.deployment) {
      setGlobalError('Deployment result not found. Please deploy a token first.');
    }
  }, [location]);

  // Trigger verification in background as soon as proxy address is available
  useEffect(() => {
    if (!deployment?.address) return;

    const runVerification = async () => {
      setVerifyStatus('verifying');
      try {
        const resp = await triggerVerification(deployment.address);
        const result = resp?.data || {};
        const statusVal = resp?.status === 202 || result.status === 'verifying' ? 'verifying' : (result.status || (result.verified ? 'verified' : 'pending'));
        setVerifyStatus(statusVal);
        setImplAddress(result.implAddress || null);
        setVerifyExplorer(result.explorerUrl || (result.verified ? `${explorerBase}${deployment.address}#code` : null));
        // If not yet verified, poll the status endpoint until verified
        if (statusVal !== 'verified' && statusVal !== 'already_verified') {
          let attempts = 0;
          const maxAttempts = 20;
          const intervalMs = 8000;
          const poll = async () => {
            try {
              attempts += 1;
              const s = await checkVerificationStatus(deployment.address);
              if (s?.verified) {
                setVerifyStatus('verified');
                setVerifyExplorer(`${explorerBase}${deployment.address}#code`);
                return;
              }
              if (attempts < maxAttempts) {
                setTimeout(poll, intervalMs);
              } else {
                setVerifyStatus('failed');
              }
            } catch (e) {
              console.warn('[verify] poll error', e);
              if (attempts < maxAttempts) setTimeout(poll, intervalMs);
              else setVerifyStatus('failed');
            }
          };
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        console.warn('[verify] Background verification failed:', err.message);
        setVerifyStatus('failed');
      }
    };

    runVerification();
  }, [deployment?.address]);

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

  // Verification badge component
  const VerificationBadge = () => {
    if (verifyStatus === 'verifying') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-yellow-400 animate-pulse">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Verifying contract...
        </span>
      );
    }

    if (verifyStatus === 'verified' || verifyStatus === 'already_verified') {
      return (
        <a
          href={verifyExplorer}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Contract Verified
        </a>
      );
    }

    if (verifyStatus === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          Verification pending — check BscScan shortly
        </span>
      );
    }

    return null;
  };

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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white">
                <CheckCircle size={18} />
              </div>
              <div className="text-sm">
                <div className="font-semibold text-white">Deployed</div>
                <div className="text-gray-400">Transaction confirmed</div>
              </div>
            </div>

            <div className="hidden sm:block w-12 h-px bg-gray-700" />
            <div className="block sm:hidden h-12 w-px bg-gray-700" />

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
                    <VerificationBadge />
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
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                What's Next?
              </h3>
              <p className="text-gray-400">
                Manage your token, add liquidity, or view analytics
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
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
              <Button className="w-full sm:w-auto" onClick={() => navigate("/dashboard")}> 
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
