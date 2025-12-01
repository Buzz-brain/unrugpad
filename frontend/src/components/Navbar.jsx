import { motion } from 'framer-motion';
import { Wallet, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import Button from './Button';
import { useWalletModal } from '../contexts/WalletModalContext';
const Navbar = () => {
  const { account, balance, isConnecting, connectWallet, disconnectWallet, isConnected, connectors, chainId } = useWeb3();
  const { open: openWalletModal } = useWalletModal();
  const hasInjected = typeof window !== 'undefined' && window.ethereum;
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/deploy', label: 'Deploy' },
    { path: '/dashboard', label: 'Dashboard' },
    // { path: '/uniswap', label: 'Uniswap' },
  ];

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = () => {
    if (hasInjected) {
      connectWallet();
    } else {
      openWalletModal();
    }
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="Company Logo"
              className="w-10 h-10 rounded-full object-contain bg-white mb-2 border-2 border-cyan-400 shadow"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Unrugpad
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className="relative group">
                <span
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "text-cyan-400"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
                {location.pathname === item.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600"
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-gray-400">Balance</span>
                  <span className="text-sm font-semibold text-white">
                    {chainId === 56 ? balance : "0"} BNB
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={disconnectWallet}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-colors"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-white">
                    {formatAddress(account)}
                  </span>
                </motion.button>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleConnect}
                  loading={isConnecting}
                  size="sm"
                  className="gap-2"
                >
                  <Wallet size={18} />
                  Connect Wallet
                </Button>
                {/* Wallet modal is now global via WalletModalContext */}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
