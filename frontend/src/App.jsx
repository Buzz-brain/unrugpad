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

function App() {
  return (
    <Web3Provider>
      <WalletModalProvider>
        <Router>
          <div className="min-h-screen bg-gray-900 pb-20">
            <Navbar />
            <WalletModal />
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
