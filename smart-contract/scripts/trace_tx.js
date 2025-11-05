// trace_tx.js
// Usage: set RPC_URL in .env or environment and run:
// node trace_tx.js <txHash>

const { ethers } = require('ethers');
require('dotenv').config();

const RPC = process.env.RPC_URL || 'http://127.0.0.1:7545';
const txHash = process.argv[2];
if (!txHash) {
  console.error('Usage: node trace_tx.js <txHash>');
  process.exit(1);
}

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  try {
    console.log('Requesting debug_traceTransaction for', txHash);
    const trace = await provider.send('debug_traceTransaction', [txHash, {}]);
    console.log('Trace result:');
    console.log(JSON.stringify(trace, null, 2));
  } catch (err) {
    console.error('debug_traceTransaction failed:', err && err.message ? err.message : err);
    console.error('If your Ganache UI/version does not support debug_traceTransaction you can inspect the tx in the Ganache Transaction view.');
  }
})();
