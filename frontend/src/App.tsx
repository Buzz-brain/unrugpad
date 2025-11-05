import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Web3Provider } from './contexts/Web3Context';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Deploy from './pages/Deploy';
import DeploymentResult from './pages/DeploymentResult';
import Dashboard from './pages/Dashboard';
import Uniswap from './pages/Uniswap';

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="min-h-screen bg-gray-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/result" element={<DeploymentResult />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/uniswap" element={<Uniswap />} />
          </Routes>
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
    </Web3Provider>
  );
}

export default App;
