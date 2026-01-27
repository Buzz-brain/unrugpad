import React from 'react';
import Button from './Button';

export default function RpcWarning({ rpcUrl, onOpenHelp }) {
  if (!rpcUrl) return null;
  // Basic heuristics for known bad providers
  const lower = rpcUrl.toLowerCase();
  const isInfura = lower.includes('infura') || lower.includes('bsc-mainnet.infura');

  if (!isInfura) return null;

  return (
    <div className="bg-yellow-900 border border-yellow-700 text-yellow-50 px-4 py-3 rounded flex items-center justify-between gap-4">
      <div className="text-sm">
        <div className="font-semibold">Unreliable RPC detected</div>
        <div className="text-xs text-yellow-100">Your wallet's RPC endpoint ({rpcUrl}) may be rate-limited. This can cause gas estimation and transaction failures.</div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onOpenHelp}>How to fix</Button>
      </div>
    </div>
  );
}
