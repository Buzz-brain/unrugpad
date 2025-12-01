
import React from 'react';
import Button from '../components/Button';
import { Wallet, ExternalLink, Download } from 'lucide-react';
import { useWalletModal } from '../contexts/WalletModalContext';
import { useWeb3 } from '../contexts/Web3Context';

const WalletModal = () => {
  const { show, error, loading, close, setError, setLoading } = useWalletModal();
  const { connectors, connectWallet } = useWeb3();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-6 w-full max-w-sm mx-2 relative">
        {/* Company Logo */}
        <img
          src="/logo.png"
          alt="Unrugpad company logo"
          role="img"
          aria-label="Unrugpad logo"
          className="w-16 h-16 rounded-full object-contain bg-white mb-2 border-2 border-cyan-400 shadow"
        />
        <h2 className="text-2xl font-bold text-white mb-1">Connect Your Wallet</h2>
        <p className="text-gray-300 text-center mb-2 text-base">To continue, connect a wallet. You can install MetaMask or use WalletConnect to connect a mobile or desktop wallet.</p>
        <div className="flex flex-col gap-3 w-full">
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button
              type="button"
              size="sm"
              className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold border-0"
            >
              <Download size={18} />
              Install MetaMask
              <ExternalLink size={16} />
            </Button>
          </a>
          <Button
            onClick={async () => {
              setError('');
              if (!connectors || !connectors[1]) {
                setError('WalletConnect connector not available.');
                return;
              }
              try {
                setLoading(true);
                await connectWallet({ connector: connectors[1] });
                close();
              } catch (err) {
                setError('Could not connect via WalletConnect. Check network and try again.');
              } finally {
                setLoading(false);
              }
            }}
            size="sm"
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold border-0"
          >
            <Wallet size={18} />
            {loading ? 'Connecting...' : 'Connect with WalletConnect'}
          </Button>
        </div>
        {error && <div className="text-sm text-red-400 mt-2 text-center w-full">{error}</div>}
        <Button
          onClick={close}
          size="sm"
          className="w-full gap-2 bg-gray-700 hover:bg-gray-800 text-white mt-2 border-0"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default WalletModal;
