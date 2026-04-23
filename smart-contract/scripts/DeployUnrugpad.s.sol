// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../contracts/UnrugpadToken.sol";

contract DeployUnrugpad is Script {

    // ═══════════════════════════════════════════════════════════════════════════
    // SEPOLIA CONFIGURATION
    // Change these values when deploying to BSC Mainnet
    // ═══════════════════════════════════════════════════════════════════════════

    // Sepolia Uniswap V2 Router
    address public constant ROUTER = 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008;

    // Your platform wallet — this receives the 0.3% fee on every buy/sell
    // Replace with your actual wallet address
    address public constant PLATFORM_WALLET = 0xD5f2aE5AD4001a402C10Aa313acDdfEC1277Ab18;

    function run() external {
        // Load deployer private key from .env file
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("==============================================");
        console.log("Deploying Unrugpad Contracts");
        console.log("==============================================");
        console.log("Deployer address:  ", deployer);
        console.log("Router address:    ", ROUTER);
        console.log("Platform wallet:   ", PLATFORM_WALLET);
        console.log("Network:            Sepolia Testnet");
        console.log("==============================================");

        vm.startBroadcast(deployerPrivateKey);

        // ── Step 1: Deploy the Implementation contract ──
        UnrugpadToken implementation = new UnrugpadToken();
        console.log("Implementation deployed at:", address(implementation));

        // ── Step 2: Deploy the Factory contract ──
        UnrugpadTokenFactory factory = new UnrugpadTokenFactory(
            address(implementation),
            PLATFORM_WALLET,
            ROUTER
        );
        console.log("Factory deployed at:       ", address(factory));

        vm.stopBroadcast();

        console.log("==============================================");
        console.log("Deployment Complete!");
        console.log("==============================================");
        console.log("Next steps:");
        console.log("1. Verify implementation on Etherscan/BSCScan");
        console.log("2. Update frontend with new factory address");
        console.log("3. Update backend ABI with new contract ABI");
        console.log("==============================================");
    }
}