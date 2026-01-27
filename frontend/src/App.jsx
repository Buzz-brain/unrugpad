import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Web3Provider } from './contexts/Web3Context';
import { WalletModalProvider } from './contexts/WalletModalContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Deploy from './pages/Deploy';
import DeploymentResult from './pages/DeploymentResult';
import Dashboard from './pages/Dashboard';
import Uniswap from './pages/Uniswap';
import WalletModal from './components/WalletModal';
import { lazy, Suspense } from 'react';
import RpcWarning from './components/RpcWarning';
import RpcHelpModal from './components/RpcHelpModal';

function App() {
  // detect rpc from window.ethereum if available (do not use useWeb3 here)
  const rpcUrl = (() => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) return '';
      const current = window.ethereum; // provider
      return current.rpcUrl || current._rpcUrl || current.connection?.url || current.host || '';
    } catch (e) { return ''; }
  })();
  return (
    <Web3Provider>
      <WalletModalProvider>
        <Router>
          <div className="min-h-screen bg-gray-900 pb-20">
            <Navbar />
            <div className="container mx-auto px-4 mt-4">
              <RpcWarning rpcUrl={rpcUrl} onOpenHelp={() => window.dispatchEvent(new CustomEvent('openRpcHelp'))} />
            </div>
            <WalletModal />
            <RpcHelpModal />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/deploy" element={<Deploy />} />
              <Route path="/result" element={<DeploymentResult />} />
              <Route path="/dashboard" element={
                <Suspense fallback={<div className="text-center text-white py-20">Loading dashboard...</div>}>
                  <Dashboard />
                </Suspense>
              } />
              <Route path="/uniswap" element={
                <Suspense fallback={<div className="text-center text-white py-20">Loading Uniswap...</div>}>
                  <Uniswap />
                </Suspense>
              } />
            </Routes>
            <Footer />
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"
            />
          </div>
        </Router>
      </WalletModalProvider>
    </Web3Provider>
  );
}

export default App;
