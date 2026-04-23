console.log('extractDeployInfo starting');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const providerUrl = process.env.BSC_RPC_URL;
  if (!providerUrl) throw new Error('BSC_RPC_URL not set in .env');
  console.log('Using RPC:', providerUrl);
  const provider = new ethers.providers.JsonRpcProvider(providerUrl);

  const deployed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployed_addresses.json'), 'utf8'));
  const factoryAddress = deployed.factory;
  const proxyAddress = process.argv[2] || deployed.token || '0x6a8845de84C16902e452c8B3De364558c3A988a9';

  const abiPath = path.join(__dirname, '..', 'frontend', 'src', 'abis', 'UnrugpadTokenFactory.json');
  if (!fs.existsSync(abiPath)) throw new Error(`Factory ABI not found: ${abiPath}`);
  const factoryAbi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;
  const factoryIface = new ethers.utils.Interface(factoryAbi);

  console.log('Factory:', factoryAddress);
  console.log('Proxy/Token address to find:', proxyAddress);

  // TokenCreated event signature
  const eventFragment = factoryIface.getEvent('TokenCreated');
  const topic0 = factoryIface.getEventTopic(eventFragment);

  // padded address as topic1 (32 bytes)
  const topic1 = ethers.utils.hexZeroPad(ethers.utils.getAddress(proxyAddress), 32);

  console.log('Searching logs for TokenCreated -> this may take a few seconds...');
  const logs = await provider.getLogs({
    address: factoryAddress,
    topics: [topic0, topic1],
    fromBlock: 0,
    toBlock: 'latest',
  });

  if (!logs || logs.length === 0) {
    console.error('No TokenCreated log found for this token from the factory.');
    process.exit(2);
  }

  const log = logs[0];
  console.log('Found TokenCreated log in tx:', log.transactionHash);

  const parsed = factoryIface.parseLog(log);
  console.log('Event fields:');
  console.log('  tokenAddress:', parsed.args.tokenAddress);
  console.log('  creator:', parsed.args.creator);
  console.log('  name:', parsed.args.name);
  console.log('  symbol:', parsed.args.symbol);
  console.log('  totalSupply:', parsed.args.totalSupply.toString());

  // Fetch transaction and decode input
  const tx = await provider.getTransaction(log.transactionHash);
  if (!tx) {
    console.error('Could not fetch transaction details');
    process.exit(3);
  }

  let parsedTx;
  try {
    parsedTx = factoryIface.parseTransaction({ data: tx.data, value: tx.value });
  } catch (e) {
    console.error('Failed to parse transaction input with factory ABI:', e.message || e);
    process.exit(4);
  }

  console.log('\nDecoded createToken call:');
  // args[0] is the TokenConfig struct, args[1] is metadata
  const config = parsedTx.args[0];
  const metadata = parsedTx.args[1];

  console.log('Transaction hash:', log.transactionHash);
  console.log('\nTokenConfig:');
  console.log('  name:', config.name);
  console.log('  symbol:', config.symbol);
  console.log('  totalSupply:', config.totalSupply.toString());
  console.log('  owner:', config.owner);
  console.log('  marketingWallet:', config.marketingWallet);
  console.log('  devWallet:', config.devWallet);
  console.log('  taxWallet:', config.taxWallet || '(not present)');
  if (config.buyFees) {
    console.log('  buyFees:', {
      marketing: config.buyFees.marketing?.toString(),
      dev: config.buyFees.dev?.toString(),
      lp: config.buyFees.lp?.toString(),
    });
  }
  if (config.sellFees) {
    console.log('  sellFees:', {
      marketing: config.sellFees.marketing?.toString(),
      dev: config.sellFees.dev?.toString(),
      lp: config.sellFees.lp?.toString(),
    });
  }
  console.log('  buyFee:', config.buyFee?.toString());
  console.log('  sellFee:', config.sellFee?.toString());

  console.log('\nmetadata string:', metadata);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR', err.message || err);
  process.exit(1);
});
