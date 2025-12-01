// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface IPancakeFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IPancakeRouter02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN CONTRACT (Implementation)
// ═══════════════════════════════════════════════════════════════════════════

contract UnrugpadToken is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    // Fee constants
    uint256 public constant MAX_FEE_PERCENTAGE = 1500; // 15% max for each fee type
    uint256 public constant DENOMINATOR = 10000;
    uint256 public constant PLATFORM_FEE = 30; // 0.3% Unrugpad platform fee
    uint256 public constant MAX_TRANSACTION_AMOUNT = 50; // 0.5% of total supply
    uint256 public constant MAX_WALLET_AMOUNT = 50; // 0.5% of total supply
    uint256 public constant MAX_SWAP_MULTIPLIER = 20; // Max 20x swap threshold
    
    // Version tracking for upgrades
    uint256 public constant VERSION = 1;
   
    // Fee structure
    struct Fees {
        uint256 marketing;
        uint256 dev;
        uint256 lp;
    }
    
    // Deployment configuration struct
    struct TokenConfig {
        string name;
        string symbol;
        uint256 totalSupply;
        address owner;
        address marketingWallet;
        address devWallet;
        Fees buyFees;
        Fees sellFees;
        uint256 buyFee;
        uint256 sellFee;
    }
   
    Fees public buyFees;
    Fees public sellFees;
    uint256 public buyFee;
    uint256 public sellFee;
   
    // Wallets
    address public marketingWallet;
    address public devWallet;
    address public platformWallet;
    address public factory;
   
    // PancakeSwap integration
    IPancakeRouter02 public pancakeRouter;
    address public pancakePair;
   
    // Fee exemptions and pair tracking
    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isPair;
   
    // Fee collection
    uint256 public tokensForMarketing;
    uint256 public tokensForDev;
    uint256 public tokensForLiquidity;
    uint256 public tokensForPlatform;
    uint256 public tokensForBuyFee;
    uint256 public tokensForSellFee;
   
    // Transaction and wallet limits
    uint256 public maxTransactionAmount;
    uint256 public maxWalletAmount;
    bool public limitsInEffect;
   
    bool private inSwap;
    uint256 public swapTokensAtAmount;
    string public deploymentMetadata;
    bool public tradingPaused;
    
    /**
     * @dev Storage gap to allow for future upgrades without storage collisions
     * Reduces storage slots available for future variables to prevent corruption
     */
    uint256[50] private __gap;
   
    event FeesUpdated(string feeType, uint256 marketing, uint256 dev, uint256 lp);
    event AdditionalFeeUpdated(string feeType, uint256 fee);
    event WalletUpdated(string walletType, address indexed newWallet);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 bnbReceived, uint256 tokensIntoLiquidity);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event PairUpdated(address indexed pair, bool value);
    event PlatformFeeCollected(uint256 amount);
    event LimitsUpdated(uint256 maxTx, uint256 maxWallet);
    event LimitsRemoved();
    event PairCreated(address indexed pair);
    event TokenDeployed(address indexed owner, string name, string symbol, uint256 totalSupply);
    event DeploymentMetadataSet(string metadata);
    event TradingPaused(bool paused);
    event EmergencyWithdraw(address token, uint256 amount);
    event SwapThresholdUpdated(uint256 newThreshold);
   
    modifier lockTheSwap {
        inSwap = true;
        _;
        inSwap = false;
    }
    
    modifier whenNotPaused {
        require(!tradingPaused, "Trading is paused");
        _;
    }
   
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
   
    function initialize(
        TokenConfig memory config,
        address _platformWallet,
        address _routerAddress,
        string memory _metadata
    ) public initializer {
        require(config.owner != address(0), "Owner cannot be zero");
        require(config.marketingWallet != address(0), "Marketing wallet cannot be zero");
        require(config.devWallet != address(0), "Dev wallet cannot be zero");
        require(_platformWallet != address(0), "Platform wallet cannot be zero");
        require(_routerAddress != address(0), "Router address cannot be zero");
        require(config.totalSupply > 0, "Total supply must be greater than zero");
        require(bytes(config.name).length > 0, "Name cannot be empty");
        require(bytes(config.symbol).length > 0, "Symbol cannot be empty");
        
        // Validate fees
        require(config.buyFees.marketing <= MAX_FEE_PERCENTAGE, "Buy marketing fee too high");
        require(config.buyFees.dev <= MAX_FEE_PERCENTAGE, "Buy dev fee too high");
        require(config.buyFees.lp <= MAX_FEE_PERCENTAGE, "Buy LP fee too high");
        require(config.sellFees.marketing <= MAX_FEE_PERCENTAGE, "Sell marketing fee too high");
        require(config.sellFees.dev <= MAX_FEE_PERCENTAGE, "Sell dev fee too high");
        require(config.sellFees.lp <= MAX_FEE_PERCENTAGE, "Sell LP fee too high");
        require(config.buyFee <= MAX_FEE_PERCENTAGE, "Buy fee too high");
        require(config.sellFee <= MAX_FEE_PERCENTAGE, "Sell fee too high");
        
        uint256 totalBuyFee = config.buyFees.marketing + config.buyFees.dev + config.buyFees.lp + config.buyFee;
        uint256 totalSellFee = config.sellFees.marketing + config.sellFees.dev + config.sellFees.lp + config.sellFee;
        require(totalBuyFee <= 3000, "Total buy fees exceed 30%");
        require(totalSellFee <= 3000, "Total sell fees exceed 30%");
        
        __ERC20_init(config.name, config.symbol);
        __Ownable_init(config.owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        factory = msg.sender;
        
        marketingWallet = config.marketingWallet;
        devWallet = config.devWallet;
        platformWallet = _platformWallet;
        
        buyFees = config.buyFees;
        sellFees = config.sellFees;
        buyFee = config.buyFee;
        sellFee = config.sellFee;
        
        pancakeRouter = IPancakeRouter02(_routerAddress);
        
        maxTransactionAmount = (config.totalSupply * MAX_TRANSACTION_AMOUNT) / DENOMINATOR;
        maxWalletAmount = (config.totalSupply * MAX_WALLET_AMOUNT) / DENOMINATOR;
        limitsInEffect = true;
        
        isFeeExempt[config.owner] = true;
        isFeeExempt[address(this)] = true;
        isFeeExempt[config.marketingWallet] = true;
        isFeeExempt[config.devWallet] = true;
        isFeeExempt[_platformWallet] = true;
        
        swapTokensAtAmount = (config.totalSupply * 10) / 10000;
        tradingPaused = false;
        deploymentMetadata = _metadata;
        
        _mint(config.owner, config.totalSupply);
        
        emit TokenDeployed(config.owner, config.name, config.symbol, config.totalSupply);
        emit DeploymentMetadataSet(_metadata);
    }
   
    function createPair() external {
        require(msg.sender == owner() || msg.sender == factory, "Not authorized");
        require(pancakePair == address(0), "Pair already created");
        
        IPancakeFactory factoryContract = IPancakeFactory(pancakeRouter.factory());
        address existingPair = factoryContract.getPair(address(this), pancakeRouter.WETH());
        
        if (existingPair != address(0)) {
            pancakePair = existingPair;
        } else {
            pancakePair = factoryContract.createPair(address(this), pancakeRouter.WETH());
        }
        
        isPair[pancakePair] = true;
        emit PairCreated(pancakePair);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
   
    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        if (amount == 0) {
            super._update(from, to, 0);
            return;
        }
        
        // Check limits
        if (limitsInEffect) {
            if (
                from != owner() &&
                to != owner() &&
                to != address(0) &&
                to != address(0xdead) &&
                !inSwap
            ) {
                if (isPair[from] && !isFeeExempt[to]) {
                    require(amount <= maxTransactionAmount, "Buy transfer amount exceeds max");
                    require(balanceOf(to) + amount <= maxWalletAmount, "Max wallet exceeded");
                }
                else if (isPair[to] && !isFeeExempt[from]) {
                    require(amount <= maxTransactionAmount, "Sell transfer amount exceeds max");
                }
                else if (!isFeeExempt[to]) {
                    require(balanceOf(to) + amount <= maxWalletAmount, "Max wallet exceeded");
                }
            }
        }
        
        // Determine if fees should be taken BEFORE any external calls
        bool takeFee = !isFeeExempt[from] && !isFeeExempt[to] && (isPair[from] || isPair[to]);
        
        uint256 fees = 0;
        uint256 platformFee = 0;
        
        if (takeFee) {
            // Calculate platform fee
            platformFee = (amount * PLATFORM_FEE) / DENOMINATOR;
            
            // Calculate sell fees
            if (isPair[to]) {
                uint256 totalSellFee = sellFees.marketing + sellFees.dev + sellFees.lp;
                if (totalSellFee > 0) {
                    uint256 marketingDevLpFees = (amount * totalSellFee) / DENOMINATOR;
                    fees += marketingDevLpFees;
                }
                
                if (sellFee > 0) {
                    uint256 additionalSellFee = (amount * sellFee) / DENOMINATOR;
                    fees += additionalSellFee;
                }
            }
            // Calculate buy fees
            else if (isPair[from]) {
                uint256 totalBuyFee = buyFees.marketing + buyFees.dev + buyFees.lp;
                if (totalBuyFee > 0) {
                    uint256 marketingDevLpFees = (amount * totalBuyFee) / DENOMINATOR;
                    fees += marketingDevLpFees;
                }
                
                if (buyFee > 0) {
                    uint256 additionalBuyFee = (amount * buyFee) / DENOMINATOR;
                    fees += additionalBuyFee;
                }
            }
        }
        
        uint256 totalFees = fees + platformFee;
        
        // Execute transfers - all state changes happen here atomically
        if (totalFees > 0) {
            super._update(from, address(this), totalFees);
            amount -= totalFees;
            
            // Update fee tracking AFTER successful transfer
            if (takeFee) {
                tokensForPlatform += platformFee;
                
                if (isPair[to]) {
                    uint256 totalSellFee = sellFees.marketing + sellFees.dev + sellFees.lp;
                    if (totalSellFee > 0) {
                        uint256 marketingDevLpFees = (fees * totalSellFee) / (totalSellFee + sellFee);
                        tokensForMarketing += (marketingDevLpFees * sellFees.marketing) / totalSellFee;
                        tokensForDev += (marketingDevLpFees * sellFees.dev) / totalSellFee;
                        tokensForLiquidity += (marketingDevLpFees * sellFees.lp) / totalSellFee;
                    }
                    if (sellFee > 0) {
                        tokensForSellFee += (fees * sellFee) / (totalSellFee + sellFee);
                    }
                } else if (isPair[from]) {
                    uint256 totalBuyFee = buyFees.marketing + buyFees.dev + buyFees.lp;
                    if (totalBuyFee > 0) {
                        uint256 marketingDevLpFees = (fees * totalBuyFee) / (totalBuyFee + buyFee);
                        tokensForMarketing += (marketingDevLpFees * buyFees.marketing) / totalBuyFee;
                        tokensForDev += (marketingDevLpFees * buyFees.dev) / totalBuyFee;
                        tokensForLiquidity += (marketingDevLpFees * buyFees.lp) / totalBuyFee;
                    }
                    if (buyFee > 0) {
                        tokensForBuyFee += (fees * buyFee) / (totalBuyFee + buyFee);
                    }
                }
            }
        }
        
        super._update(from, to, amount);
        
        // Swap back AFTER all transfers complete - prevents reentrancy
        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;
        
        if (
            canSwap &&
            !inSwap &&
            !isPair[from] &&
            from != owner() &&
            to != owner()
        ) {
            swapBack();
        }
    }
   
    function swapBack() private lockTheSwap {
        uint256 contractBalance = balanceOf(address(this));
        uint256 totalTokensToSwap = tokensForMarketing + tokensForDev + tokensForLiquidity +
                                     tokensForPlatform + tokensForBuyFee + tokensForSellFee;
        
        if (contractBalance == 0 || totalTokensToSwap == 0) {
            return;
        }
        
        // Cap swap amount
        if (contractBalance > swapTokensAtAmount * MAX_SWAP_MULTIPLIER) {
            contractBalance = swapTokensAtAmount * MAX_SWAP_MULTIPLIER;
        }
        
        // Calculate liquidity tokens (half for LP pairing)
        uint256 liquidityTokens = (contractBalance * tokensForLiquidity) / totalTokensToSwap / 2;
        uint256 amountToSwapForETH = contractBalance - liquidityTokens;
        
        uint256 initialBNBBalance = address(this).balance;
        
        swapTokensForBNB(amountToSwapForETH);
        
        uint256 bnbBalance = address(this).balance - initialBNBBalance;
        
        // Calculate BNB distribution
        uint256 denominator = totalTokensToSwap - (tokensForLiquidity / 2);
        uint256 bnbForMarketing = (bnbBalance * tokensForMarketing) / denominator;
        uint256 bnbForDev = (bnbBalance * tokensForDev) / denominator;
        uint256 bnbForPlatform = (bnbBalance * tokensForPlatform) / denominator;
        uint256 bnbForBuyFee = (bnbBalance * tokensForBuyFee) / denominator;
        uint256 bnbForSellFee = (bnbBalance * tokensForSellFee) / denominator;
        uint256 bnbForLiquidity = bnbBalance - bnbForMarketing - bnbForDev - bnbForPlatform - bnbForBuyFee - bnbForSellFee;
        
        // Reset counters
        tokensForMarketing = 0;
        tokensForDev = 0;
        tokensForLiquidity = 0;
        tokensForPlatform = 0;
        tokensForBuyFee = 0;
        tokensForSellFee = 0;
        
        // Distribute BNB - using low-level calls with gas limits
        bool success;
        
        if (bnbForMarketing > 0) {
            (success, ) = payable(marketingWallet).call{value: bnbForMarketing, gas: 50000}("");
            // Don't revert on failure, just log
        }
        
        if (bnbForDev > 0) {
            (success, ) = payable(devWallet).call{value: bnbForDev, gas: 50000}("");
        }
        
        if (bnbForPlatform > 0) {
            (success, ) = payable(platformWallet).call{value: bnbForPlatform, gas: 50000}("");
            if (success) {
                emit PlatformFeeCollected(bnbForPlatform);
            }
        }
        
        if (bnbForBuyFee > 0) {
            (success, ) = payable(marketingWallet).call{value: bnbForBuyFee, gas: 50000}("");
        }
        
        if (bnbForSellFee > 0) {
            (success, ) = payable(marketingWallet).call{value: bnbForSellFee, gas: 50000}("");
        }
        
        // Add liquidity
        if (liquidityTokens > 0 && bnbForLiquidity > 0) {
            addLiquidity(liquidityTokens, bnbForLiquidity);
            emit SwapAndLiquify(amountToSwapForETH, bnbForLiquidity, liquidityTokens);
        }
    }
   
    function swapTokensForBNB(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = pancakeRouter.WETH();
        
        _approve(address(this), address(pancakeRouter), tokenAmount);
        
        pancakeRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp
        );
    }
   
    function addLiquidity(uint256 tokenAmount, uint256 bnbAmount) private {
        _approve(address(this), address(pancakeRouter), tokenAmount);
        
        pancakeRouter.addLiquidityETH{value: bnbAmount}(
            address(this),
            tokenAmount,
            0,
            0,
            owner(),
            block.timestamp
        );
    }
   
    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
   
    function setBuyFees(uint256 _marketing, uint256 _dev, uint256 _lp) external onlyOwner {
        require(_marketing <= MAX_FEE_PERCENTAGE && _dev <= MAX_FEE_PERCENTAGE && _lp <= MAX_FEE_PERCENTAGE, "Fee too high");
        require(_marketing + _dev + _lp + buyFee <= 3000, "Total buy fees exceed 30%");
        buyFees.marketing = _marketing;
        buyFees.dev = _dev;
        buyFees.lp = _lp;
        emit FeesUpdated("buy", _marketing, _dev, _lp);
    }
   
    function setSellFees(uint256 _marketing, uint256 _dev, uint256 _lp) external onlyOwner {
        require(_marketing <= MAX_FEE_PERCENTAGE && _dev <= MAX_FEE_PERCENTAGE && _lp <= MAX_FEE_PERCENTAGE, "Fee too high");
        require(_marketing + _dev + _lp + sellFee <= 3000, "Total sell fees exceed 30%");
        sellFees.marketing = _marketing;
        sellFees.dev = _dev;
        sellFees.lp = _lp;
        emit FeesUpdated("sell", _marketing, _dev, _lp);
    }
   
    function setMarketingWallet(address _marketingWallet) external onlyOwner {
        require(_marketingWallet != address(0), "Marketing wallet cannot be zero");
        marketingWallet = _marketingWallet;
        emit WalletUpdated("marketing", _marketingWallet);
    }
   
    function setDevWallet(address _devWallet) external onlyOwner {
        require(_devWallet != address(0), "Dev wallet cannot be zero");
        devWallet = _devWallet;
        emit WalletUpdated("dev", _devWallet);
    }
   
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }
    
    function setPair(address pair, bool value) external onlyOwner {
        require(pair != address(0), "Pair cannot be zero address");
        isPair[pair] = value;
        emit PairUpdated(pair, value);
    }
   
    function removeLimits() external onlyOwner {
        limitsInEffect = false;
        emit LimitsRemoved();
    }
    
    function updateLimits(uint256 _maxTxAmount, uint256 _maxWalletAmount) external onlyOwner {
        require(_maxTxAmount >= (totalSupply() * 10) / 10000, "Max tx too low"); // Min 0.1%
        require(_maxWalletAmount >= (totalSupply() * 10) / 10000, "Max wallet too low"); // Min 0.1%
        maxTransactionAmount = _maxTxAmount;
        maxWalletAmount = _maxWalletAmount;
        emit LimitsUpdated(_maxTxAmount, _maxWalletAmount);
    }
   
    function setTradingPaused(bool paused) external onlyOwner {
        tradingPaused = paused;
        emit TradingPaused(paused);
    }
    
    function setSwapTokensAtAmount(uint256 newAmount) external onlyOwner {
        require(newAmount >= (totalSupply() * 1) / 100000, "Amount too low"); // Min 0.001%
        require(newAmount <= (totalSupply() * 50) / 10000, "Amount too high"); // Max 0.5%
        swapTokensAtAmount = newAmount;
        emit SwapThresholdUpdated(newAmount);
    }
    
    function manualSwapBack() external onlyOwner {
        require(!inSwap, "Already swapping");
        swapBack();
    }
    
    function withdrawStuckBNB() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    function withdrawStuckTokens(address token) external onlyOwner {
        require(token != address(this), "Cannot withdraw own token");
        IERC20(token).transfer(owner(), IERC20(token).balanceOf(address(this)));
    }
   
    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getTotalBuyFee() external view returns (uint256) {
        return buyFees.marketing + buyFees.dev + buyFees.lp + buyFee + PLATFORM_FEE;
    }
    
    function getTotalSellFee() external view returns (uint256) {
        return sellFees.marketing + sellFees.dev + sellFees.lp + sellFee + PLATFORM_FEE;
    }
    
    function getCirculatingSupply() external view returns (uint256) {
        return totalSupply() - balanceOf(address(0xdead)) - balanceOf(address(0));
    }
    
    function isExcludedFromFees(address account) external view returns (bool) {
        return isFeeExempt[account];
    }
   
    receive() external payable {}
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

