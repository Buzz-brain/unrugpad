// services/verificationService.js
// Handles contract verification via Sourcify v2 API.
// Also exports an Express router for HTTP access.

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const NodeCache = require("node-cache");

const cache = new NodeCache();
const LOG_DIR = path.join(__dirname, '..', 'logs');
function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {
    console.warn('[sourcify] could not ensure log dir', e.message);
  }
}

function logVerificationEvent(event, details = {}) {
  try {
    ensureLogDir();
    const p = path.join(LOG_DIR, 'verification.log');
    const entry = { ts: new Date().toISOString(), event, details };
    fs.appendFileSync(p, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.warn('[sourcify] failed to write log', e.message);
  }
}

const SOURCIFY_API = "https://sourcify.dev/server";
const CHAIN_ID = "56";
const SMART_CONTRACT_ROOT = path.join(__dirname, "..", "..", "smart-contract");
const COMPILER_VERSION = "0.8.24+commit.e11b9ed9";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF ALREADY VERIFIED — Sourcify v2
// ─────────────────────────────────────────────────────────────────────────────
async function isVerifiedOnSourceify(address) {
  const cacheKey = `sourcify:${address.toLowerCase()}`;
  if (cache.get(cacheKey)) return true;

  try {
    const { data } = await axios.get(
      `${SOURCIFY_API}/v2/contract/${CHAIN_ID}/${address}`,
      { timeout: 10_000 },
    );
    const verified = !!(data?.creationMatch || data?.runtimeMatch);
    if (verified) cache.set(cacheKey, true, 3600);
    return verified;
  } catch (err) {
    // 404 = not verified
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POLL VERIFICATION JOB — v2 is async/job-based
// ─────────────────────────────────────────────────────────────────────────────
async function pollVerificationJob(
  jobId,
  label = "contract",
  maxAttempts = 30,
) {
  for (let i = 1; i <= maxAttempts; i++) {
    const { data } = await axios.get(
      `${SOURCIFY_API}/v2/verification-jobs/${jobId}`,
      { timeout: 15_000 },
    );

    const match =
      data?.contract?.creationMatch || data?.contract?.runtimeMatch || "none";
    console.log(
      `[sourcify] ${label} poll ${i}/${maxAttempts}: status=${data?.status} match=${match}`,
    );

    if (data?.status === "completed") {
      if (
        match === "perfect" ||
        match === "partial" ||
        match === "exact_match"
      ) {
        return { success: true, status: match };
      }
      throw new Error(
        `Job completed but no match. Contract: ${JSON.stringify(data?.contract)}`,
      );
    }

    if (data?.status === "failed") {
      throw new Error(
        `Verification job failed: ${data?.error || JSON.stringify(data)}`,
      );
    }

    await sleep(5000);
  }

  throw new Error(
    `Verification job ${jobId} timed out after ${maxAttempts} attempts`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE VERIFY — POST to Sourcify v2
// ─────────────────────────────────────────────────────────────────────────────
async function verifyOnSourceify(
  contractAddress,
  stdJsonInput,
  compilationTarget,
) {
  if (await isVerifiedOnSourceify(contractAddress)) {
    console.log(`[sourcify] ${contractAddress} already verified ✅`);
    return { status: "already_verified" };
  }

  console.log(`[sourcify] Submitting ${contractAddress} for verification...`);
  console.log(`[sourcify]   target: ${compilationTarget}`);

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logVerificationEvent('submit_attempt', { contractAddress, attempt });
      const { data } = await axios.post(
        `${SOURCIFY_API}/v2/verify/${CHAIN_ID}/${contractAddress}`,
        {
          stdJsonInput,
          compilerVersion: COMPILER_VERSION,
          contractIdentifier: compilationTarget,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30_000,
        },
      );

      console.log(`[sourcify] Submission response:`, JSON.stringify(data));

      const jobId = data?.verificationId || data?.jobId;
      if (!jobId) {
        throw new Error(`No verificationId in response: ${JSON.stringify(data)}`);
      }

      console.log(`[sourcify] Job ID: ${jobId} — polling...`);
      await sleep(3000);

      const result = await pollVerificationJob(jobId, contractAddress);
      cache.set(`sourcify:${contractAddress.toLowerCase()}`, true, 3600);
      console.log(`[sourcify] ✅ Verified with status: ${result.status}`);
      return { status: "verified" };
    } catch (err) {
      logVerificationEvent('submit_error', { contractAddress, attempt, message: err.message, status: err.response?.status });
      const errBody = err.response?.data;
      const errMsg = errBody?.error || errBody?.message || err.message;

      // If Sourcify reports the contract is already being verified, return a non-error status
      if (typeof errMsg === "string" && errMsg.includes("already being verified")) {
        console.log(`[sourcify] Verification already in progress for ${contractAddress}`);
        return { status: "verifying", message: errMsg };
      }

      // If it's already verified according to message, mark cached and return
      if (
        typeof errMsg === "string" &&
        (errMsg.includes("already verified") || errMsg.includes("already partially verified"))
      ) {
        cache.set(`sourcify:${contractAddress.toLowerCase()}`, true, 3600);
        console.log(`[sourcify] Already verified ✅`);
        return { status: "already_verified" };
      }

      const statusCode = err.response?.status;
      const isTransient = [429, 500, 502, 503, 504, 404].includes(statusCode) || !statusCode;
      console.log(`[sourcify] Submission attempt ${attempt} failed: ${errMsg} (status=${statusCode})`);
      if (attempt < maxAttempts && isTransient) {
        const backoff = 1000 * Math.pow(2, attempt - 1);
        logVerificationEvent('retrying', { contractAddress, attempt, backoff });
        console.log(`[sourcify] Retrying in ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }

      console.log("[sourcify] Full error response:", JSON.stringify(errBody, null, 2));
      logVerificationEvent('submit_failed', { contractAddress, message: errMsg, statusCode });
      throw new Error(`Sourcify verification failed: ${errMsg}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD BSCSCAN SOURCE
// bscscan_source.json = exact standard JSON from BscScan for the verified
// implementation. Has correct settings: viaIR: true, evmVersion: cancun, etc.
// Place in backend/ and commit to repo.
// ─────────────────────────────────────────────────────────────────────────────
function loadBscScanSource() {
  const candidates = [
    path.join(__dirname, "..", "bscscan_source.json"),
    path.join(__dirname, "bscscan_source.json"),
    path.join(process.cwd(), "bscscan_source.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[sourcify] Using BscScan source: ${p}`);
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }

  throw new Error(
    "bscscan_source.json not found. Place it in the backend/ directory.\n" +
      "Regenerate with: node scripts/fetchBscScanSource.js",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD STANDARD JSON INPUT
// ─────────────────────────────────────────────────────────────────────────────
function buildStdJsonInput(settings, sourceFiles) {
  return {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.entries(sourceFiles).map(([k, v]) => [k, { content: v }]),
    ),
    settings: {
      remappings: settings.remappings,
      optimizer: settings.optimizer,
      evmVersion: settings.evmVersion,
      viaIR: settings.viaIR,
      metadata: settings.metadata || { bytecodeHash: "ipfs" },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"],
        },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────
async function verifyImplementation(implementationAddress) {
  if (await isVerifiedOnSourceify(implementationAddress)) {
    console.log(`[sourcify] Implementation already verified ✅`);
    return;
  }

  const bscScanSource = loadBscScanSource();

  const sourceFiles = {};
  for (const [sourcePath] of Object.entries(bscScanSource.sources || {})) {
    const relativePath = sourcePath.replace(/^smart-contract\//, "");
    const fullPath = path.join(SMART_CONTRACT_ROOT, relativePath);
    if (fs.existsSync(fullPath)) {
      sourceFiles[sourcePath] = fs.readFileSync(fullPath, "utf8");
    } else {
      console.warn(`[sourcify] Missing: ${fullPath}`);
    }
  }

  console.log(
    `[sourcify] ${Object.keys(sourceFiles).length} source files for implementation`,
  );

  const stdJsonInput = buildStdJsonInput(bscScanSource.settings, sourceFiles);

  const resp = await verifyOnSourceify(
    implementationAddress,
    stdJsonInput,
    "smart-contract/contracts/UnrugpadToken.sol:UnrugpadToken",
  );

  if (resp && (resp.status === 'verifying' || resp.status === 'already_verified')) {
    console.log(`[sourcify] Implementation verification status: ${resp.status}`);
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY PROXY
// ─────────────────────────────────────────────────────────────────────────────
async function verifyProxy(proxyAddress) {
  if (await isVerifiedOnSourceify(proxyAddress)) {
    console.log(`[sourcify] Proxy already verified ✅`);
    return;
  }

  const proxySourcePaths = [
    "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol",
    "lib/openzeppelin-contracts/contracts/proxy/Proxy.sol",
    "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Utils.sol",
    "lib/openzeppelin-contracts/contracts/proxy/beacon/IBeacon.sol",
    "lib/openzeppelin-contracts/contracts/interfaces/IERC1967.sol",
    "lib/openzeppelin-contracts/contracts/utils/Address.sol",
    "lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol",
    "lib/openzeppelin-contracts/contracts/utils/Errors.sol",
  ];

  const sourceFiles = {};
  for (const sourcePath of proxySourcePaths) {
    const fullPath = path.join(SMART_CONTRACT_ROOT, sourcePath);
    if (fs.existsSync(fullPath)) {
      sourceFiles[sourcePath] = fs.readFileSync(fullPath, "utf8");
    } else {
      console.warn(`[sourcify] Missing proxy source: ${fullPath}`);
    }
  }

  const bscScanSource = loadBscScanSource();
  const stdJsonInput = buildStdJsonInput(bscScanSource.settings, sourceFiles);

  console.log(
    `[sourcify] ${Object.keys(sourceFiles).length} source files for proxy`,
  );

  const resp = await verifyOnSourceify(
    proxyAddress,
    stdJsonInput,
    "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
  );

  if (resp && (resp.status === 'verifying' || resp.status === 'already_verified')) {
    console.log(`[sourcify] Proxy verification status: ${resp.status}`);
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
async function verifyProxyImplementation(proxyAddress) {
  logVerificationEvent('verify_request', { proxyAddress });

  // If proxy is already verified on Sourcify, short-circuit
  if (await isVerifiedOnSourceify(proxyAddress)) {
    const explorerUrl = `https://bscscan.com/address/${proxyAddress}#code`;
    console.log(`[sourcify] ${proxyAddress} already verified`);
    logVerificationEvent('already_verified', { proxyAddress });
    return { status: "already_verified", implAddress: null, explorerUrl };
  }

  const proxyResolver = require("../utils/proxyResolver");
  const implementationAddress =
    await proxyResolver.getImplementationAddress(proxyAddress);
  if (!implementationAddress) {
    logVerificationEvent('resolve_failed', { proxyAddress });
    throw new Error(`Could not resolve implementation for ${proxyAddress}`);
  }

  console.log(`[sourcify] ${proxyAddress} → impl ${implementationAddress}`);
  logVerificationEvent('resolved_impl', { proxyAddress, implementationAddress });

  await verifyImplementation(implementationAddress);
  const proxyResp = await verifyProxy(proxyAddress);

  if (proxyResp && proxyResp.status === 'verifying') {
    logVerificationEvent('proxy_verifying', { proxyAddress });
    return { status: 'verifying', implAddress: implementationAddress };
  }

  console.log(`[sourcify] ✅ ${proxyAddress} fully verified`);
  const explorerUrl = `https://bscscan.com/address/${proxyAddress}#code`;
  logVerificationEvent('verified', { proxyAddress, implementationAddress });
  return { status: "verified", implAddress: implementationAddress, explorerUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — core functions only
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  verifyProxyImplementation,
  isVerifiedOnSourceify,
  verifyImplementation,
  verifyProxy,
};
