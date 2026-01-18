import React from 'react';

const Skeleton = ({ className = '', circle = false }) => {
  return (
    <div
      className={`animate-pulse bg-gray-700/40 ${circle ? 'rounded-full' : 'rounded'} ${className}`}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
