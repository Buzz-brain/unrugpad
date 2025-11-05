import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';

dotenv.config();

async function main() {
  console.log('Starting manual deploy script');

  const rpc = process.env.ALCHEMY_API_URL || process.env.INFURA_URL;
  const pkRaw = process.env.PRIVATE_KEY || '';
  if (!rpc) throw new Error('Missing RPC URL in ALCHEMY_API_URL or INFURA_URL in .env');
  if (!pkRaw) throw new Error('Missing PRIVATE_KEY in .env');

  const privateKey = pkRaw.startsWith('0x') ? pkRaw : '0x' + pkRaw;
  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);

  console.log('Using deployer address:', await wallet.getAddress());
  const network = await provider.getNetwork();
  console.log('Network:', network.name, 'chainId', network.chainId);

  // Read compiled artifact
  const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'UnrugpadToken.sol', 'UnrugpadToken.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Please run npx hardhat compile first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log('Deploying UnrugpadToken...');
  // Add constructor args inside deploy(...) if needed
  const contract = await factory.deploy();
  console.log('Transaction hash:', contract.deploymentTransaction().hash);
  console.log('Waiting for deployment to be mined...');
  await contract.waitForDeployment();
  const deployedAddress = await contract.getAddress();
  console.log('UnrugpadToken deployed to:', deployedAddress);

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
  addresses.sepolia.UnrugpadToken = deployedAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`Saved deployed address to ${addressesPath}`);
}

main().catch((err) => {
  console.error('Manual deploy failed:', err);
  process.exit(1);
});
