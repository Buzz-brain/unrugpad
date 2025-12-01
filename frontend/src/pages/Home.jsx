import { motion } from 'framer-motion';
import { Rocket, Shield, Zap, TrendingUp, Lock, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import { useWeb3 } from '../contexts/Web3Context';

const Home = () => {
  const navigate = useNavigate();
  const { isConnected, connectWallet } = useWeb3();

  const features = [
    {
      icon: <Rocket size={32} />,
      title: 'Easy Deployment',
      description: 'Deploy upgradable BSC tokens in minutes with our intuitive interface',
    },
    {
      icon: <Shield size={32} />,
      title: 'Secure & Audited',
      description: 'Built on battle-tested smart contracts with security as priority',
    },
    {
      icon: <Zap size={32} />,
      title: 'Lightning Fast',
      description: 'Optimized for speed with instant confirmations and minimal gas fees',
    },
    {
      icon: <Lock size={32} />,
      title: 'Full Control',
      description: 'Maintain complete ownership and control of your deployed tokens',
    },
    // {
    //   icon: <TrendingUp size={32} />,
    //   title: 'Market Ready',
    //   description: 'Instantly tradeable with built-in Uniswap integration',
    // },
    {
      icon: <Code size={32} />,
      title: 'Upgradable',
      description: 'Future-proof your token with upgradable smart contract architecture',
    },
  ];

  const handleGetStarted = () => {
    if (isConnected) {
      navigate('/deploy');
    } else {
      connectWallet();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block mb-6"
          >
            <div className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
              <span className="text-cyan-400 text-sm font-semibold">
                The Future of Token Launches
              </span>
            </div>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent animate-gradient bg-300%">
              Launch Your Token
            </span>
            <br />
            <span className="text-white">Without Coding</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Deploy secure, upgradable BSC tokens in minutes. No coding required.
            Full transparency, complete control, zero compromises.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" onClick={handleGetStarted}>
              <Rocket size={20} />
              {isConnected ? "Deploy Now" : "Connect & Deploy"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/dashboard")}
            >
              View Dashboard
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-6 mb-20"
          // className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
            >
              <Card glow>
                <div className="text-cyan-400 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center"
        >
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-cyan-500/30 flex flex-col items-center p-10">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Launch?
            </h2>
            <p className="text-gray-300 mb-6 text-lg">
              Join thousands of projects that trust Unrugpad for their token
              launches
            </p>
            <Button size="lg" onClick={handleGetStarted}>
              Get Started Now
            </Button>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
