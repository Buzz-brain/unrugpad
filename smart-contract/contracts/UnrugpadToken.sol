
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// Interface declarations must be outside the contract
interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IUniswapV2Router02 {
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

contract UnrugpadToken is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    // Anti-whale limits
    uint256 public maxTxAmount;
    uint256 public maxWalletAmount;
    uint256 public constant MIN_LIMIT_PERCENT = 50; // 0.5% (50/10000)
    uint256 public constant MAX_LIMIT_PERCENT = 10000; // 100%

    event MaxTxAmountUpdated(uint256 newAmount);
    event MaxWalletAmountUpdated(uint256 newAmount);
    uint256 public constant MAX_FEE = 3000; // 30% max total fee
    uint256 public constant DENOMINATOR = 10000; // 100%
    uint256 public constant PLATFORM_FEE = 30; // 0.3% (30/10000)
    
    // Fee structure
    struct Fees {
        uint256 marketing;
        uint256 dev;
        uint256 lp;
        uint256 burn;
    }
    
    Fees public buyFees;
    Fees public sellFees;
    
    // Wallets
    address public marketingWallet;
    address public devWallet;
    address public platformWallet; // Unrugpad wallet
    
    // DEX
    IUniswapV2Router02 public uniswapV2Router;
    address public uniswapV2Pair;
    
    // Fee exemptions and pair tracking
    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isPair;
    
    // Fee collection
    uint256 public tokensForMarketing;
    uint256 public tokensForDev;
    uint256 public tokensForLiquidity;
    uint256 public tokensForBurn;
    uint256 public tokensForPlatform; // Unrugpad accumulated fees
    
    bool private inSwap;
    uint256 public swapTokensAtAmount;
    
    event FeesUpdated(string feeType, uint256 marketing, uint256 dev, uint256 lp, uint256 burn);
    event WalletUpdated(string walletType, address indexed newWallet);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiquidity);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event PairUpdated(address indexed pair, bool value);
    event PlatformFeeCollected(uint256 amount);
    
    modifier lockTheSwap {
        inSwap = true;
        _;
        inSwap = false;
    }
    
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _owner,
        address _marketingWallet,
        address _devWallet,
        address _platformWallet, // Unrugpad wallet
        Fees memory _buyFees,
        Fees memory _sellFees,
        address _routerAddress
    ) public initializer {
        require(_owner != address(0), "Owner cannot be zero");
        require(_marketingWallet != address(0), "Marketing wallet cannot be zero");
        require(_devWallet != address(0), "Dev wallet cannot be zero");
        require(_platformWallet != address(0), "Platform wallet cannot be zero");
    uint256 totalBuyFee = _buyFees.marketing + _buyFees.dev + _buyFees.lp + _buyFees.burn;
    uint256 totalSellFee = _sellFees.marketing + _sellFees.dev + _sellFees.lp + _sellFees.burn;
    require(totalBuyFee <= MAX_FEE, "Total buy fees exceed 30%");
    require(totalSellFee <= MAX_FEE, "Total sell fees exceed 30%");
        __ERC20_init(_name, _symbol);
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        // Set wallets
        marketingWallet = _marketingWallet;
        devWallet = _devWallet;
        platformWallet = _platformWallet;
        // Set fees
        buyFees = _buyFees;
        sellFees = _sellFees;
        // Setup Uniswap
        uniswapV2Router = IUniswapV2Router02(_routerAddress);
        uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory()).createPair(
            address(this),
            uniswapV2Router.WETH()
        );
        isPair[uniswapV2Pair] = true;
        // Set fee exemptions
        isFeeExempt[_owner] = true;
        isFeeExempt[address(this)] = true;
        isFeeExempt[_marketingWallet] = true;
        isFeeExempt[_devWallet] = true;
        isFeeExempt[_platformWallet] = true;
        // Set swap threshold (0.1% of supply)
        swapTokensAtAmount = (_totalSupply * 10) / 10000;
        // Set anti-whale limits (default 0.5%)
        maxTxAmount = (_totalSupply * MIN_LIMIT_PERCENT) / DENOMINATOR;
        maxWalletAmount = (_totalSupply * MIN_LIMIT_PERCENT) / DENOMINATOR;
        emit MaxTxAmountUpdated(maxTxAmount);
        emit MaxWalletAmountUpdated(maxWalletAmount);
        // Mint tokens to owner
        _mint(_owner, _totalSupply);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    function _update(address from, address to, uint256 amount) internal override {
        // Anti-whale: skip for exempt addresses
        bool skipLimits = isFeeExempt[from] || isFeeExempt[to] || from == address(0) || to == address(0);
        if (!skipLimits) {
            require(amount <= maxTxAmount, "Transfer exceeds max transaction amount");
            if (!isPair[to]) { // Only check wallet limit for non-pair (not selling)
                require(balanceOf(to) + amount <= maxWalletAmount, "Recipient exceeds max wallet amount");
            }
        }
        if (amount == 0) {
            super._update(from, to, 0);
            return;
        }
        
        // Check if we should swap accumulated fees
        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;
        
        if (
            canSwap &&
            !inSwap &&
            !isPair[from] && // not during buy
            from != owner() &&
            to != owner()
        ) {
            swapBack();
        }
        
        bool takeFee = true;
        
        // Remove fees if sender or receiver is exempt
        if (isFeeExempt[from] || isFeeExempt[to]) {
            takeFee = false;
        }
        
        // Remove fees for non-trading transfers
        if (!isPair[from] && !isPair[to]) {
            takeFee = false;
        }
        
    uint256 fees = 0;
    uint256 burnFee = 0;
        uint256 platformFee = 0;
        
        if (takeFee) {
            // Calculate platform fee (0.3% on all trades)
            platformFee = (amount * PLATFORM_FEE) / DENOMINATOR;
            tokensForPlatform += platformFee;
            // Sell
            if (isPair[to] && (sellFees.marketing + sellFees.dev + sellFees.lp + sellFees.burn > 0)) {
                uint256 totalSellFee = sellFees.marketing + sellFees.dev + sellFees.lp + sellFees.burn;
                fees = (amount * totalSellFee) / DENOMINATOR;
                tokensForMarketing += (fees * sellFees.marketing) / totalSellFee;
                tokensForDev += (fees * sellFees.dev) / totalSellFee;
                tokensForLiquidity += (fees * sellFees.lp) / totalSellFee;
                burnFee = (fees * sellFees.burn) / totalSellFee;
                tokensForBurn += burnFee;
            }
            // Buy
            else if (isPair[from] && (buyFees.marketing + buyFees.dev + buyFees.lp + buyFees.burn > 0)) {
                uint256 totalBuyFee = buyFees.marketing + buyFees.dev + buyFees.lp + buyFees.burn;
                fees = (amount * totalBuyFee) / DENOMINATOR;
                tokensForMarketing += (fees * buyFees.marketing) / totalBuyFee;
                tokensForDev += (fees * buyFees.dev) / totalBuyFee;
                tokensForLiquidity += (fees * buyFees.lp) / totalBuyFee;
                burnFee = (fees * buyFees.burn) / totalBuyFee;
                tokensForBurn += burnFee;
            }
            uint256 totalFees = fees + platformFee;
            if (totalFees > 0) {
                super._update(from, address(this), totalFees - burnFee);
            }
            if (burnFee > 0) {
                // Burn tokens from the sender (do not transfer to zero address which may be disallowed)
                _burn(from, burnFee);
            }
            amount -= totalFees;
        }
        
        super._update(from, to, amount);
    }
    
    function swapBack() private lockTheSwap {
        uint256 contractBalance = balanceOf(address(this));
    uint256 totalTokensToSwap = tokensForMarketing + tokensForDev + tokensForLiquidity + tokensForPlatform;
        
        if (contractBalance == 0 || totalTokensToSwap == 0) {
            tokensForBurn = 0; // reset burn tokens (should always be 0, but for safety)
            return;
        }
        
        if (contractBalance > swapTokensAtAmount * 20) {
            contractBalance = swapTokensAtAmount * 20;
        }
        
        // Calculate LP tokens (half will be swapped, half will be added to LP)
        uint256 liquidityTokens = (contractBalance * tokensForLiquidity) / totalTokensToSwap / 2;
        uint256 amountToSwapForETH = contractBalance - liquidityTokens;
        
        uint256 initialETHBalance = address(this).balance;
        
        swapTokensForEth(amountToSwapForETH);
        
        uint256 ethBalance = address(this).balance - initialETHBalance;
        
        uint256 ethForMarketing = (ethBalance * tokensForMarketing) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForDev = (ethBalance * tokensForDev) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForPlatform = (ethBalance * tokensForPlatform) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForLiquidity = ethBalance - ethForMarketing - ethForDev - ethForPlatform;
        
        tokensForMarketing = 0;
        tokensForDev = 0;
        tokensForLiquidity = 0;
        tokensForPlatform = 0;
        
        // Send to wallets
        if (ethForMarketing > 0) {
            payable(marketingWallet).transfer(ethForMarketing);
        }
        
        if (ethForDev > 0) {
            payable(devWallet).transfer(ethForDev);
        }
        
        if (ethForPlatform > 0) {
            payable(platformWallet).transfer(ethForPlatform);
            emit PlatformFeeCollected(ethForPlatform);
        }
        
        // Add liquidity
        if (liquidityTokens > 0 && ethForLiquidity > 0) {
            addLiquidity(liquidityTokens, ethForLiquidity);
            emit SwapAndLiquify(amountToSwapForETH, ethForLiquidity, liquidityTokens);
        }
    }
    
    function swapTokensForEth(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();
        
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp
        );
    }
    
    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        
        uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0,
            0,
            owner(),
            block.timestamp
        );
    }
    
    // Admin functions
    function setBuyFees(uint256 _marketing, uint256 _dev, uint256 _lp, uint256 _burn) external onlyOwner {
    uint256 totalBuyFee = _marketing + _dev + _lp + _burn;
    require(totalBuyFee <= MAX_FEE, "Total buy fees exceed 30%");
        buyFees.marketing = _marketing;
        buyFees.dev = _dev;
        buyFees.lp = _lp;
        buyFees.burn = _burn;
        emit FeesUpdated("buy", _marketing, _dev, _lp, _burn);
    }

    function setSellFees(uint256 _marketing, uint256 _dev, uint256 _lp, uint256 _burn) external onlyOwner {
    uint256 totalSellFee = _marketing + _dev + _lp + _burn;
    require(totalSellFee <= MAX_FEE, "Total sell fees exceed 30%");
        sellFees.marketing = _marketing;
        sellFees.dev = _dev;
        sellFees.lp = _lp;
        sellFees.burn = _burn;
        emit FeesUpdated("sell", _marketing, _dev, _lp, _burn);
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
    
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Platform wallet cannot be zero");
        platformWallet = _platformWallet;
        emit WalletUpdated("platform", _platformWallet);
    }
    
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }
    
    function setPair(address pair, bool value) external onlyOwner {
        require(pair != uniswapV2Pair, "Cannot remove main pair");
        isPair[pair] = value;
        emit PairUpdated(pair, value);
    }
    
    function setSwapTokensAtAmount(uint256 amount) external onlyOwner {
        require(amount >= totalSupply() / 100000, "Amount too low");
        require(amount <= totalSupply() / 100, "Amount too high");
        swapTokensAtAmount = amount;
    }

    // Admin: set max transaction amount (percent in basis points)
    function setMaxTxPercent(uint256 percent) external onlyOwner {
        require(percent >= MIN_LIMIT_PERCENT && percent <= MAX_LIMIT_PERCENT, "Percent out of range");
        maxTxAmount = (totalSupply() * percent) / DENOMINATOR;
        emit MaxTxAmountUpdated(maxTxAmount);
    }

    // Admin: set max wallet amount (percent in basis points)
    function setMaxWalletPercent(uint256 percent) external onlyOwner {
        require(percent >= MIN_LIMIT_PERCENT && percent <= MAX_LIMIT_PERCENT, "Percent out of range");
        maxWalletAmount = (totalSupply() * percent) / DENOMINATOR;
        emit MaxWalletAmountUpdated(maxWalletAmount);
    }
    
    // View functions
    function getTotalBuyFee() external view returns (uint256) {
        return buyFees.marketing + buyFees.dev + buyFees.lp + buyFees.burn + PLATFORM_FEE;
    }

    function getTotalSellFee() external view returns (uint256) {
        return sellFees.marketing + sellFees.dev + sellFees.lp + sellFees.burn + PLATFORM_FEE;
    }
    
    function getPlatformFee() external pure returns (uint256) {
        return PLATFORM_FEE;
    }
    
    // Enable receiving ETH
    receive() external payable {}
}