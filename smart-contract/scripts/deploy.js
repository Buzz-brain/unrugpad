// scripts/deploy.js

// Export default function so Hardhat will call it with the Hardhat Runtime Environment (hre)
export default async function (hre) {
	console.log(`Running deploy script — network: ${hre.network.name}`);
	const UnrugpadToken = await hre.ethers.getContractFactory("UnrugpadToken");
	console.log('Got contract factory for UnrugpadToken');
	const instance = await UnrugpadToken.deploy(/* constructor args if any */);
	console.log('Deploy transaction sent, waiting for deployment...');
	await instance.deployed();
	console.log("UnrugpadToken deployed to:", instance.address);
}
