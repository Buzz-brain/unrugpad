// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/UnrugpadToken.sol";
import "forge-std/console.sol";
import "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployUnrugpadToken is Script {
    // Configuration parameters
    struct TokenConfig {
        string name;
        string symbol;
        uint256 totalSupply;
        address owner;
        address marketingWallet;
        address devWallet;
        address platformWallet;
        address routerAddress;
    }
    
    struct FeeConfig {
        uint256 buyMarketing;
        uint256 buyDev;
        uint256 buyLp;
        uint256 sellMarketing;
        uint256 sellDev;
        uint256 sellLp;
        uint256 additionalBuyFee;
        uint256 additionalSellFee;
    }
    
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get configuration from environment or use defaults
        TokenConfig memory config = getTokenConfig();
        FeeConfig memory fees = getFeeConfig();
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy implementation contract
        UnrugpadToken implementation = new UnrugpadToken();
        console.log("Implementation deployed at:", address(implementation));
        
        // 2. Prepare initialization data
        UnrugpadToken.Fees memory buyFees = UnrugpadToken.Fees({
            marketing: fees.buyMarketing,
            dev: fees.buyDev,
            lp: fees.buyLp
        });
        
        UnrugpadToken.Fees memory sellFees = UnrugpadToken.Fees({
            marketing: fees.sellMarketing,
            dev: fees.sellDev,
            lp: fees.sellLp
        });
        
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            config.name,
            config.symbol,
            config.totalSupply,
            config.owner,
            config.marketingWallet,
            config.devWallet,
            config.platformWallet,
            buyFees,
            sellFees,
            fees.additionalBuyFee,
            fees.additionalSellFee,
            config.routerAddress
        );
        
        // 3. Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed at:", address(proxy));
        
        vm.stopBroadcast();
        
        // Log deployment information
        console.log("\n=== Deployment Summary ===");
        console.log("Token Name:", config.name);
        console.log("Token Symbol:", config.symbol);
        console.log("Total Supply:", config.totalSupply);
        console.log("Owner:", config.owner);
        console.log("Marketing Wallet:", config.marketingWallet);
        console.log("Dev Wallet:", config.devWallet);
        console.log("Platform Wallet:", config.platformWallet);
        console.log("Router:", config.routerAddress);
        console.log("\n=== Buy Fees ===");
        console.log("Marketing:", fees.buyMarketing, "bps");
        console.log("Dev:", fees.buyDev, "bps");
        console.log("LP:", fees.buyLp, "bps");
        console.log("Additional:", fees.additionalBuyFee, "bps");
        console.log("\n=== Sell Fees ===");
        console.log("Marketing:", fees.sellMarketing, "bps");
        console.log("Dev:", fees.sellDev, "bps");
        console.log("LP:", fees.sellLp, "bps");
        console.log("Additional:", fees.additionalSellFee, "bps");
        console.log("\n=== Platform Fee ===");
        console.log("Platform Fee (all trades): 30 bps (0.3%)");
    }
    
    function getTokenConfig() internal view returns (TokenConfig memory) {
        return TokenConfig({
            name: vm.envOr("TOKEN_NAME", string("Unrugpad Token")),
            symbol: vm.envOr("TOKEN_SYMBOL", string("UNRUG")),
            totalSupply: vm.envOr("TOTAL_SUPPLY", uint256(1000000 * 10**18)), // 1M tokens
            owner: vm.envOr("OWNER_ADDRESS", address(msg.sender)),
            marketingWallet: vm.envOr("MARKETING_WALLET", address(0x1111111111111111111111111111111111111111)),
            devWallet: vm.envOr("DEV_WALLET", address(0x2222222222222222222222222222222222222222)),
            platformWallet: vm.envOr("PLATFORM_WALLET", address(0x3333333333333333333333333333333333333333)),
            // Uniswap V2 Router addresses by network:
            // Ethereum Mainnet: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
            // Sepolia: 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008
            // Base: 0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24
            routerAddress: vm.envOr("ROUTER_ADDRESS", address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D))
        });
    }
    
    function getFeeConfig() internal view returns (FeeConfig memory) {
        return FeeConfig({
            // Buy fees (in basis points: 100 = 1%)
            buyMarketing: vm.envOr("BUY_MARKETING_FEE", uint256(200)), // 2%
            buyDev: vm.envOr("BUY_DEV_FEE", uint256(100)), // 1%
            buyLp: vm.envOr("BUY_LP_FEE", uint256(100)), // 1%
            additionalBuyFee: vm.envOr("ADDITIONAL_BUY_FEE", uint256(0)), // 0%
            
            // Sell fees (in basis points)
            sellMarketing: vm.envOr("SELL_MARKETING_FEE", uint256(300)), // 3%
            sellDev: vm.envOr("SELL_DEV_FEE", uint256(200)), // 2%
            sellLp: vm.envOr("SELL_LP_FEE", uint256(100)), // 1%
            additionalSellFee: vm.envOr("ADDITIONAL_SELL_FEE", uint256(0)) // 0%
        });
    }
}
