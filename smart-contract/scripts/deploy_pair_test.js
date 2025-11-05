// Standalone script to compile MockUniswapV2.sol and deploy MockPair.
// Usage: set RPC_URL and PRIVATE_KEY in .env or environment, then run:
//    node deploy_pair_test.js

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');
require('dotenv').config();

const RPC = process.env.RPC_URL || 'http://127.0.0.1:7545';
const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error('Missing PRIVATE_KEY in environment (.env)');
  process.exit(1);
}

async function findImports(importPath) {
  try {
    const resolved = path.resolve(__dirname, importPath);
    return { contents: fs.readFileSync(resolved, 'utf8') };
  } catch (err) {
    return { error: 'File not found' };
  }
}

async function compileSource() {
  const filePath = path.resolve(__dirname, 'MockUniswapV2.sol');
  const source = fs.readFileSync(filePath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'MockUniswapV2.sol': { content: source }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  if (output.errors) {
    for (const e of output.errors) {
      console.error(e.formattedMessage || e.message);
    }
    const fatal = output.errors.some(e => e.severity === 'error');
    if (fatal) throw new Error('Compilation failed');
  }

  const pair = output.contracts['MockUniswapV2.sol']['MockPair'];
  if (!pair) throw new Error('MockPair not found in compiled output');
  return { abi: pair.abi, bytecode: pair.evm.bytecode.object };
}

(async () => {
  console.log('Compiling MockUniswapV2.sol...');
  let compiled;
  try {
    compiled = await compileSource();
  } catch (err) {
    console.error('Compilation error:', err);
    process.exit(1);
  }

  console.log('Bytecode size:', compiled.bytecode.length / 2, 'bytes');

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const factory = new ethers.ContractFactory(compiled.abi, compiled.bytecode, wallet);

  console.log('Deploying MockPair (simple new MockPair())...');
  try {
    const deployTx = factory.getDeployTransaction();
    // add conservative overrides for Ganache
    deployTx.gasLimit = ethers.BigNumber.from('6000000');
    deployTx.gasPrice = ethers.BigNumber.from('20000000000'); // 20 gwei
    deployTx.type = 0; // legacy

    const sent = await wallet.sendTransaction(deployTx);
    console.log('Sent tx hash:', sent.hash);
    const receipt = await sent.wait();
    console.log('Receipt status:', receipt.status);
    console.log('Deployed at:', receipt.contractAddress);
    process.exit(0);
  } catch (err) {
    console.error('Deployment failed:');
    console.error(err);
    // try debug_traceTransaction if provider supports it
    try {
      if (err && err.error && err.error.data && err.error.data.hash) {
        const txHash = err.error.data.hash;
        console.log('Attempting debug_traceTransaction for', txHash);
        const trace = await provider.send('debug_traceTransaction', [txHash, {}]);
        console.log('Trace:', JSON.stringify(trace, null, 2));
      }
    } catch (traceErr) {
      console.error('Trace failed:', traceErr && traceErr.message ? traceErr.message : traceErr);
    }
    process.exit(1);
  }
})();
