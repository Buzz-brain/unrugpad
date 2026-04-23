// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../contracts/UnrugpadToken.sol";

contract UnrugpadTokenTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════

    UnrugpadToken public implementation;
    UnrugpadTokenFactory public factory;

    // Sepolia Uniswap V2 Router and addresses
    address public SEPOLIA_ROUTER;
    address public constant SEPOLIA_PLATFORM_WALLET = address(0xD5f2aE5AD4001a402C10Aa313acDdfEC1277Ab18); // replace with your actual platform wallet

    // Test actors
    address public platformOwner;
    address public tokenDeployer;
    address public buyer;
    address public seller;
    address public marketingWallet;
    address public devWallet;
    address public taxWallet;
    address public newTaxManager;

    // Deployed token reference
    UnrugpadToken public token;
    address public tokenAddress;

    // ═══════════════════════════════════════════════════════════════════════════
    // SETUP
    // ═══════════════════════════════════════════════════════════════════════════

    function setUp() public {
         MockUniswapRouter mockRouter = new MockUniswapRouter();
SEPOLIA_ROUTER = address(mockRouter);

        // Set up test actors
        platformOwner  = makeAddr("platformOwner");
        tokenDeployer  = makeAddr("tokenDeployer");
        buyer          = makeAddr("buyer");
        seller         = makeAddr("seller");
        marketingWallet = makeAddr("marketingWallet");
        devWallet      = makeAddr("devWallet");
        taxWallet      = makeAddr("taxWallet");
        newTaxManager  = makeAddr("newTaxManager");

        // Give everyone some ETH to pay gas
        vm.deal(platformOwner, 100 ether);
        vm.deal(tokenDeployer, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(seller, 100 ether);

        // Deploy implementation and factory as platformOwner
        vm.startPrank(platformOwner);

        implementation = new UnrugpadToken();

        factory = new UnrugpadTokenFactory(
            address(implementation),
            platformOwner, // platform wallet receives 0.3%
            SEPOLIA_ROUTER
        );

        vm.stopPrank();

        // Deploy a test token as tokenDeployer
        _deployTestToken();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER — deploys a standard test token
    // ═══════════════════════════════════════════════════════════════════════════

    function _deployTestToken() internal {
        UnrugpadToken.Fees memory buyFees = UnrugpadToken.Fees({
            marketing: 200, // 2%
            dev: 100,       // 1%
            lp: 100         // 1%
        });

        UnrugpadToken.Fees memory sellFees = UnrugpadToken.Fees({
            marketing: 200, // 2%
            dev: 100,       // 1%
            lp: 100         // 1%
        });

        UnrugpadToken.TokenConfig memory config = UnrugpadToken.TokenConfig({
            name: "Test Token",
            symbol: "TST",
            totalSupply: 1_000_000 * 10**18,
            owner: tokenDeployer,
            marketingWallet: marketingWallet,
            devWallet: devWallet,
            buyFees: buyFees,
            sellFees: sellFees,
            buyFee: 500,   // 5% custom buy tax
            sellFee: 500,  // 5% custom sell tax
            taxWallet: taxWallet
        });

        vm.prank(tokenDeployer);
        tokenAddress = factory.createToken(config, "test-metadata");
        token = UnrugpadToken(payable(tokenAddress));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. FACTORY TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_FactoryDeployedCorrectly() public {
        assertEq(factory.platformWallet(), platformOwner);
        assertEq(factory.tokenImplementation(), address(implementation));
        assertEq(factory.defaultRouter(), SEPOLIA_ROUTER);
        assertFalse(factory.deploymentsPaused());
    }

    function test_FactoryTracksDeployedTokens() public {
        assertEq(factory.getTotalTokensCreated(), 1);
        assertEq(factory.getTokenAtIndex(0), tokenAddress);
        assertTrue(factory.isTokenFromFactory(tokenAddress));
    }

    function test_FactoryTracksUserTokens() public {
        address[] memory tokens = factory.getUserTokens(tokenDeployer);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], tokenAddress);
    }

    function test_FactoryDeploymentIsFree() public {
        // Deployment should succeed with zero BNB sent
        UnrugpadToken.TokenConfig memory config = UnrugpadToken.TokenConfig({
            name: "Free Token",
            symbol: "FREE",
            totalSupply: 1_000_000 * 10**18,
            owner: tokenDeployer,
            marketingWallet: marketingWallet,
            devWallet: devWallet,
            buyFees: UnrugpadToken.Fees(100, 100, 100),
            sellFees: UnrugpadToken.Fees(100, 100, 100),
            buyFee: 100,
            sellFee: 100,
            taxWallet: taxWallet
        });

        vm.prank(tokenDeployer);
        address newToken = factory.createToken(config, "");
        assertTrue(newToken != address(0));
    }

    function test_FactoryRevertsMissingTaxWallet() public {
        UnrugpadToken.TokenConfig memory config = UnrugpadToken.TokenConfig({
            name: "Bad Token",
            symbol: "BAD",
            totalSupply: 1_000_000 * 10**18,
            owner: tokenDeployer,
            marketingWallet: marketingWallet,
            devWallet: devWallet,
            buyFees: UnrugpadToken.Fees(100, 100, 100),
            sellFees: UnrugpadToken.Fees(100, 100, 100),
            buyFee: 100,
            sellFee: 100,
            taxWallet: address(0) // missing tax wallet
        });

        vm.prank(tokenDeployer);
        vm.expectRevert("Tax wallet cannot be zero");
        factory.createToken(config, "");
    }

    function test_FactoryRevertsFeesExceed30Percent() public {
        UnrugpadToken.TokenConfig memory config = UnrugpadToken.TokenConfig({
            name: "High Fee Token",
            symbol: "HFT",
            totalSupply: 1_000_000 * 10**18,
            owner: tokenDeployer,
            marketingWallet: marketingWallet,
            devWallet: devWallet,
            buyFees: UnrugpadToken.Fees(1500, 1500, 100),
            sellFees: UnrugpadToken.Fees(100, 100, 100),
            buyFee: 100,
            sellFee: 100,
            taxWallet: taxWallet
        });

        vm.prank(tokenDeployer);
        vm.expectRevert("Total buy fees exceed 30%");
        factory.createToken(config, "");
    }

    function test_FactoryPauseAndUnpause() public {
        vm.prank(platformOwner);
        factory.setDeploymentsPaused(true);

        UnrugpadToken.TokenConfig memory config = UnrugpadToken.TokenConfig({
            name: "Paused Token",
            symbol: "PAU",
            totalSupply: 1_000_000 * 10**18,
            owner: tokenDeployer,
            marketingWallet: marketingWallet,
            devWallet: devWallet,
            buyFees: UnrugpadToken.Fees(100, 100, 100),
            sellFees: UnrugpadToken.Fees(100, 100, 100),
            buyFee: 100,
            sellFee: 100,
            taxWallet: taxWallet
        });

        vm.prank(tokenDeployer);
        vm.expectRevert("Deployments are paused");
        factory.createToken(config, "");

        // Unpause and try again
        vm.prank(platformOwner);
        factory.setDeploymentsPaused(false);

        vm.prank(tokenDeployer);
        address newToken = factory.createToken(config, "");
        assertTrue(newToken != address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. TOKEN INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_TokenInitializedCorrectly() public {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TST");
        assertEq(token.totalSupply(), 1_000_000 * 10**18);
        assertEq(token.owner(), tokenDeployer);
        assertEq(token.marketingWallet(), marketingWallet);
        assertEq(token.devWallet(), devWallet);
        assertEq(token.taxWallet(), taxWallet); // FIX 1
        assertEq(token.platformWallet(), platformOwner);
        assertEq(token.buyFee(), 500);
        assertEq(token.sellFee(), 500);
    }

    function test_TokenDeployerReceivesFullSupply() public {
        assertEq(token.balanceOf(tokenDeployer), 1_000_000 * 10**18);
    }

    function test_PlatformFeeIsCorrect() public {
        assertEq(token.PLATFORM_FEE(), 30); // 0.3%
    }

    function test_TaxManagerSetToDeployerAtLaunch() public {
        assertEq(token.taxManager(), tokenDeployer); // FIX 3
    }

    function test_OwnershipNotRenouncedAtLaunch() public {
        assertFalse(token.ownershipRenounced()); // FIX 3
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. TAX WALLET TESTS (FIX 1)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_TaxWalletSetCorrectly() public {
        assertEq(token.taxWallet(), taxWallet);
    }

    function test_TaxWalletIsFeeExempt() public {
        assertTrue(token.isExcludedFromFees(taxWallet));
    }

    function test_OwnerCanUpdateTaxWallet() public {
        address newTaxWallet = makeAddr("newTaxWallet");

        vm.prank(tokenDeployer);
        token.setTaxWallet(newTaxWallet);

        assertEq(token.taxWallet(), newTaxWallet);
    }

    function test_NonOwnerCannotUpdateTaxWallet() public {
        address newTaxWallet = makeAddr("newTaxWallet");

        vm.prank(buyer);
        vm.expectRevert();
        token.setTaxWallet(newTaxWallet);
    }

    function test_TaxWalletCannotBeZeroAddress() public {
        vm.prank(tokenDeployer);
        vm.expectRevert("Tax wallet cannot be zero");
        token.setTaxWallet(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. TAX MANAGER TESTS (FIX 3)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_SetTaxManager() public {
        vm.prank(tokenDeployer);
        token.setTaxManager(newTaxManager);
        assertEq(token.taxManager(), newTaxManager);
    }

    function test_NonOwnerCannotSetTaxManager() public {
        vm.prank(buyer);
        vm.expectRevert();
        token.setTaxManager(newTaxManager);
    }

    function test_TaxManagerCannotBeZero() public {
        vm.prank(tokenDeployer);
        vm.expectRevert("Tax manager cannot be zero");
        token.setTaxManager(address(0));
    }

    function test_TransferTaxManager() public {
        vm.prank(tokenDeployer);
        token.setTaxManager(newTaxManager);

        vm.prank(newTaxManager);
        token.transferTaxManager(buyer);

        assertEq(token.taxManager(), buyer);
    }

    function test_NonTaxManagerCannotTransferRole() public {
        vm.prank(buyer);
        vm.expectRevert("Not tax manager");
        token.transferTaxManager(seller);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. RENOUNCE WITH TAX CONTROL TESTS (FIX 3)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RenounceOwnershipWithTaxControl() public {
        uint256 buyFeeBefore = token.buyFee();
        uint256 sellFeeBefore = token.sellFee();

        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        // Ownership should be zero address
        assertEq(token.owner(), address(0));

        // Renounced flag set
        assertTrue(token.ownershipRenounced());

        // Ceilings locked in at renounce values
        assertEq(token.buyFeeCeiling(), buyFeeBefore);
        assertEq(token.sellFeeCeiling(), sellFeeBefore);
    }

    function test_NonOwnerCannotRenounce() public {
        vm.prank(buyer);
        vm.expectRevert();
        token.renounceOwnershipWithTaxControl();
    }

    function test_OwnerFunctionsLockedAfterRenounce() public {
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        // Owner functions should now revert
        vm.prank(tokenDeployer);
        vm.expectRevert();
        token.setMarketingWallet(makeAddr("newMarketing"));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. REDUCE CUSTOM TAX TESTS (FIX 3)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_CanReduceTaxAfterRenounce() public {
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        vm.prank(tokenDeployer); // tokenDeployer is still taxManager
        token.reduceCustomTax(300, 300); // reduce from 5% to 3%

        assertEq(token.buyFee(), 300);
        assertEq(token.sellFee(), 300);
    }

    function test_CannotReduceTaxBeforeRenounce() public {
        vm.prank(tokenDeployer);
        vm.expectRevert("Ownership not yet renounced");
        token.reduceCustomTax(300, 300);
    }

    function test_CannotIncreaseTaxAfterRenounce() public {
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        // Try to increase above ceiling (500)
        vm.prank(tokenDeployer);
        vm.expectRevert("Cannot exceed original buy fee");
        token.reduceCustomTax(600, 300);
    }

    function test_CannotSetTaxAboveCeiling() public {
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        vm.prank(tokenDeployer);
        vm.expectRevert("Cannot exceed original sell fee");
        token.reduceCustomTax(300, 600);
    }

    function test_CanReduceTaxToZero() public {
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        vm.prank(tokenDeployer);
        token.reduceCustomTax(0, 0);

        assertEq(token.buyFee(), 0);
        assertEq(token.sellFee(), 0);
    }

    function test_NonTaxManagerCannotReduceTax() public {
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        vm.prank(buyer);
        vm.expectRevert("Not tax manager");
        token.reduceCustomTax(300, 300);
    }

    function test_CanOnlyReduceNotIncrease() public {
        // First reduce to 3%
        vm.prank(tokenDeployer);
        token.renounceOwnershipWithTaxControl();

        vm.prank(tokenDeployer);
        token.reduceCustomTax(300, 300);

        // Now try to go back up to 4% — should fail
        vm.prank(tokenDeployer);
        vm.expectRevert("Can only reduce buy fee");
        token.reduceCustomTax(400, 300);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. FEE CONFIGURATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_TotalBuyFeeIncludesPlatformFee() public {
        // marketing(2%) + dev(1%) + lp(1%) + buyFee(5%) + platform(0.3%) = 9.3%
        uint256 totalBuy = token.getTotalBuyFee();
        assertEq(totalBuy, 200 + 100 + 100 + 500 + 30);
    }

    function test_TotalSellFeeIncludesPlatformFee() public {
        uint256 totalSell = token.getTotalSellFee();
        assertEq(totalSell, 200 + 100 + 100 + 500 + 30);
    }

    function test_OwnerCanUpdateBuyFees() public {
        vm.prank(tokenDeployer);
        token.setBuyFees(300, 200, 100);

        (uint256 marketing, uint256 dev, uint256 lp) = (
            token.getBuyFees().marketing,
            token.getBuyFees().dev,
            token.getBuyFees().lp
        ) ;
        assertEq(marketing, 300);
        assertEq(dev, 200);
        assertEq(lp, 100);
    }

    function test_OwnerCanUpdateSellFees() public {
        vm.prank(tokenDeployer);
        token.setSellFees(300, 200, 100);

        assertEq(token.getSellFees().marketing, 300);
        assertEq(token.getSellFees().dev, 200);
        assertEq(token.getSellFees().lp, 100);
    }

    function test_FeesCannotExceed30Percent() public {
        vm.prank(tokenDeployer);
        vm.expectRevert("Total buy fees exceed 30%");
        token.setBuyFees(1500, 1500, 500); // exceeds 30%
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. WALLET TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_OwnerCanUpdateMarketingWallet() public {
        address newMarketing = makeAddr("newMarketing");
        vm.prank(tokenDeployer);
        token.setMarketingWallet(newMarketing);
        assertEq(token.marketingWallet(), newMarketing);
    }

    function test_OwnerCanUpdateDevWallet() public {
        address newDev = makeAddr("newDev");
        vm.prank(tokenDeployer);
        token.setDevWallet(newDev);
        assertEq(token.devWallet(), newDev);
    }

    function test_WalletCannotBeZeroAddress() public {
        vm.prank(tokenDeployer);
        vm.expectRevert("Marketing wallet cannot be zero");
        token.setMarketingWallet(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. LIMITS TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_LimitsSetCorrectlyAtLaunch() public {
        uint256 supply = token.totalSupply();
        assertEq(token.maxTransactionAmount(), (supply * 50) / 10000); // 0.5%
        assertEq(token.maxWalletAmount(), (supply * 50) / 10000);      // 0.5%
        assertTrue(token.limitsInEffect());
    }

    function test_OwnerCanRemoveLimits() public {
        vm.prank(tokenDeployer);
        token.removeLimits();
        assertFalse(token.limitsInEffect());
    }

    function test_OwnerCanUpdateLimits() public {
        uint256 supply = token.totalSupply();
        uint256 newMax = (supply * 100) / 10000; // 1%

        vm.prank(tokenDeployer);
        token.updateLimits(newMax, newMax);

        assertEq(token.maxTransactionAmount(), newMax);
        assertEq(token.maxWalletAmount(), newMax);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. TRADING PAUSE TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_OwnerCanPauseTrading() public {
        vm.prank(tokenDeployer);
        token.setTradingPaused(true);
        assertTrue(token.tradingPaused());
    }

    function test_OwnerCanUnpauseTrading() public {
        vm.prank(tokenDeployer);
        token.setTradingPaused(true);

        vm.prank(tokenDeployer);
        token.setTradingPaused(false);
        assertFalse(token.tradingPaused());
    }

    function test_TransferFailsWhenPaused() public {
        vm.prank(tokenDeployer);
        token.setTradingPaused(true);

        vm.prank(tokenDeployer);
        vm.expectRevert("Trading is paused");
        token.transfer(buyer, 1000 * 10**18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. FACTORY ADMIN TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_PlatformOwnerCanUpdatePlatformWallet() public {
        address newWallet = makeAddr("newPlatformWallet");
        vm.prank(platformOwner);
        factory.setPlatformWallet(newWallet);
        assertEq(factory.platformWallet(), newWallet);
    }

    function test_NonOwnerCannotUpdatePlatformWallet() public {
        vm.prank(tokenDeployer);
        vm.expectRevert();
        factory.setPlatformWallet(makeAddr("hacker"));
    }

    function test_PlatformOwnerCanUpdateImplementation() public {
        UnrugpadToken newImpl = new UnrugpadToken();
        vm.prank(platformOwner);
        factory.setImplementation(address(newImpl));
        assertEq(factory.tokenImplementation(), address(newImpl));
    }

    function test_PlatformOwnerCanTransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(platformOwner);
        factory.transferOwnership(newOwner);
        assertEq(factory.owner(), newOwner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. CIRCULATING SUPPLY TEST
    // ═══════════════════════════════════════════════════════════════════════════

    function test_CirculatingSupply() public {
        uint256 supply = token.totalSupply();
        assertEq(token.getCirculatingSupply(), supply);
    }
}

contract MockUniswapRouter {
    address public WETH;
    address public mockFactory;
    address public mockPair;

    constructor() {
        WETH = address(new MockWETH());
        mockFactory = address(new MockUniswapFactory());
        mockPair = address(0x999);
    }

    function factory() external view returns (address) {
        return mockFactory;
    }

    function addLiquidityETH(
        address, uint256, uint256, uint256, address, uint256
    ) external payable returns (uint256, uint256, uint256) {
        return (0, 0, 0);
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256, uint256, address[] calldata, address, uint256
    ) external {}
}

contract MockUniswapFactory {
    address public mockPair;

    constructor() {
        mockPair = address(new MockUniswapPair());
    }

    function createPair(address, address) external view returns (address) {
        return mockPair;
    }

    function getPair(address, address) external view returns (address) {
        return mockPair;
    }
}

contract MockUniswapPair {
    // Empty pair — just needs to exist as a contract
}

contract MockWETH {
    // Empty WETH — just needs to exist as a contract
}