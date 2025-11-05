import { motion } from 'framer-motion';

const Card = ({ children, className = '', hover = true, glow = false, ...props }) => {
  const baseStyles = 'bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6';
  const glowStyles = glow ? 'shadow-2xl shadow-cyan-500/20' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={hover ? { y: -4, boxShadow: '0 20px 40px rgba(6, 182, 212, 0.15)' } : {}}
      className={`${baseStyles} ${glowStyles} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
