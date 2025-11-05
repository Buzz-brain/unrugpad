import { motion } from 'framer-motion';
import { AlertCircle, Info } from 'lucide-react';
import { useState } from 'react';

const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  tooltip,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-gray-200">
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {tooltip && (
            <div className="relative">
              <Info
                size={16}
                className="text-gray-400 cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              />
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-6 top-0 w-64 bg-gray-800 text-white text-xs p-3 rounded-lg shadow-xl border border-gray-700 z-50"
                >
                  {tooltip}
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-3 bg-gray-800/50 border ${
            error ? 'border-red-500' : 'border-gray-700'
          } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
          {...props}
        />
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 mt-2 text-red-400 text-sm"
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Input;
