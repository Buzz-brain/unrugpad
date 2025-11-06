import { motion } from 'framer-motion';
import { CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import Button from '../components/Button';
import Card from '../components/Card';

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

  if (!deployment) return null;

  const InfoRow = ({ label, value, copyable = false }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-white font-mono text-sm">
          {value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card glow>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              Token Details
            </h2>
            <div>
              <InfoRow label="Token Name" value={form?.name || "N/A"} />
              <InfoRow label="Symbol" value={form?.symbol || "N/A"} />
              <InfoRow
                label="Total Supply"
                value={form?.totalSupply || "N/A"}
              />
              {deployment?.address && (
                <InfoRow
                  label="Contract Address"
                  value={deployment.address}
                  copyable
                />
              )}
            </div>
          </Card>

          <Card glow>
            <h2 className="text-xl font-bold text-white mb-4">
              Fee Configuration
            </h2>
            <div>
              <InfoRow label="Buy Fee" value={`${form?.buyFee || 0}%`} />
              <InfoRow label="Sell Fee" value={`${form?.sellFee || 0}%`} />
              <InfoRow
                label="Owner"
                value={form?.ownerAddress || "N/A"}
                copyable
              />
              {form?.marketingWallet && (
                <InfoRow
                  label="Marketing Wallet"
                  value={form.marketingWallet}
                  copyable
                />
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
                // onClick={() => window.open(`https://etherscan.io/address/${deployment.address}`, '_blank')}
                onClick={() =>
                  window.open(
                    `https://sepolia.etherscan.io/address/${deployment.address}`,
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
        </Card>
      </div>
    </div>
  );
};

export default DeploymentResult;
