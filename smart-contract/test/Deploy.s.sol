// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../contracts/UnrugpadToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployUnrugpadToken is Script {
    // Sepolia Uniswap V2 Router
    address constant SEPOLIA_ROUTER = 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008;
    
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy implementation
        console.log("\n=== Deploying Implementation ===");
        UnrugpadToken implementation = new UnrugpadToken();
        console.log("Implementation deployed at:", address(implementation));
        
        // Setup deployment parameters
        string memory tokenName = "My Token";
        string memory tokenSymbol = "MTK";
        uint256 totalSupply = 1_000_000 * 10**18; // 1 million tokens
        
        // Wallets - REPLACE THESE WITH YOUR ACTUAL ADDRESSES
        address owner = deployer; // Token owner
        address marketingWallet = vm.envAddress("MARKETING_WALLET");
        address devWallet = vm.envAddress("DEV_WALLET");
        address platformWallet = vm.envAddress("PLATFORM_WALLET"); // Unrugpad wallet
        
        console.log("\n=== Deployment Parameters ===");
        console.log("Token Name:", tokenName);
        console.log("Token Symbol:", tokenSymbol);
        console.log("Total Supply:", totalSupply);
        console.log("Owner:", owner);
        console.log("Marketing Wallet:", marketingWallet);
        console.log("Dev Wallet:", devWallet);
        console.log("Platform Wallet (Unrugpad):", platformWallet);
        
        // Setup fee structure
        UnrugpadToken.Fees memory buyFees = UnrugpadToken.Fees({
            marketing: 100,  // 1%
            dev: 100,        // 1%
            lp: 100,         // 1%
            burn: 0
        });
        
        UnrugpadToken.Fees memory sellFees = UnrugpadToken.Fees({
            marketing: 200,  // 2%
            dev: 200,        // 2%
            lp: 100,         // 1%
            burn: 0
        });
        
        console.log("\n=== Fee Structure ===");
        console.log("Buy Fees - Marketing: 1%, Dev: 1%, LP: 1%");
        console.log("Sell Fees - Marketing: 2%, Dev: 2%, LP: 1%");
        console.log("Platform Fee (Unrugpad): 0.3% on all trades");
        console.log("Total Buy Fee: 3.3%");
        console.log("Total Sell Fee: 5.3%");
        
        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            tokenName,
            tokenSymbol,
            totalSupply,
            owner,
            marketingWallet,
            devWallet,
            platformWallet,
            buyFees,
            sellFees,
            SEPOLIA_ROUTER
        );
        
        // Deploy proxy
        console.log("\n=== Deploying Proxy ===");
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("Proxy deployed at:", address(proxy));
        
        UnrugpadToken token = UnrugpadToken(payable(address(proxy)));
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("Token Name:", token.name());
        console.log("Token Symbol:", token.symbol());
        console.log("Total Supply:", token.totalSupply());
        console.log("Owner Balance:", token.balanceOf(owner));
        console.log("Owner Address:", token.owner());
        console.log("Uniswap Pair:", token.uniswapV2Pair());
        console.log("Platform Wallet:", token.platformWallet());
        console.log("Platform Fee:", token.getPlatformFee(), "basis points (0.3%)");
        
        vm.stopBroadcast();
        
        // Save deployment info
        console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
        console.log("Save these addresses:");
        console.log("Implementation:", address(implementation));
        console.log("Proxy (Token):", address(proxy));
        console.log("Uniswap V2 Pair:", token.uniswapV2Pair());
        console.log("\n=== Next Steps ===");
        console.log("1. Verify contracts on Etherscan");
        console.log("2. Add liquidity to the pair");
        console.log("3. Renounce ownership (optional)");
    }
}

contract DeployWithCustomParams is Script {
    // For custom deployments with specific parameters
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy implementation
        UnrugpadToken implementation = new UnrugpadToken();
        
        // Custom parameters - modify as needed
        UnrugpadToken.Fees memory buyFees = UnrugpadToken.Fees({
            marketing: 50,   // 0.5%
            dev: 50,         // 0.5%
            lp: 50,          // 0.5%
            burn: 0
        });
        
        UnrugpadToken.Fees memory sellFees = UnrugpadToken.Fees({
            marketing: 100,  // 1%
            dev: 100,        // 1%
            lp: 50,          // 0.5%
            burn: 0
        });
        
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            vm.envString("TOKEN_NAME"),
            vm.envString("TOKEN_SYMBOL"),
            vm.envUint("TOTAL_SUPPLY"),
            vm.envAddress("OWNER"),
            vm.envAddress("MARKETING_WALLET"),
            vm.envAddress("DEV_WALLET"),
            vm.envAddress("PLATFORM_WALLET"),
            buyFees,
            sellFees,
            vm.envAddress("ROUTER_ADDRESS")
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        
        console.log("Implementation:", address(implementation));
        console.log("Proxy:", address(proxy));
        
        vm.stopBroadcast();
    }
}