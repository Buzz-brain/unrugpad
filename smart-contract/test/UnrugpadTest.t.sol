// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {UnrugpadToken} from "../src/UnrugpadToken.sol";
import {ERC1967Proxy} from "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Mock Uniswap V2 contracts for testing
contract MockUniswapV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        pair = address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB, block.timestamp)))));
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}

contract MockUniswapV2Router {
    address public immutable factory;
    address public immutable WETH;
    
    constructor(address _factory, address _weth) {
        factory = _factory;
        WETH = _weth;
    }
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint,
        uint,
        address,
        uint
    ) external payable returns (uint, uint, uint) {
        return (amountTokenDesired, msg.value, 0);
    }
    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint,
        address[] calldata,
        address to,
        uint
    ) external {
        // Mock swap - send proportional ETH
        uint ethToSend = amountIn / 1000; // Mock rate
        if (address(this).balance >= ethToSend) {
            payable(to).transfer(ethToSend);
        }
    }
    
    receive() external payable {}
}

contract UnrugpadTokenTest is Test {
    UnrugpadToken public token;
    UnrugpadToken public implementation;
    ERC1967Proxy public proxy;
    
    MockUniswapV2Factory public factory;
    MockUniswapV2Router public router;
    address public weth;
    
    address public owner;
    address public marketingWallet;
    address public devWallet;
    address public platformWallet;
    address public user1;
    address public user2;
    address public user3;
    
    uint256 constant TOTAL_SUPPLY = 1_000_000 * 10**18; // 1M tokens
    uint256 constant DENOMINATOR = 10000;
    
    event FeesUpdated(string feeType, uint256 marketing, uint256 dev, uint256 lp);
    event WalletUpdated(string walletType, address indexed newWallet);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event PlatformFeeCollected(uint256 amount);
    
    function setUp() public {
        // Setup addresses
        owner = address(this);
        marketingWallet = makeAddr("marketing");
        devWallet = makeAddr("dev");
        platformWallet = makeAddr("platform");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // Deploy mock Uniswap contracts
        weth = makeAddr("weth");
        factory = new MockUniswapV2Factory();
        router = new MockUniswapV2Router(address(factory), weth);
        
        // Fund router with ETH for swaps
        vm.deal(address(router), 100 ether);
        
        // Deploy implementation
        implementation = new UnrugpadToken();
        
        // Prepare initialization data
        UnrugpadToken.Fees memory buyFees = UnrugpadToken.Fees({
            marketing: 200, // 2%
            dev: 100,       // 1%
            lp: 100         // 1%
        });
        
        UnrugpadToken.Fees memory sellFees = UnrugpadToken.Fees({
            marketing: 300, // 3%
            dev: 200,       // 2%
            lp: 100         // 1%
        });
        
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            "Unrugpad Token",
            "UNRUG",
            TOTAL_SUPPLY,
            owner,
            marketingWallet,
            devWallet,
            platformWallet,
            buyFees,
            sellFees,
            0, // additional buy fee
            0, // additional sell fee
            address(router)
        );
        
        // Deploy proxy
        proxy = new ERC1967Proxy(address(implementation), initData);
        token = UnrugpadToken(payable(address(proxy)));
        
        // Give users some tokens for testing
        vm.prank(owner);
        token.transfer(user1, 10000 * 10**18);
    }
    
    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testInitialization() public view {
        assertEq(token.name(), "Unrugpad Token");
        assertEq(token.symbol(), "UNRUG");
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
        assertEq(token.owner(), owner);
        assertEq(token.marketingWallet(), marketingWallet);
        assertEq(token.devWallet(), devWallet);
        assertEq(token.platformWallet(), platformWallet);
        
        (uint256 buyMarketing, uint256 buyDev, uint256 buyLp) = token.buyFees();
        assertEq(buyMarketing, 200);
        assertEq(buyDev, 100);
        assertEq(buyLp, 100);
        
        (uint256 sellMarketing, uint256 sellDev, uint256 sellLp) = token.sellFees();
        assertEq(sellMarketing, 300);
        assertEq(sellDev, 200);
        assertEq(sellLp, 100);
        
        assertEq(token.PLATFORM_FEE(), 30); // 0.3%
    }
    
    function testCannotInitializeTwice() public {
        UnrugpadToken.Fees memory fees = UnrugpadToken.Fees(0, 0, 0);
        
        vm.expectRevert();
        token.initialize(
            "Test",
            "TST",
            1000,
            owner,
            marketingWallet,
            devWallet,
            platformWallet,
            fees,
            fees,
            0,
            0,
            address(router)
        );
    }
    
    function testInitializationWithZeroAddressesFails() public {
        implementation = new UnrugpadToken();
        UnrugpadToken.Fees memory fees = UnrugpadToken.Fees(100, 100, 100);
        
        // Test zero owner
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            "Test", "TST", 1000, address(0), marketingWallet, devWallet, platformWallet,
            fees, fees, 0, 0, address(router)
        );
        
        vm.expectRevert("Owner cannot be zero");
        new ERC1967Proxy(address(implementation), initData);
    }
    
    function testInitializationWithExcessiveFeesFails() public {
        implementation = new UnrugpadToken();
        
        // Test excessive buy fees (>30% total)
        UnrugpadToken.Fees memory excessiveFees = UnrugpadToken.Fees(1500, 1500, 1500);
        UnrugpadToken.Fees memory normalFees = UnrugpadToken.Fees(100, 100, 100);
        
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            "Test", "TST", 1000, owner, marketingWallet, devWallet, platformWallet,
            excessiveFees, normalFees, 0, 0, address(router)
        );
        
        vm.expectRevert("Total buy fees exceed 30%");
        new ERC1967Proxy(address(implementation), initData);
    }
    
    /*//////////////////////////////////////////////////////////////
                            FEE CONFIGURATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetBuyFees() public {
        vm.expectEmit(true, true, true, true);
        emit FeesUpdated("buy", 250, 150, 50);
        
        token.setBuyFees(250, 150, 50);
        
        (uint256 marketing, uint256 dev, uint256 lp) = token.buyFees();
        assertEq(marketing, 250);
        assertEq(dev, 150);
        assertEq(lp, 50);
    }
    
    function testSetSellFees() public {
        vm.expectEmit(true, true, true, true);
        emit FeesUpdated("sell", 400, 200, 100);
        
        token.setSellFees(400, 200, 100);
        
        (uint256 marketing, uint256 dev, uint256 lp) = token.sellFees();
        assertEq(marketing, 400);
        assertEq(dev, 200);
        assertEq(lp, 100);
    }
    
    function testSetBuyFeesExceedsMaxFails() public {
        vm.expectRevert("Total buy fees exceed 30%");
        token.setBuyFees(1500, 1500, 1500);
    }
    
    function testSetBuyFee() public {
        token.setBuyFee(500); // 5%
        assertEq(token.buyFee(), 500);
    }
    
    function testSetSellFee() public {
        token.setSellFee(600); // 6%
        assertEq(token.sellFee(), 600);
    }
    
    function testOnlyOwnerCanSetFees() public {
        vm.prank(user1);
        vm.expectRevert();
        token.setBuyFees(100, 100, 100);
        
        vm.prank(user1);
        vm.expectRevert();
        token.setSellFees(100, 100, 100);
    }
    
    /*//////////////////////////////////////////////////////////////
                            WALLET CONFIGURATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetMarketingWallet() public {
        address newWallet = makeAddr("newMarketing");
        
        vm.expectEmit(true, true, true, true);
        emit WalletUpdated("marketing", newWallet);
        
        token.setMarketingWallet(newWallet);
        assertEq(token.marketingWallet(), newWallet);
    }
    
    function testSetDevWallet() public {
        address newWallet = makeAddr("newDev");
        token.setDevWallet(newWallet);
        assertEq(token.devWallet(), newWallet);
    }
    
    function testSetPlatformWallet() public {
        address newWallet = makeAddr("newPlatform");
        token.setPlatformWallet(newWallet);
        assertEq(token.platformWallet(), newWallet);
    }
    
    function testSetWalletToZeroAddressFails() public {
        vm.expectRevert("Marketing wallet cannot be zero");
        token.setMarketingWallet(address(0));
        
        vm.expectRevert("Dev wallet cannot be zero");
        token.setDevWallet(address(0));
        
        vm.expectRevert("Platform wallet cannot be zero");
        token.setPlatformWallet(address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                            FEE EXEMPTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetFeeExempt() public {
        assertEq(token.isFeeExempt(user2), false);
        
        vm.expectEmit(true, true, true, true);
        emit FeeExemptUpdated(user2, true);
        
        token.setFeeExempt(user2, true);
        assertEq(token.isFeeExempt(user2), true);
        
        token.setFeeExempt(user2, false);
        assertEq(token.isFeeExempt(user2), false);
    }
    
    function testDefaultFeeExemptions() public view {
        assertTrue(token.isFeeExempt(owner));
        assertTrue(token.isFeeExempt(address(token)));
        assertTrue(token.isFeeExempt(marketingWallet));
        assertTrue(token.isFeeExempt(devWallet));
        assertTrue(token.isFeeExempt(platformWallet));
    }
    
    /*//////////////////////////////////////////////////////////////
                            TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testBasicTransfer() public {
        uint256 amount = 1000 * 10**18;
        uint256 ownerBalanceBefore = token.balanceOf(owner);
        
        token.transfer(user2, amount);
        
        assertEq(token.balanceOf(user2), amount);
        assertEq(token.balanceOf(owner), ownerBalanceBefore - amount);
    }
    
    function testTransferBetweenNonPairsNoFees() public {
        uint256 amount = 1000 * 10**18;
        
        vm.prank(user1);
        token.transfer(user2, amount);
        
        assertEq(token.balanceOf(user2), amount);
        assertEq(token.balanceOf(user1), 9000 * 10**18);
    }
    
    function testFeeExemptTransferNoFees() public {
        uint256 amount = 1000 * 10**18;
        uint256 initialBalance = token.balanceOf(owner);
        
        token.transfer(marketingWallet, amount);
        
        // No fees should be taken
        assertEq(token.balanceOf(marketingWallet), amount);
        assertEq(token.balanceOf(owner), initialBalance - amount);
    }
    
    /*//////////////////////////////////////////////////////////////
                            LIMITS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMaxTransactionAmount() public view {
        uint256 maxTx = token.maxTransactionAmount();
        uint256 expectedMaxTx = (TOTAL_SUPPLY * 50) / DENOMINATOR; // 0.5%
        assertEq(maxTx, expectedMaxTx);
    }
    
    function testMaxWalletAmount() public view {
        uint256 maxWallet = token.maxWalletAmount();
        uint256 expectedMaxWallet = (TOTAL_SUPPLY * 50) / DENOMINATOR; // 0.5%
        assertEq(maxWallet, expectedMaxWallet);
    }
    
    function testSetLimits() public {
        uint256 newMaxTx = TOTAL_SUPPLY / 100; // 1%
        uint256 newMaxWallet = TOTAL_SUPPLY / 50; // 2%
        
        token.setLimits(newMaxTx, newMaxWallet);
        
        assertEq(token.maxTransactionAmount(), newMaxTx);
        assertEq(token.maxWalletAmount(), newMaxWallet);
    }
    
    function testSetLimitsTooLowFails() public {
        uint256 tooLow = TOTAL_SUPPLY / 2000; // 0.05%
        
        vm.expectRevert("Max tx too low");
        token.setLimits(tooLow, TOTAL_SUPPLY / 100);
        
        vm.expectRevert("Max wallet too low");
        token.setLimits(TOTAL_SUPPLY / 100, tooLow);
    }
    
    function testRemoveLimits() public {
        assertTrue(token.limitsInEffect());
        
        token.removeLimits();
        
        assertFalse(token.limitsInEffect());
    }
    
    /*//////////////////////////////////////////////////////////////
                            PAIR MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetPair() public {
        address newPair = makeAddr("newPair");
        
        token.setPair(newPair, true);
        assertTrue(token.isPair(newPair));
        
        token.setPair(newPair, false);
        assertFalse(token.isPair(newPair));
    }
    
    function testCannotRemoveMainPair() public {
        address mainPair = token.uniswapV2Pair();
        
        vm.expectRevert("Cannot remove main pair");
        token.setPair(mainPair, false);
    }
    
    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetTotalBuyFee() public view {
        uint256 totalBuyFee = token.getTotalBuyFee();
        // 200 (marketing) + 100 (dev) + 100 (lp) + 0 (additional) + 30 (platform) = 430
        assertEq(totalBuyFee, 430);
    }
    
    function testGetTotalSellFee() public view {
        uint256 totalSellFee = token.getTotalSellFee();
        // 300 (marketing) + 200 (dev) + 100 (lp) + 0 (additional) + 30 (platform) = 630
        assertEq(totalSellFee, 630);
    }
    
    function testGetPlatformFee() public view {
        assertEq(token.getPlatformFee(), 30);
    }
    
    /*//////////////////////////////////////////////////////////////
                            SWAP THRESHOLD TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetSwapTokensAtAmount() public {
        uint256 newAmount = TOTAL_SUPPLY / 1000; // 0.1%
        
        token.setSwapTokensAtAmount(newAmount);
        assertEq(token.swapTokensAtAmount(), newAmount);
    }
    
    function testSetSwapTokensAtAmountTooLowFails() public {
        uint256 tooLow = TOTAL_SUPPLY / 200000; // Too low
        
        vm.expectRevert("Amount too low");
        token.setSwapTokensAtAmount(tooLow);
    }
    
    function testSetSwapTokensAtAmountTooHighFails() public {
        uint256 tooHigh = TOTAL_SUPPLY / 50; // Too high
        
        vm.expectRevert("Amount too high");
        token.setSwapTokensAtAmount(tooHigh);
    }
    
    /*//////////////////////////////////////////////////////////////
                            UPGRADE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testOnlyOwnerCanUpgrade() public {
        UnrugpadToken newImplementation = new UnrugpadToken();
        
        vm.prank(user1);
        vm.expectRevert();
        token.upgradeToAndCall(address(newImplementation), "");
    }
    
    function testUpgrade() public {
        UnrugpadToken newImplementation = new UnrugpadToken();
        
        // Upgrade
        token.upgradeToAndCall(address(newImplementation), "");
        
        // Verify state is preserved
        assertEq(token.name(), "Unrugpad Token");
        assertEq(token.symbol(), "UNRUG");
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }
    
    /*//////////////////////////////////////////////////////////////
                            RECEIVE ETH TEST
    //////////////////////////////////////////////////////////////*/
    
    function testReceiveETH() public {
        uint256 amount = 1 ether;
        
        (bool success,) = address(token).call{value: amount}("");
        assertTrue(success);
        assertEq(address(token).balance, amount);
    }
    
    /*//////////////////////////////////////////////////////////////
                            EDGE CASES
    //////////////////////////////////////////////////////////////*/
    
    function testTransferZeroAmount() public {
        uint256 balanceBefore = token.balanceOf(user2);
        
        vm.prank(user1);
        token.transfer(user2, 0);
        
        assertEq(token.balanceOf(user2), balanceBefore);
    }
    
    function testMultipleTransfers() public {
        uint256 amount = 100 * 10**18;
        
        vm.startPrank(user1);
        token.transfer(user2, amount);
        token.transfer(user3, amount);
        vm.stopPrank();
        
        assertEq(token.balanceOf(user2), amount);
        assertEq(token.balanceOf(user3), amount);
    }
    
    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzTransfer(uint256 amount) public {
        // Bound amount to not exceed user1's balance
        amount = bound(amount, 0, token.balanceOf(user1));
        
        // Also bound to not exceed max wallet amount for user2
        uint256 maxWallet = token.maxWalletAmount();
        uint256 user2Balance = token.balanceOf(user2);
        
        // If user2 would exceed max wallet, reduce the amount
        if (user2Balance + amount > maxWallet) {
            amount = maxWallet > user2Balance ? maxWallet - user2Balance : 0;
        }
        
        uint256 expectedBalance = user2Balance + amount;
        
        vm.prank(user1);
        token.transfer(user2, amount);
        
        assertEq(token.balanceOf(user2), expectedBalance);
    }
    
    function testFuzzSetBuyFees(uint256 marketing, uint256 dev, uint256 lp) public {
        marketing = bound(marketing, 0, 1000);
        dev = bound(dev, 0, 1000);
        lp = bound(lp, 0, 1000);
        
        vm.assume(marketing + dev + lp <= 3000);
        
        token.setBuyFees(marketing, dev, lp);
        
        (uint256 m, uint256 d, uint256 l) = token.buyFees();
        assertEq(m, marketing);
        assertEq(d, dev);
        assertEq(l, lp);
    }
    
    receive() external payable {}
}