contract UnrugpadTokenFactory is Ownable {
    address public platformWallet;
    address public tokenImplementation;
    address public defaultRouter;
    uint256 public deploymentFee;
    bool public deploymentsPaused;
    
    mapping(address => address[]) public userTokens;
    mapping(address => bool) public isTokenFromFactory; // Track legitimate tokens
    address[] public allTokens;
    
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply
    );
    event DeploymentFeeUpdated(uint256 newFee);
    event PlatformWalletUpdated(address newWallet);
    event ImplementationUpdated(address newImplementation);
    event DefaultRouterUpdated(address newRouter);
    event DeploymentsPausedUpdated(bool paused);
    
    constructor(
        address _tokenImplementation,
        address _platformWallet,
        address _defaultRouter
        
    ) Ownable(msg.sender) {
        require(_tokenImplementation != address(0), "Invalid implementation");
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_defaultRouter != address(0), "Invalid router");
        
        tokenImplementation = _tokenImplementation;
        platformWallet = _platformWallet;
        defaultRouter = _defaultRouter;
        deploymentsPaused = false;
    }
    
    function createToken(
        UnrugpadToken.TokenConfig memory config,
        string memory metadata
    ) external payable returns (address tokenAddress) {
        require(!deploymentsPaused, "Deployments are paused");
        require(config.owner != address(0), "Owner cannot be zero");
        require(config.marketingWallet != address(0), "Marketing wallet cannot be zero");
        require(config.devWallet != address(0), "Dev wallet cannot be zero");
        require(bytes(config.name).length > 0, "Name cannot be empty");
        require(bytes(config.symbol).length > 0, "Symbol cannot be empty");
        require(config.totalSupply > 0, "Supply must be greater than zero");
        require(config.totalSupply <= 1000000000000 * 10**18, "Supply too large"); // Max 1T tokens
        
        _validateFees(config);
        
        bytes memory initData = abi.encodeWithSelector(
            UnrugpadToken.initialize.selector,
            config,
            platformWallet,
            defaultRouter,
            metadata
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(
            tokenImplementation,
            initData
        );
        
        tokenAddress = address(proxy);
        
        UnrugpadToken(payable(tokenAddress)).createPair();
        
        userTokens[config.owner].push(tokenAddress);
        allTokens.push(tokenAddress);
        isTokenFromFactory[tokenAddress] = true; // Mark as legitimate
        
        if (msg.value > 0) {
            (bool success, ) = payable(platformWallet).call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        emit TokenCreated(
            tokenAddress,
            config.owner,
            config.name,
            config.symbol,
            config.totalSupply
        );
        
        return tokenAddress;
    }
    
    function _validateFees(UnrugpadToken.TokenConfig memory config) internal pure {
        require(config.buyFees.marketing <= 1500, "Buy marketing fee too high");
        require(config.buyFees.dev <= 1500, "Buy dev fee too high");
        require(config.buyFees.lp <= 1500, "Buy LP fee too high");
        require(config.sellFees.marketing <= 1500, "Sell marketing fee too high");
        require(config.sellFees.dev <= 1500, "Sell dev fee too high");
        require(config.sellFees.lp <= 1500, "Sell LP fee too high");
        require(config.buyFee <= 1500, "Buy fee too high");
        require(config.sellFee <= 1500, "Sell fee too high");
        
        uint256 totalBuyFee = config.buyFees.marketing + config.buyFees.dev + 
                              config.buyFees.lp + config.buyFee;
        uint256 totalSellFee = config.sellFees.marketing + config.sellFees.dev + 
                               config.sellFees.lp + config.sellFee;
        
        require(totalBuyFee <= 3000, "Total buy fees exceed 30%");
        require(totalSellFee <= 3000, "Total sell fees exceed 30%");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }
    
    function getTotalTokensCreated() external view returns (uint256) {
        return allTokens.length;
    }
    
    function getTokenAtIndex(uint256 index) external view returns (address) {
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }
    
    function verifyToken(address token) external view returns (bool) {
        return isTokenFromFactory[token];
    }
    
    function setDeploymentFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1 ether, "Fee too high"); // Max 1 BNB
        deploymentFee = _newFee;
        emit DeploymentFeeUpdated(_newFee);
    }
    
    function setPlatformWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid wallet");
        platformWallet = _newWallet;
        emit PlatformWalletUpdated(_newWallet);
    }
    
    function setImplementation(address _newImplementation) external onlyOwner {
        require(_newImplementation != address(0), "Invalid implementation");
        tokenImplementation = _newImplementation;
        emit ImplementationUpdated(_newImplementation);
    }
    
    function setDefaultRouter(address _newRouter) external onlyOwner {
        require(_newRouter != address(0), "Invalid router");
        defaultRouter = _newRouter;
        emit DefaultRouterUpdated(_newRouter);
    }
    
    function setDeploymentsPaused(bool _paused) external onlyOwner {
        deploymentsPaused = _paused;
        emit DeploymentsPausedUpdated(_paused);
    }
    
    function withdrawStuckBNB() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    receive() external payable {}
}
