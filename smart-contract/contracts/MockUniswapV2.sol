// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Minimal mock of UniswapV2-style Factory / Pair / Router for local testing.
// Designed to be tiny and avoid complex constructors or opcodes that can
// trigger "invalid opcode" on some local nodes (Ganache). It supports:
// - factory.createPair(tokenA, tokenB)
// - router.factory() and router.WETH()

contract MockPair {
	address public token0;
	address public token1;
	bool public initialized;

	// Minimal initializer called immediately after create
	function initialize(address _token0, address _token1) external {
		require(!initialized, "ALREADY_INITIALIZED");
		token0 = _token0;
		token1 = _token1;
		initialized = true;
	}
}

contract MockUniswapV2Factory {
	event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

	mapping(address => mapping(address => address)) public getPair;
	address[] public allPairs;

	// Create a new MockPair via CREATE2 for deterministic address (optional)
	function createPair(address tokenA, address tokenB) external returns (address pair) {
		require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
		// Always create with tokenA<tokenB ordering for consistency
		(address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

		require(getPair[token0][token1] == address(0), "PAIR_EXISTS");

		// Simple deployment to avoid low-level assembly/create2 problems on some
		// local nodes. Using `new` is sufficient for tests and initialization.
		MockPair p = new MockPair();
		pair = address(p);

		// initialize the pair
		MockPair(pair).initialize(token0, token1);

		getPair[token0][token1] = pair;
		getPair[token1][token0] = pair;
		allPairs.push(pair);

		emit PairCreated(token0, token1, pair, allPairs.length);
	}

	function allPairsLength() external view returns (uint256) {
		return allPairs.length;
	}
}

contract MockRouter {
	address private factoryAddress;
	address private wethAddress;

	constructor(address _factory, address _weth) {
		factoryAddress = _factory;
		wethAddress = _weth;
	}

	// Uniswap v2 router view functions expected by many contracts
	function factory() external view returns (address) {
		return factoryAddress;
	}

	function WETH() external view returns (address) {
		return wethAddress;
	}

	// Minimal passthrough helpers (no real swapping) so code that calls these
	// methods on deploy won't revert. They are intentionally no-ops.
	function addLiquidity(
		address,
		address,
		uint256,
		uint256,
		uint256,
		uint256,
		address,
		uint256
	) external pure returns (uint256, uint256, uint256) {
		return (0, 0, 0);
	}

	// Provide a minimal interface for swap functions used by tokens when present.
	function swapExactTokensForETHSupportingFeeOnTransferTokens(
		uint256,
		uint256,
		address[] calldata,
		address,
		uint256
	) external pure {
		// no-op on mock
	}
}

