import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function RpcHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('openRpcHelp', handler);
    return () => window.removeEventListener('openRpcHelp', handler);
  }, []);

  const recommended = [
    { name: 'Binance Public', url: 'https://bsc-dataseed.binance.org/' },
    { name: 'PublicNode', url: 'https://bsc.publicnode.com' },
  ];

  const copy = (u) => navigator.clipboard.writeText(u).then(() => alert('Copied to clipboard'));

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Fix RPC Issues" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-300">Your wallet's RPC endpoint can affect gas estimation and transaction reliability. If you see RPC errors or rate limits, change your MetaMask BSC network RPC URL to one of the recommended endpoints below.</p>
        <div className="space-y-2">
          {recommended.map(r => (
            <div key={r.url} className="flex items-center justify-between bg-gray-800 p-3 rounded">
              <div>
                <div className="text-white text-sm font-medium">{r.name}</div>
                <div className="text-xs text-gray-400">{r.url}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(r.url)}>Copy</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-400">After changing the RPC in MetaMask, reload this page.</div>
      </div>
    </Modal>
  );
}
