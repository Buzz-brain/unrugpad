// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/UnrugpadToken.sol";
import "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Mock Uniswap contracts for testing
contract MockUniswapV2Factory {
    address public pairAddress;

    function createPair(address, address) external returns (address) {
        pairAddress = address(new MockUniswapV2Pair());
        return pairAddress;
    }
}
contract MockUniswapV2Pair {}
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
        uint ethToSend = amountIn / 1000;
        if (address(this).balance >= ethToSend) {
            payable(to).transfer(ethToSend);
        }
    }

    receive() external payable {}
}
contract MockWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;
}

contract UnrugpadTokenTest is Test {
    UnrugpadToken public implementation;
    UnrugpadToken public token;
    ERC1967Proxy public proxy;

    MockUniswapV2Router public router;
    MockUniswapV2Factory public factory;
    MockWETH public weth;

    address public owner;
    address public marketingWallet;
    address public devWallet;
    address public platformWallet;
    address public user1;
    address public user2;

    uint256 constant TOTAL_SUPPLY = 1_000_000 * 10**18;
    uint256 constant DENOMINATOR = 10000;

    function setUp() public {
        owner = address(this);
        marketingWallet = makeAddr("marketing");
        devWallet = makeAddr("dev");
        platformWallet = makeAddr("platform");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        weth = new MockWETH();
        factory = new MockUniswapV2Factory();
        router = new MockUniswapV2Router(address(factory), address(weth));

        vm.deal(address(router), 100 ether);

        implementation = new UnrugpadToken();

        UnrugpadToken.Fees memory buyFees = UnrugpadToken.Fees({
            marketing: 200,
            dev: 100,
            lp: 100
        });

        UnrugpadToken.Fees memory sellFees = UnrugpadToken.Fees({
            marketing: 300,
            dev: 200,
            lp: 200
        });

        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            "Test Token",
            "TEST",
            TOTAL_SUPPLY,
            owner,
            marketingWallet,
            devWallet,
            platformWallet,
            buyFees,
            sellFees,
            50,
            100,
            address(router)
        );

        proxy = new ERC1967Proxy(address(implementation), initData);
        token = UnrugpadToken(payable(address(proxy)));

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testInitialization() public view {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
        assertEq(token.balanceOf(owner), TOTAL_SUPPLY);
        assertEq(token.owner(), owner);
        assertEq(token.marketingWallet(), marketingWallet);
        assertEq(token.devWallet(), devWallet);
        assertEq(token.platformWallet(), platformWallet);
    }

    function testFeeStructure() public view {
        (uint256 buyMarketing, uint256 buyDev, uint256 buyLp) = token.buyFees();
        assertEq(buyMarketing, 200);
        assertEq(buyDev, 100);
        assertEq(buyLp, 100);

        (uint256 sellMarketing, uint256 sellDev, uint256 sellLp) = token.sellFees();
        assertEq(sellMarketing, 300);
        assertEq(sellDev, 200);
        assertEq(sellLp, 200);

        assertEq(token.buyFee(), 50);
        assertEq(token.sellFee(), 100);
        assertEq(token.PLATFORM_FEE(), 30);
    }

    function testTotalFees() public view {
        assertEq(token.getTotalBuyFee(), 480);
        assertEq(token.getTotalSellFee(), 830);
    }

    function testTransferWithoutFees() public {
        uint256 amount = 1000 * 10**18;
        token.transfer(user1, amount);
        assertEq(token.balanceOf(user1), amount);

        vm.prank(user1);
        token.transfer(user2, amount);
        assertEq(token.balanceOf(user2), amount);
    }

    function testFeeExemptions() public view {
        assertTrue(token.isFeeExempt(owner));
        assertTrue(token.isFeeExempt(address(token)));
        assertTrue(token.isFeeExempt(marketingWallet));
        assertTrue(token.isFeeExempt(devWallet));
        assertTrue(token.isFeeExempt(platformWallet));
    }

    function testSetBuyFees() public {
        token.setBuyFees(250, 150, 150);
        (uint256 m, uint256 d, uint256 l) = token.buyFees();
        assertEq(m, 250);
        assertEq(d, 150);
        assertEq(l, 150);
    }

    function testSetBuyFeesRevertsTooHigh() public {
        vm.expectRevert("Marketing fee too high");
        token.setBuyFees(1600, 100, 100);

        vm.expectRevert("Total buy fees exceed 30%");
        token.setBuyFees(1000, 1000, 1500);
    }

    function testSetSellFees() public {
        token.setSellFees(400, 300, 300);
        (uint256 m, uint256 d, uint256 l) = token.sellFees();
        assertEq(m, 400);
        assertEq(d, 300);
        assertEq(l, 300);
    }

    function testSetSellFeesRevertsTooHigh() public {
        vm.expectRevert("Dev fee too high");
        token.setSellFees(100, 1600, 100);

        vm.expectRevert("Total sell fees exceed 30%");
        token.setSellFees(1000, 1000, 1500);
    }

    function testSetAdditionalBuyFee() public {
        token.setBuyFee(100);
        assertEq(token.buyFee(), 100);
    }

    function testSetAdditionalBuyFeeRevertsTooHigh() public {
        vm.expectRevert("Buy fee too high");
        token.setBuyFee(1501);
    }

    function testSetAdditionalBuyFeeRevertsTotalTooHigh() public {
    token.setBuyFees(983, 983, 984); // 2950
    // Current buyFee = 50 → total = 3000
    vm.expectRevert("Total buy fees exceed 30%");
    token.setBuyFee(51); // 2950 + 51 = 3001
}

    function testSetAdditionalSellFee() public {
        token.setSellFee(200);
        assertEq(token.sellFee(), 200);
    }

    function testSetAdditionalSellFeeRevertsTooHigh() public {
        vm.expectRevert("Sell fee too high");
        token.setSellFee(1501);
    }

   function testSetAdditionalSellFeeRevertsTotalTooHigh() public {
    token.setSellFees(966, 967, 967); // 2900
    // Current sellFee = 100 → total = 3000
    vm.expectRevert("Total sell fees exceed 30%");
    token.setSellFee(101); // 2900 + 101 = 3001
}

    function testSetMarketingWallet() public {
        address newWallet = makeAddr("newMarketing");
        token.setMarketingWallet(newWallet);
        assertEq(token.marketingWallet(), newWallet);
    }

    function testSetMarketingWalletRevertsZeroAddress() public {
        vm.expectRevert("Marketing wallet cannot be zero");
        token.setMarketingWallet(address(0));
    }

    function testSetDevWallet() public {
        address newWallet = makeAddr("newDev");
        token.setDevWallet(newWallet);
        assertEq(token.devWallet(), newWallet);
    }

    function testSetDevWalletRevertsZeroAddress() public {
        vm.expectRevert("Dev wallet cannot be zero");
        token.setDevWallet(address(0));
    }

    function testSetPlatformWallet() public {
        address newWallet = makeAddr("newPlatform");
        token.setPlatformWallet(newWallet);
        assertEq(token.platformWallet(), newWallet);
    }

    function testSetPlatformWalletRevertsZeroAddress() public {
        vm.expectRevert("Platform wallet cannot be zero");
        token.setPlatformWallet(address(0));
    }

    function testSetFeeExempt() public {
        assertFalse(token.isFeeExempt(user1));
        token.setFeeExempt(user1, true);
        assertTrue(token.isFeeExempt(user1));
        token.setFeeExempt(user1, false);
        assertFalse(token.isFeeExempt(user1));
    }

    function testUniswapPairCreated() public view {
        address pair = token.uniswapV2Pair();
        assertTrue(pair != address(0), "Pair should not be zero address");
        assertTrue(token.isPair(pair), "Pair should be marked as pair");
    }

    function testSetPair() public {
        address newPair = makeAddr("newPair");
        token.setPair(newPair, true);
        assertTrue(token.isPair(newPair));
        token.setPair(newPair, false);
        assertFalse(token.isPair(newPair));
    }

    function testSetPairRevertsForMainPair() public {
        address mainPair = token.uniswapV2Pair();
        require(mainPair != address(0), "Main pair is zero - setup issue");

        vm.expectRevert("Cannot remove main pair");
        token.setPair(mainPair, false);

        vm.expectRevert("Cannot remove main pair");
        token.setPair(mainPair, true);
    }

    function testSetSwapTokensAtAmount() public {
        uint256 newAmount = TOTAL_SUPPLY / 1000;
        token.setSwapTokensAtAmount(newAmount);
        assertEq(token.swapTokensAtAmount(), newAmount);
    }

    function testSetSwapTokensAtAmountRevertsTooLow() public {
        vm.expectRevert("Amount too low");
        token.setSwapTokensAtAmount(TOTAL_SUPPLY / 200000);
    }

    function testSetSwapTokensAtAmountRevertsTooHigh() public {
        vm.expectRevert("Amount too high");
        token.setSwapTokensAtAmount(TOTAL_SUPPLY / 50);
    }

    function testTransactionLimits() public view {
        uint256 expected = (TOTAL_SUPPLY * 50) / DENOMINATOR;
        assertEq(token.maxTransactionAmount(), expected);
        assertEq(token.maxWalletAmount(), expected);
        assertTrue(token.limitsInEffect());
    }

    function testSetLimits() public {
        uint256 newTx = TOTAL_SUPPLY / 200;
        uint256 newWallet = TOTAL_SUPPLY / 100;
        token.setLimits(newTx, newWallet);
        assertEq(token.maxTransactionAmount(), newTx);
        assertEq(token.maxWalletAmount(), newWallet);
    }

    function testSetLimitsRevertsTooLow() public {
        vm.expectRevert("Max tx too low");
        token.setLimits(TOTAL_SUPPLY / 2000, TOTAL_SUPPLY / 100);

        vm.expectRevert("Max wallet too low");
        token.setLimits(TOTAL_SUPPLY / 100, TOTAL_SUPPLY / 2000);
    }

    function testRemoveLimits() public {
        assertTrue(token.limitsInEffect());
        token.removeLimits();
        assertFalse(token.limitsInEffect());
    }

    function testOnlyOwnerFunctions() public {
        vm.startPrank(user1);
        vm.expectRevert(); token.setBuyFees(100, 100, 100);
        vm.expectRevert(); token.setSellFees(100, 100, 100);
        vm.expectRevert(); token.setBuyFee(100);
        vm.expectRevert(); token.setSellFee(100);
        vm.expectRevert(); token.setMarketingWallet(user2);
        vm.expectRevert(); token.setDevWallet(user2);
        vm.expectRevert(); token.setPlatformWallet(user2);
        vm.expectRevert(); token.setFeeExempt(user2, true);
        vm.expectRevert(); token.setPair(user2, true);
        vm.expectRevert(); token.setSwapTokensAtAmount(1000);
        vm.expectRevert(); token.setLimits(1000, 1000);
        vm.expectRevert(); token.removeLimits();
        vm.stopPrank();
    }

    function testPlatformFeeConstant() public view {
        assertEq(token.getPlatformFee(), 30);
    }

    function testReceiveETH() public {
        (bool success,) = address(token).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(token).balance, 1 ether);
    }

    function testCannotReinitialize() public {
        UnrugpadToken.Fees memory fees = UnrugpadToken.Fees({
            marketing: 100,
            dev: 100,
            lp: 100
        });

        vm.expectRevert();
        token.initialize(
            "Test", "TST", 1000, owner,
            marketingWallet, devWallet, platformWallet,
            fees, fees, 50, 50, address(router)
        );
    }

    function testZeroAmountTransfer() public {
        token.transfer(user1, 0);
        assertEq(token.balanceOf(user1), 0);
    }
}