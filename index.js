const express = require("express");
const bodyParser = require("body-parser");
const { execSync } = require("child_process");
const helmet = require("helmet");
const path = require("path");
const cors = require("cors");

// Load .env from server folder if present
require("dotenv").config({ path: path.join(__dirname, ".env") });
const ethers = require("ethers");
const solc = require("solc");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend (simple form)
app.use(express.static(path.join(__dirname, "public")));

function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function toBasisPoints(percent) {
  // percent like '1' -> 100 bps
  const p = Number(percent);
  if (Number.isNaN(p) || p < 0) return null;
  return Math.floor(p * 100);
}

// Helper for solc import resolution
// Keep a list of base directories to try when resolving imports (populated at runtime)
let importBaseDirs = [];
function findImports(importPath) {
  try {
    // Normalize slashes
    const normImport = importPath.replace(/\\/g, "/");

    // If importBaseDirs is populated, try resolving relative to each base (handles ../ paths)
    for (const base of importBaseDirs) {
      try {
        const cand = path.resolve(base, normImport);
        if (fs.existsSync(cand))
          return { contents: fs.readFileSync(cand, "utf8") };

        // also try without leading ../ segments (some imports may be given relative to the file but requested differently)
        const stripped = normImport.replace(/^\.\/.*/, importPath);
        const cand2 = path.resolve(base, stripped);
        if (fs.existsSync(cand2))
          return { contents: fs.readFileSync(cand2, "utf8") };
      } catch (e) {
        // ignore and continue
      }
    }

    // Try common repo locations relative to server folder
    const candidates = [];
    // contracts/ relative to smart-contract
    candidates.push(
      path.join(__dirname, "..", "smart-contract", "contracts", normImport)
    );
    // lib/openzeppelin-contracts copy
    candidates.push(
      path.join(
        __dirname,
        "..",
        "smart-contract",
        "lib",
        "openzeppelin-contracts",
        "contracts",
        normImport
      )
    );
    // node_modules @openzeppelin path (allow both @openzeppelin/... and @openzeppelin/contracts/... style)
    candidates.push(path.join(__dirname, "..", "node_modules", normImport));
    candidates.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "@openzeppelin",
        "contracts",
        normImport
      )
    );

    for (const c of candidates) {
      try {
        const p = path.normalize(c);
        if (fs.existsSync(p)) return { contents: fs.readFileSync(p, "utf8") };
      } catch (e) {
        // ignore
      }
    }

    // If importPath looks like a package import, try require.resolve
    try {
      const resolved = require.resolve(importPath, {
        paths: [path.join(__dirname, "..")],
      });
      if (fs.existsSync(resolved))
        return { contents: fs.readFileSync(resolved, "utf8") };
    } catch (e) {
      // ignore
    }

    // As a last resort, try resolving importPath relative to this file's parent directories (helps when imports omit ../ prefixes)
    let tryDir = path.join(__dirname, "..");
    for (let i = 0; i < 5; i++) {
      const pth = path.join(tryDir, importPath);
      try {
        if (fs.existsSync(pth))
          return { contents: fs.readFileSync(pth, "utf8") };
      } catch (e) {}
      tryDir = path.join(tryDir, "..");
    }

    return { error: "File not found: " + importPath };
  } catch (e) {
    return { error: e.message };
  }
}

