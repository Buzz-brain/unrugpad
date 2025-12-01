// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";

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
    // Fee constants - matches interface requirements
    uint256 public constant MAX_FEE_PERCENTAGE = 1500; // 15% max for each fee type
    uint256 public constant DENOMINATOR = 10000; 
    uint256 public constant PLATFORM_FEE = 30; // 0.3% Unrugpad platform fee
    uint256 public constant MAX_TRANSACTION_AMOUNT = 50; // 0.5% of total supply
    uint256 public constant MAX_WALLET_AMOUNT = 50; // 0.5% of total supply
    
    // Fee structure matching interface
    struct Fees {
        uint256 marketing;
        uint256 dev;
        uint256 lp;
    }
    
    Fees public buyFees;
    Fees public sellFees;
    
    // Additional buy and sell fees (as shown in interface)
    uint256 public buyFee;
    uint256 public sellFee;
    
    // Wallets
    address public marketingWallet;
    address public devWallet;
    address public platformWallet; // Unrugpad owner wallet - receives 0.3% from all trades
    
    // Uniswap integration
    IUniswapV2Router02 public uniswapV2Router;
    address public uniswapV2Pair;
    
    // Fee exemptions and pair tracking
    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isPair;
    
    // Fee collection
    uint256 public tokensForMarketing;
    uint256 public tokensForDev;
    uint256 public tokensForLiquidity;
    uint256 public tokensForPlatform; // Unrugpad accumulated fees
    uint256 public tokensForBuyFee;
    uint256 public tokensForSellFee;
    
    // Transaction and wallet limits
    uint256 public maxTransactionAmount;
    uint256 public maxWalletAmount;
    bool public limitsInEffect;
    
    bool private inSwap;
    uint256 public swapTokensAtAmount;
    
    event FeesUpdated(string feeType, uint256 marketing, uint256 dev, uint256 lp);
    event AdditionalFeeUpdated(string feeType, uint256 fee);
    event WalletUpdated(string walletType, address indexed newWallet);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiquidity);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event PairUpdated(address indexed pair, bool value);
    event PlatformFeeCollected(uint256 amount);
    event LimitsUpdated(uint256 maxTx, uint256 maxWallet);
    event LimitsRemoved();
    
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
        address _platformWallet, // Unrugpad wallet (receives 0.3% from all trades)
        Fees memory _buyFees,
        Fees memory _sellFees,
        uint256 _buyFee,
        uint256 _sellFee,
        address _routerAddress
    ) public initializer {
        require(_owner != address(0), "Owner cannot be zero");
        require(_marketingWallet != address(0), "Marketing wallet cannot be zero");
        require(_devWallet != address(0), "Dev wallet cannot be zero");
        require(_platformWallet != address(0), "Platform wallet cannot be zero");
        
        // Validate individual fees (0-15% each)
        require(_buyFees.marketing <= MAX_FEE_PERCENTAGE, "Buy marketing fee too high");
        require(_buyFees.dev <= MAX_FEE_PERCENTAGE, "Buy dev fee too high");
        require(_buyFees.lp <= MAX_FEE_PERCENTAGE, "Buy LP fee too high");
        require(_sellFees.marketing <= MAX_FEE_PERCENTAGE, "Sell marketing fee too high");
        require(_sellFees.dev <= MAX_FEE_PERCENTAGE, "Sell dev fee too high");
        require(_sellFees.lp <= MAX_FEE_PERCENTAGE, "Sell LP fee too high");
        require(_buyFee <= MAX_FEE_PERCENTAGE, "Buy fee too high");
        require(_sellFee <= MAX_FEE_PERCENTAGE, "Sell fee too high");
        
        // Validate total fees don't exceed reasonable limits
        uint256 totalBuyFee = _buyFees.marketing + _buyFees.dev + _buyFees.lp + _buyFee;
        uint256 totalSellFee = _sellFees.marketing + _sellFees.dev + _sellFees.lp + _sellFee;
        require(totalBuyFee <= 3000, "Total buy fees exceed 30%");
        require(totalSellFee <= 3000, "Total sell fees exceed 30%");
        
        __ERC20_init(_name, _symbol);
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        
        // Set wallets
        marketingWallet = _marketingWallet;
        devWallet = _devWallet;
        platformWallet = _platformWallet; // Unrugpad owner wallet
        
        // Set fees
        buyFees = _buyFees;
        sellFees = _sellFees;
        buyFee = _buyFee;
        sellFee = _sellFee;
        
        // Setup Uniswap
        uniswapV2Router = IUniswapV2Router02(_routerAddress);
        uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory()).createPair(
            address(this),
            uniswapV2Router.WETH()
        );
        
        isPair[uniswapV2Pair] = true;
        
        // Set transaction and wallet limits (0.5% of total supply)
        maxTransactionAmount = (_totalSupply * MAX_TRANSACTION_AMOUNT) / DENOMINATOR;
        maxWalletAmount = (_totalSupply * MAX_WALLET_AMOUNT) / DENOMINATOR;
        limitsInEffect = true;
        
        // Set fee exemptions
        isFeeExempt[_owner] = true;
        isFeeExempt[address(this)] = true;
        isFeeExempt[_marketingWallet] = true;
        isFeeExempt[_devWallet] = true;
        isFeeExempt[_platformWallet] = true;
        
        // Set swap threshold (0.1% of supply)
        swapTokensAtAmount = (_totalSupply * 10) / 10000;
        
        // Mint tokens to owner
        _mint(_owner, _totalSupply);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    function _update(address from, address to, uint256 amount) internal override {
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
                // On buy
                if (isPair[from] && !isFeeExempt[to]) {
                    require(amount <= maxTransactionAmount, "Buy transfer amount exceeds max");
                    require(balanceOf(to) + amount <= maxWalletAmount, "Max wallet exceeded");
                }
                // On sell
                else if (isPair[to] && !isFeeExempt[from]) {
                    require(amount <= maxTransactionAmount, "Sell transfer amount exceeds max");
                }
                // On regular transfer
                else if (!isFeeExempt[to]) {
                    require(balanceOf(to) + amount <= maxWalletAmount, "Max wallet exceeded");
                }
            }
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
        uint256 platformFee = 0;
        
        if (takeFee) {
            // CRITICAL: Calculate platform fee (0.3% on all trades)
            // This goes to Unrugpad owner wallet
            platformFee = (amount * PLATFORM_FEE) / DENOMINATOR;
            tokensForPlatform += platformFee;
            
            // Sell
            if (isPair[to]) {
                uint256 totalSellFee = sellFees.marketing + sellFees.dev + sellFees.lp;
                if (totalSellFee > 0) {
                    uint256 marketingDevLpFees = (amount * totalSellFee) / DENOMINATOR;
                    
                    tokensForMarketing += (marketingDevLpFees * sellFees.marketing) / totalSellFee;
                    tokensForDev += (marketingDevLpFees * sellFees.dev) / totalSellFee;
                    tokensForLiquidity += (marketingDevLpFees * sellFees.lp) / totalSellFee;
                    
                    fees += marketingDevLpFees;
                }
                
                // Additional sell fee
                if (sellFee > 0) {
                    uint256 additionalSellFee = (amount * sellFee) / DENOMINATOR;
                    tokensForSellFee += additionalSellFee;
                    fees += additionalSellFee;
                }
            }
            // Buy
            else if (isPair[from]) {
                uint256 totalBuyFee = buyFees.marketing + buyFees.dev + buyFees.lp;
                if (totalBuyFee > 0) {
                    uint256 marketingDevLpFees = (amount * totalBuyFee) / DENOMINATOR;
                    
                    tokensForMarketing += (marketingDevLpFees * buyFees.marketing) / totalBuyFee;
                    tokensForDev += (marketingDevLpFees * buyFees.dev) / totalBuyFee;
                    tokensForLiquidity += (marketingDevLpFees * buyFees.lp) / totalBuyFee;
                    
                    fees += marketingDevLpFees;
                }
                
                // Additional buy fee
                if (buyFee > 0) {
                    uint256 additionalBuyFee = (amount * buyFee) / DENOMINATOR;
                    tokensForBuyFee += additionalBuyFee;
                    fees += additionalBuyFee;
                }
            }
            
            uint256 totalFees = fees + platformFee;
            if (totalFees > 0) {
                super._update(from, address(this), totalFees);
            }
            
            amount -= totalFees;
        }
        
        super._update(from, to, amount);
    }
    
    function swapBack() private lockTheSwap {
        uint256 contractBalance = balanceOf(address(this));
        uint256 totalTokensToSwap = tokensForMarketing + tokensForDev + tokensForLiquidity + 
                                     tokensForPlatform + tokensForBuyFee + tokensForSellFee;
        
        if (contractBalance == 0 || totalTokensToSwap == 0) {
            return;
        }
        
        if (contractBalance > swapTokensAtAmount * 20) {
            contractBalance = swapTokensAtAmount * 20;
        }
        
        // Calculate LP tokens (half will be swapped, half added to LP)
        uint256 liquidityTokens = (contractBalance * tokensForLiquidity) / totalTokensToSwap / 2;
        uint256 amountToSwapForETH = contractBalance - liquidityTokens;
        
        uint256 initialETHBalance = address(this).balance;
        
        swapTokensForEth(amountToSwapForETH);
        
        uint256 ethBalance = address(this).balance - initialETHBalance;
        
        uint256 ethForMarketing = (ethBalance * tokensForMarketing) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForDev = (ethBalance * tokensForDev) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForPlatform = (ethBalance * tokensForPlatform) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForBuyFee = (ethBalance * tokensForBuyFee) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForSellFee = (ethBalance * tokensForSellFee) / (totalTokensToSwap - (tokensForLiquidity / 2));
        uint256 ethForLiquidity = ethBalance - ethForMarketing - ethForDev - ethForPlatform - ethForBuyFee - ethForSellFee;
        
        tokensForMarketing = 0;
        tokensForDev = 0;
        tokensForLiquidity = 0;
        tokensForPlatform = 0;
        tokensForBuyFee = 0;
        tokensForSellFee = 0;
        
        // Send to wallets
        if (ethForMarketing > 0) {
            payable(marketingWallet).transfer(ethForMarketing);
        }
        
        if (ethForDev > 0) {
            payable(devWallet).transfer(ethForDev);
        }
        
        // CRITICAL: Send platform fee to Unrugpad owner
        if (ethForPlatform > 0) {
            payable(platformWallet).transfer(ethForPlatform);
            emit PlatformFeeCollected(ethForPlatform);
        }
        
        // Additional fees go to marketing wallet
        if (ethForBuyFee > 0) {
            payable(marketingWallet).transfer(ethForBuyFee);
        }
        
        if (ethForSellFee > 0) {
            payable(marketingWallet).transfer(ethForSellFee);
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
    function setBuyFees(uint256 _marketing, uint256 _dev, uint256 _lp) external onlyOwner {
        require(_marketing <= MAX_FEE_PERCENTAGE, "Marketing fee too high");
        require(_dev <= MAX_FEE_PERCENTAGE, "Dev fee too high");
        require(_lp <= MAX_FEE_PERCENTAGE, "LP fee too high");
        
        uint256 totalFee = _marketing + _dev + _lp + buyFee;
        require(totalFee <= 3000, "Total buy fees exceed 30%");
        
        buyFees.marketing = _marketing;
        buyFees.dev = _dev;
        buyFees.lp = _lp;
        
        emit FeesUpdated("buy", _marketing, _dev, _lp);
    }
    
    function setSellFees(uint256 _marketing, uint256 _dev, uint256 _lp) external onlyOwner {
        require(_marketing <= MAX_FEE_PERCENTAGE, "Marketing fee too high");
        require(_dev <= MAX_FEE_PERCENTAGE, "Dev fee too high");
        require(_lp <= MAX_FEE_PERCENTAGE, "LP fee too high");
        
        uint256 totalFee = _marketing + _dev + _lp + sellFee;
        require(totalFee <= 3000, "Total sell fees exceed 30%");
        
        sellFees.marketing = _marketing;
        sellFees.dev = _dev;
        sellFees.lp = _lp;
        
        emit FeesUpdated("sell", _marketing, _dev, _lp);
    }
    
    function setBuyFee(uint256 _buyFee) external onlyOwner {
        require(_buyFee <= MAX_FEE_PERCENTAGE, "Buy fee too high");
        
        uint256 totalFee = buyFees.marketing + buyFees.dev + buyFees.lp + _buyFee;
        require(totalFee <= 3000, "Total buy fees exceed 30%");
        
        buyFee = _buyFee;
        emit AdditionalFeeUpdated("buy", _buyFee);
    }
    
    function setSellFee(uint256 _sellFee) external onlyOwner {
        require(_sellFee <= MAX_FEE_PERCENTAGE, "Sell fee too high");
        
        uint256 totalFee = sellFees.marketing + sellFees.dev + sellFees.lp + _sellFee;
        require(totalFee <= 3000, "Total sell fees exceed 30%");
        
        sellFee = _sellFee;
        emit AdditionalFeeUpdated("sell", _sellFee);
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
    
    function setLimits(uint256 _maxTx, uint256 _maxWallet) external onlyOwner {
        require(_maxTx >= totalSupply() / 1000, "Max tx too low"); // Min 0.1%
        require(_maxWallet >= totalSupply() / 1000, "Max wallet too low"); // Min 0.1%
        maxTransactionAmount = _maxTx;
        maxWalletAmount = _maxWallet;
        emit LimitsUpdated(_maxTx, _maxWallet);
    }
    
    function removeLimits() external onlyOwner {
        limitsInEffect = false;
        emit LimitsRemoved();
    }
    
    // View functions
    function getTotalBuyFee() external view returns (uint256) {
        return buyFees.marketing + buyFees.dev + buyFees.lp + buyFee + PLATFORM_FEE;
    }
    
    function getTotalSellFee() external view returns (uint256) {
        return sellFees.marketing + sellFees.dev + sellFees.lp + sellFee + PLATFORM_FEE;
    }
    
    function getPlatformFee() external pure returns (uint256) {
        return PLATFORM_FEE;
    }
    
    // Enable receiving ETH
    receive() external payable {}
}