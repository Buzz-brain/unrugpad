
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { JsonRpcProvider, Wallet, ContractFactory, Interface } from 'ethers';

dotenv.config();

async function main() {
  console.log('Starting manual deploy script');


  const rpc = process.env.INFURA_API_URL || process.env.ALCHEMY_API_URL || '';
  const pkRaw = process.env.PRIVATE_KEY || '';
  if (!rpc) throw new Error('Missing RPC URL in INFURA_API_URL or ALCHEMY_API_URL in .env');
  if (!pkRaw) throw new Error('Missing PRIVATE_KEY in .env');

  const privateKey = pkRaw.startsWith('0x') ? pkRaw : '0x' + pkRaw;
  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);

  console.log('Using deployer address:', await wallet.getAddress());
  const network = await provider.getNetwork();
  console.log('Network:', network.name, 'chainId', network.chainId);

  // Read UnrugpadToken artifact
  const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'UnrugpadToken.sol', 'UnrugpadToken.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Please run npx hardhat compile first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Read ProxyWrapper artifact for proxy deployment
  const proxyArtifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'ProxyWrapper.sol', 'ProxyWrapper.json');
  if (!fs.existsSync(proxyArtifactPath)) {
    throw new Error(`ProxyWrapper artifact not found at ${proxyArtifactPath}. Please run npx hardhat compile first.`);
  }
  const proxyArtifact = JSON.parse(fs.readFileSync(proxyArtifactPath, 'utf8'));
  const proxyFactory = new ContractFactory(proxyArtifact.abi, proxyArtifact.bytecode, wallet);

  // --- SETUP INITIALIZER ARGS (edit as needed) ---
  // These should match your test setup
  const name = 'UnrugpadToken';
  const symbol = 'UNRUG';
  const totalSupply = BigInt(1_000_000 * 10 ** 18);
  const ownerAddr = await wallet.getAddress();
  const marketingWallet = ownerAddr;
  const devWallet = ownerAddr;
  const platformWallet = ownerAddr;
  // Fees: {marketing, dev, lp, burn} (basis points)
  const buyFees = [100, 100, 100, 0];
  const sellFees = [200, 200, 100, 0];
  // Router: Sepolia UniswapV2 router address (from Deploy.s.sol and deployment context)
  const routerAddress = '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008';

  // Encode Fees struct for initializer
  function encodeFeesStruct(feesArr) {
    // Fees struct: {marketing, dev, lp, burn}
    return {
      marketing: feesArr[0],
      dev: feesArr[1],
      lp: feesArr[2],
      burn: feesArr[3],
    };
  }

  // Prepare initializer data
  const iface = new Interface(artifact.abi);
  const initData = iface.encodeFunctionData('initialize', [
    name,
    symbol,
    totalSupply,
    ownerAddr,
    marketingWallet,
    devWallet,
    platformWallet,
    encodeFeesStruct(buyFees),
    encodeFeesStruct(sellFees),
    routerAddress
  ]);

  // Deploy implementation
  console.log('Deploying UnrugpadToken implementation...');
  const implementation = await factory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();
  console.log('Implementation deployed at:', implementationAddress);

  // Deploy proxy
  console.log('Deploying ERC1967Proxy...');
  const proxy = await proxyFactory.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log('Proxy deployed at:', proxyAddress);

  // Save to backend/deployed_addresses.json
  const addressesPath = path.join(process.cwd(), '..', 'backend', 'deployed_addresses.json');
  let addresses = {};
  if (fs.existsSync(addressesPath)) {
    try {
      addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing deployed_addresses.json, overwriting');
    }
  }
  addresses.sepolia = addresses.sepolia || {};
  addresses.sepolia.UnrugpadToken_Implementation = implementationAddress;
  addresses.sepolia.UnrugpadToken_Proxy = proxyAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`Saved deployed addresses to ${addressesPath}`);
}

main().catch((err) => {
  console.error('Manual deploy failed:', err);
  process.exit(1);
});