app.post("/deploy", async (req, res) => {
  try {
    // Always define these so they are available in the result object
    let deployedMockFactory = null;
    let deployedMockRouter = null;

    // Setup provider and signer
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    if (!process.env.PRIVATE_KEY) {
      return res.status(500).json({ error: "PRIVATE_KEY not set in .env" });
    }
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const body = req.body;

    // Basic validation
    const isLocalRpc =
      process.env.RPC_URL &&
      (process.env.RPC_URL.includes("127.0.0.1") ||
        process.env.RPC_URL.includes("localhost") ||
        process.env.RPC_URL.includes("8545"));

    // If local RPC, ROUTER_ADDRESS can be omitted (server will deploy a mock router)
    const requiredAddrs = isLocalRpc
      ? ["OWNER", "MARKETING_WALLET", "DEV_WALLET", "PLATFORM_WALLET"]
      : [
          "OWNER",
          "MARKETING_WALLET",
          "DEV_WALLET",
          "PLATFORM_WALLET",
          "ROUTER_ADDRESS",
        ];
    for (const a of requiredAddrs) {
      if (!body[a]) return res.status(400).json({ error: `${a} missing` });
      if (!isValidAddress(body[a]))
        return res.status(400).json({ error: `${a} invalid` });
    }

    if (!body.TOKEN_NAME || !body.TOKEN_SYMBOL)
      return res.status(400).json({ error: "Token name/symbol missing" });
    if (!body.TOTAL_SUPPLY)
      return res.status(400).json({ error: "TOTAL_SUPPLY missing" });

    // Prepare variables for UnrugpadToken ABI/bytecode
    let unrugpadTokenAbi, unrugpadTokenBytecode;

    // Try to find UnrugpadToken artifact in multiple locations
    let unrugpadTokenArtifactPath = path.join(
      __dirname,
      "..",
      "smart-contract",
      "artifacts",
      "contracts",
      "UnrugpadToken.sol",
      "UnrugpadToken.json"
    );
    if (!fs.existsSync(unrugpadTokenArtifactPath)) {

      // Try one directory lower (legacy fallback)
      unrugpadTokenArtifactPath = path.join(
        __dirname,
        "..",
        "smart-contract",
        "artifacts",
        "contracts",
        "UnrugpadToken.sol",
        "UnrugpadToken.json"
      );
    }
    if (fs.existsSync(unrugpadTokenArtifactPath)) {
      const unrugpadTokenArtifact = JSON.parse(
        fs.readFileSync(unrugpadTokenArtifactPath, "utf8")
      );
      unrugpadTokenAbi = unrugpadTokenArtifact.abi;
      unrugpadTokenBytecode = unrugpadTokenArtifact.bytecode;
    } else {
      return res
        .status(500)
        .json({
          error:
            "UnrugpadToken artifact not found. Please run Hardhat compile.",
        });
    }

    // If using a local RPC (localhost/127.0.0.1), deploy a mock Uniswap router/factory first
    if (
      process.env.RPC_URL &&
      (process.env.RPC_URL.includes("127.0.0.1") ||
        process.env.RPC_URL.includes("localhost") ||
        process.env.RPC_URL.includes("8545"))
    ) {
      console.log(
        "Detected local RPC - preparing to deploy mock Uniswap router/factory"
      );

      // Compile and deploy MockUniswapV2.sol — try several common locations
      const possibleMockPaths = [
        path.join(__dirname, "MockUniswapV2.sol"),
        path.join(
          __dirname,
          "..",
          "smart-contract",
          "contracts",
          "MockUniswapV2.sol"
        ),
        path.join(
          __dirname,
          "..",
          "..",
          "smart-contract",
          "contracts",
          "MockUniswapV2.sol"
        ),
        path.join(__dirname, "..", "src", "MockUniswapV2.sol"),
        path.join(
          __dirname,
          "..",
          "..",
          "Unrugpad",
          "smart-contract",
          "contracts",
          "MockUniswapV2.sol"
        ),
        path.join(
          __dirname,
          "..",
          "..",
          "smart-contract",
          "contracts",
          "MockUniswapV2.sol"
        ),
      ];

      let mockPath = null;
      for (const p of possibleMockPaths) {
        if (fs.existsSync(p)) {
          mockPath = p;
          break;
        }
      }
      if (!mockPath) {
        return res
          .status(500)
          .json({
            error:
              "MockUniswapV2.sol not found in server or repo (searched common locations) - cannot deploy local mocks",
          });
      }
      const mockSource = fs.readFileSync(mockPath, "utf8");

      const mockInput = {
        language: "Solidity",
        sources: {
          "MockUniswapV2.sol": { content: mockSource },
        },
        settings: {
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      };

      const mockOutput = JSON.parse(
        solc.compile(JSON.stringify(mockInput), { import: findImports })
      );
      if (mockOutput.errors) {
        const errors = mockOutput.errors.filter((e) => e.severity === "error");
        if (errors.length > 0)
          return res
            .status(500)
            .json({ error: errors.map((e) => e.formattedMessage).join("\n") });
      }

      if (!mockOutput.contracts || !mockOutput.contracts["MockUniswapV2.sol"]) {
        return res
          .status(500)
          .json({
            error: "Mock compilation output missing expected contract entries",
            details: Object.keys(mockOutput.contracts || {}),
          });
      }
      const mockFactory =
        mockOutput.contracts["MockUniswapV2.sol"]["MockUniswapV2Factory"];
      if (!mockFactory)
        return res
          .status(500)
          .json({
            error: "MockUniswapV2Factory not found in compiled output",
            contracts: Object.keys(mockOutput.contracts["MockUniswapV2.sol"]),
          });
      const mockFactoryAbi = mockFactory.abi;
      const mockFactoryBytecode = "0x" + mockFactory.evm.bytecode.object;

      const MockFactory = new ethers.ContractFactory(
        mockFactoryAbi,
        mockFactoryBytecode,
        signer
      );
      console.log("Deploying MockUniswapV2Factory...");

      // Assign to the top-level variable, do NOT redeclare with let
      deployedMockFactory = null;
      try {
        const legacyOverrides = {
          gasLimit: 6_000_000,
          gasPrice: ethers.utils.parseUnits("20", "gwei"),
          type: 0,
        };
        deployedMockFactory = await MockFactory.deploy(legacyOverrides);
        await deployedMockFactory.deployed();
      } catch (e) {
        console.error("MockUniswapV2Factory deploy failed:", e);
        return res
          .status(500)
          .json({
            error: "MockUniswapV2Factory deploy failed",
            details: String(e),
          });
      }

      const mockRouter =
        mockOutput.contracts["MockUniswapV2.sol"]["MockRouter"];
      if (!mockRouter)
        return res
          .status(500)
          .json({
            error: "MockUniswapV2Router not found in compiled output",
            contracts: Object.keys(mockOutput.contracts["MockUniswapV2.sol"]),
          });
      const mockRouterAbi = mockRouter.abi;
      const mockRouterBytecode = "0x" + mockRouter.evm.bytecode.object;

      const MockRouterFactory = new ethers.ContractFactory(
        mockRouterAbi,
        mockRouterBytecode,
        signer
      );
      console.log("Deploying MockUniswapV2Router...");

      // Assign to the top-level variable, do NOT redeclare with let
      deployedMockRouter = null;
      try {
        const legacyOverridesRouter = {
          gasLimit: 6_000_000,
          gasPrice: ethers.utils.parseUnits("20", "gwei"),
          type: 0,
        };
        const deployerAddress = await signer.getAddress();
        deployedMockRouter = await MockRouterFactory.deploy(
          deployedMockFactory.address,
          deployerAddress,
          legacyOverridesRouter
        );
        await deployedMockRouter.deployed();
      } catch (e) {
        console.error("MockUniswapV2Router deploy failed:", e);
        return res
          .status(500)
          .json({
            error: "MockUniswapV2Router deploy failed",
            details: String(e),
          });
      }

      console.log("Deployed mock factory:", deployedMockFactory.address);
      console.log("Deployed mock router :", deployedMockRouter.address);

      // Use the deployed mock router for initialization
      body.ROUTER_ADDRESS = deployedMockRouter.address;
    }

    // Use the artifact we loaded earlier. Fail if not present.
    const abi = unrugpadTokenAbi;
    const bytecode = unrugpadTokenBytecode;
    if (!abi || !bytecode)
      return res
        .status(500)
        .json({ error: "UnrugpadToken artifact did not contain ABI/bytecode" });

    // Deploy implementation
    const Factory = new ethers.ContractFactory(abi, bytecode, signer);
    console.log("Deploying implementation...");
    let implementation;
    const legacyImplOverrides = {
      gasLimit: 8_000_000,
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
      type: 0,
    };
    try {
      implementation = await Factory.deploy(legacyImplOverrides);
      await implementation.deployed();
    } catch (e) {
      console.error("Implementation deploy failed:", e);
      return res
        .status(500)
        .json({ error: "Implementation deploy failed", details: String(e) });
    }

    // Prepare initializer data
    // Parse fee percentages from request and convert to basis points
    const buy_marketing = toBasisPoints(body.BUY_MARKETING);
    const buy_dev = toBasisPoints(body.BUY_DEV);
    const buy_lp = toBasisPoints(body.BUY_LP);
    const sell_marketing = toBasisPoints(body.SELL_MARKETING);
    const sell_dev = toBasisPoints(body.SELL_DEV);
    const sell_lp = toBasisPoints(body.SELL_LP);

    const feeFields = [
      ["BUY_MARKETING", buy_marketing],
      ["BUY_DEV", buy_dev],
      ["BUY_LP", buy_lp],
      ["SELL_MARKETING", sell_marketing],
      ["SELL_DEV", sell_dev],
      ["SELL_LP", sell_lp],
    ];
    for (const [name, val] of feeFields) {
      if (val === null || typeof val !== "number")
        return res.status(400).json({ error: `${name} invalid or missing` });
      if (val < 0)
        return res.status(400).json({ error: `${name} must be non-negative` });
    }

    // Optional: ensure total fees don't exceed 100% (10000 bps)
    if (buy_marketing + buy_dev + buy_lp > 10000)
      return res.status(400).json({ error: "Total BUY fees exceed 100%" });
    if (sell_marketing + sell_dev + sell_lp > 10000)
      return res.status(400).json({ error: "Total SELL fees exceed 100%" });

    const buyFees = { marketing: buy_marketing, dev: buy_dev, lp: buy_lp };
    const sellFees = { marketing: sell_marketing, dev: sell_dev, lp: sell_lp };

    const iface = new ethers.utils.Interface(abi);
    const initData = iface.encodeFunctionData("initialize", [
      body.TOKEN_NAME,
      body.TOKEN_SYMBOL,
      body.TOTAL_SUPPLY,
      body.OWNER,
      body.MARKETING_WALLET,
      body.DEV_WALLET,
      body.PLATFORM_WALLET,
      buyFees,
      sellFees,
      body.ROUTER_ADDRESS,
    ]);

    // Deploy ERC1967Proxy (we'll use the OpenZeppelin proxy bytecode via minimal factory contract approach)
    // For simplicity, deploy a tiny ProxyFactory contract instance (inline bytecode) is complex.
    // Instead, deploy OpenZeppelin ERC1967Proxy solidity source compiled on the fly.

    // Read ERC1967Proxy from lib or node_modules (@openzeppelin/contracts)
    // Always use the root-level lib folder for OpenZeppelin sources
    const proxyPath = path.join(
      __dirname,
      "..",
      "smart-contract",
      "lib",
      "openzeppelin-contracts",
      "contracts",
      "proxy",
      "ERC1967",
      "ERC1967Proxy.sol"
    );
    let proxySource;
    if (fs.existsSync(proxyPath)) {
      // console.log('[OZ LIB] Found ERC1967Proxy in lib:', proxyPath);
      proxySource = fs.readFileSync(proxyPath, "utf8");
      // Set import base dirs for resolving relative imports from this proxy file
      importBaseDirs = [
        path.dirname(proxyPath),
        path.join(path.dirname(proxyPath), ".."),
        path.join(
          __dirname,
          "..",
          "..",
          "lib",
          "openzeppelin-contracts",
          "contracts"
        ),
      ];
    } else {
      console.error("[OZ LIB] ERC1967Proxy.sol NOT FOUND in lib at", proxyPath);
      return res
        .status(500)
        .json({
          error:
            "ERC1967Proxy.sol not found in lib/openzeppelin-contracts. Please ensure all OZ sources are present.",
        });
    }

    // Build a sources map that includes the proxy and its common dependencies so solc can resolve relative imports
    const proxySources = {};

    // Helper to rewrite import paths inside sources to match the keys we will preload in the sources map.
    const rewriteImports = (src, srcKey) => {
      // Replace relative imports with absolute-like keys matching our proxySources keys
      // Examples:
      // ../Proxy.sol -> proxy/Proxy.sol (when srcKey is proxy/ERC1967/ERC1967Proxy.sol)
      // ./ERC1967Utils.sol -> proxy/ERC1967/ERC1967Utils.sol
      return src.replace(
        /import\s+\{([^}]+)\}\s+from\s+\"([^."'].*)\"\s*;/g,
        (m, imports, impPath) => {
          // Normalize slashes
          const norm = impPath.replace(/\\\\/g, "/");
          // If path starts with ./ or ../, resolve relative to srcKey
          if (norm.startsWith("./") || norm.startsWith("../")) {
            const srcParts = srcKey.split("/");
            // remove filename
            srcParts.pop();
            const impParts = norm.split("/");
            for (const part of impParts) {
              if (part === ".") continue;
              if (part === "..") srcParts.pop();
              else srcParts.push(part);
            }
            const resolved = srcParts.join("/");
            return `import {${imports}} from \"${resolved}\";`;
          }
          // For other imports, leave as-is
          return m;
        }
      );
    };

    // For solc, the main file key should be 'ERC1967Proxy.sol' (matches the sources input and error output)
    // All dependencies should be keyed by their relative path from the main file
    // So: 'proxy/Proxy.sol', 'proxy/ERC1967/ERC1967Utils.sol', etc.
    // Rewrite imports in the main proxy source so imports match the keys we will add
    const proxyKey = "ERC1967Proxy.sol";
    // The main proxy source is loaded from a path, but we want to treat it as 'ERC1967Proxy.sol' in the sources
    proxySources[proxyKey] = {
      content: rewriteImports(proxySource, "proxy/ERC1967/ERC1967Proxy.sol"),
    };

    // If we discovered the proxy in node_modules @openzeppelin/contracts, try to include the common deps
    // to avoid findImports resolution issues (interfaces and utils).
    const ozRoot = path.join(
      __dirname,
      "..",
      "node_modules",
      "@openzeppelin",
      "contracts"
    );
    try {
      // Helper to add a file under all possible relative import paths from both lib and node_modules
      const addWithAllRelatives = (relPath, relVariants) => {
        // Try lib first, then node_modules
        const libRoot = path.join(
          __dirname,
          "..",
          "smart-contract",
          "lib",
          "openzeppelin-contracts",
          "contracts"
        );
        const nmRoot = path.join(
          __dirname,
          "..",
          "node_modules",
          "@openzeppelin",
          "contracts"
        );
        let full = path.join(libRoot, relPath);
        let content = null;
        if (fs.existsSync(full)) {
          content = fs.readFileSync(full, "utf8");
        } else {
          full = path.join(nmRoot, relPath);
          if (fs.existsSync(full)) {
            content = fs.readFileSync(full, "utf8");
          }
        }
        if (!content) return false;
        // Add under canonical key
        proxySources[relPath] = { content };
        // Add under all provided relative variants
        for (const rel of relVariants) {
          proxySources[rel] = { content };
        }
        return true;
      };

      // Add all dependencies under canonical and all possible relative keys used in OZ proxy contracts
      addWithAllRelatives("proxy/Proxy.sol", [
        "../Proxy.sol",
        "../../proxy/Proxy.sol",
        "./Proxy.sol",
      ]);
      addWithAllRelatives("proxy/ERC1967/ERC1967Utils.sol", [
        "./ERC1967Utils.sol",
        "ERC1967Utils.sol",
        "../../proxy/ERC1967/ERC1967Utils.sol",
      ]);
      addWithAllRelatives("proxy/beacon/IBeacon.sol", [
        "../beacon/IBeacon.sol",
        "../../proxy/beacon/IBeacon.sol",
        "./beacon/IBeacon.sol",
      ]);
      addWithAllRelatives("interfaces/IERC1967.sol", [
        "../../interfaces/IERC1967.sol",
        "../interfaces/IERC1967.sol",
        "./interfaces/IERC1967.sol",
        "interfaces/IERC1967.sol",
      ]);
      addWithAllRelatives("utils/Address.sol", [
        "../../utils/Address.sol",
        "../utils/Address.sol",
        "./utils/Address.sol",
        "utils/Address.sol",
      ]);
      addWithAllRelatives("utils/StorageSlot.sol", [
        "../../utils/StorageSlot.sol",
        "../utils/StorageSlot.sol",
        "./utils/StorageSlot.sol",
        "utils/StorageSlot.sol",
      ]);
      addWithAllRelatives("utils/Errors.sol", [
        "../utils/Errors.sol",
        "../../utils/Errors.sol",
        "./utils/Errors.sol",
        "utils/Errors.sol",
      ]);

      // Rewrite imports in dependencies as before
      if (proxySources["proxy/Proxy.sol"]) {
        try {
          proxySources["proxy/Proxy.sol"].content = rewriteImports(
            proxySources["proxy/Proxy.sol"].content,
            "proxy/Proxy.sol"
          );
        } catch (e) {}
      }
      if (proxySources["proxy/ERC1967/ERC1967Utils.sol"]) {
        try {
          proxySources["proxy/ERC1967/ERC1967Utils.sol"].content =
            rewriteImports(
              proxySources["proxy/ERC1967/ERC1967Utils.sol"].content,
              "proxy/ERC1967/ERC1967Utils.sol"
            );
        } catch (e) {}
      }
    } catch (e) {
      // ignore — we will still rely on findImports as fallback
      console.warn(
        "Could not preload all OpenZeppelin sources from node_modules:",
        e && e.message ? e.message : e
      );
    }

    const proxyInput = {
      language: "Solidity",
      sources: proxySources,
      settings: {
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    };

    const proxyOutput = JSON.parse(
      solc.compile(JSON.stringify(proxyInput), { import: findImports })
    );
    if (proxyOutput.errors) {
      const errors = proxyOutput.errors.filter((e) => e.severity === "error");
      if (errors.length > 0)
        return res
          .status(500)
          .json({ error: errors.map((e) => e.formattedMessage).join("\n") });
    }

    if (
      !proxyOutput.contracts ||
      !proxyOutput.contracts["ERC1967Proxy.sol"] ||
      !proxyOutput.contracts["ERC1967Proxy.sol"]["ERC1967Proxy"]
    ) {
      return res
        .status(500)
        .json({
          error: "ERC1967Proxy not found in proxy compilation output",
          contracts: Object.keys(proxyOutput.contracts || {}),
        });
    }
    const proxyCompiled =
      proxyOutput.contracts["ERC1967Proxy.sol"]["ERC1967Proxy"];
    if (!proxyCompiled.abi)
      return res
        .status(500)
        .json({ error: "Compiled ERC1967Proxy missing ABI" });
    const proxyAbi = proxyCompiled.abi;
    const proxyBytecode = "0x" + proxyCompiled.evm.bytecode.object;

    const ProxyFactory = new ethers.ContractFactory(
      proxyAbi,
      proxyBytecode,
      signer
    );
    console.log("Deploying proxy...");
    let proxy;
    const legacyProxyOverrides = {
      gasLimit: 8_000_000,
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
      type: 0,
    };
    try {
      proxy = await ProxyFactory.deploy(
        implementation.address,
        initData,
        legacyProxyOverrides
      );
      await proxy.deployed();
    } catch (e) {
      console.error("Proxy deploy failed:", e);
      return res
        .status(500)
        .json({ error: "Proxy deploy failed", details: String(e) });
    }

    // Return structured result and save deployed addresses to disk for later use
    // If the mock contracts were deployed, ensure we use their addresses
    const result = {
      ok: true,
      message: "Deployment successful🎉",
      implementation: implementation.address,
      proxy: proxy.address,
      mockFactory:
        deployedMockFactory && deployedMockFactory.address
          ? deployedMockFactory.address
          : typeof deployedMockFactory === "string"
          ? deployedMockFactory
          : null,
      mockRouter:
        deployedMockRouter && deployedMockRouter.address
          ? deployedMockRouter.address
          : typeof deployedMockRouter === "string"
          ? deployedMockRouter
          : null,
    };

    try {
      const outPath = path.join(__dirname, "deployed_addresses.json");
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
      console.log(
        "Deployment Successful!!🎉. Saved deployed addresses to",
        outPath
      );
    } catch (e) {
      console.warn(
        "Failed to save deployed addresses:",
        e && e.message ? e.message : e
      );
    }

    res.json(result);
  } catch (err) {
    console.error("Deploy error", err && err.message ? err.message : err);
    res
      .status(500)
      .json({ error: String(err && err.message ? err.message : err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Unrugpad deployer listening on http://localhost:${PORT}`);
  console.log("Analyzing contract artifacts and ABIs loading...");
});
