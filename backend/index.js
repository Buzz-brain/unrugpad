const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

require("dotenv").config({ path: path.join(__dirname, ".env") });
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets if present
app.use(express.static(path.join(__dirname, "public")));

// Simple health check
app.get("/", (req, res) => {
  res.send("Unrugpad backend running");
});

// Serve deployed addresses file for frontend to consume
app.get("/deployed_addresses.json", (req, res) => {
  const p = path.join(__dirname, "deployed_addresses.json");
  if (!fs.existsSync(p)) return res.status(404).json({ error: "Not found" });
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: "Failed to read deployed addresses" });
  }
});

// POST /api/verify-proxy
// Body: { proxyAddress: string, constructorArgs: array, network: string }
app.post('/api/verify-proxy', (req, res) => {
  const { proxyAddress, constructorArgs = [], network = 'bsc' } = req.body;
  if (!proxyAddress) {
    return res.status(400).json({ error: 'proxyAddress required' });
  }
  // Ensure all constructor arguments are strings (serialize objects/arrays)
  const serializedConstructorArgs = constructorArgs.map(a => typeof a === 'string' ? a : JSON.stringify(a));

  // Instead of relying on a custom Hardhat task (which may not be loaded),
  // fetch the implementation address here via JSON-RPC then call Hardhat's
  // built-in `verify` task to verify the implementation contract.
  const path = require('path');

  // Load smart-contract .env
  const smartEnvPath = path.resolve(__dirname, '../smart-contract/.env');
  let smartEnv = {};
  try {
    if (fs.existsSync(smartEnvPath)) {
      const envFile = fs.readFileSync(smartEnvPath);
      smartEnv = require('dotenv').parse(envFile);
    }
  } catch (e) {
    // ignore
  }

  const rpcUrl = smartEnv.BSC_RPC_URL || process.env.BSC_RPC_URL;
  if (!rpcUrl) return res.status(500).json({ error: 'BSC_RPC_URL not configured' });

  const https = require('https');
  const rpcPayload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getStorageAt', params: [proxyAddress, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', 'latest'] });

  const url = new URL(rpcUrl);
  const rpcOptions = {
    hostname: url.hostname,
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rpcPayload) }
  };

  const rpcReq = https.request(rpcOptions, (rpcRes) => {
    let body = '';
    rpcRes.on('data', (chunk) => body += chunk.toString());
    rpcRes.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.error) return res.status(500).json({ error: parsed.error });
        const implStorage = parsed.result;
        const implementation = '0x' + implStorage.slice(-40);

        // Build Hardhat verify command
        // Pass env vars to the child process so hardhat .env is properly loaded
        const childEnv = { ...process.env, ...smartEnv };
        const runArgs = [
          'hardhat', 'verify', '--network', network,
          '--contract', 'contracts/UnrugpadToken.sol:UnrugpadToken',
          implementation,
          ...serializedConstructorArgs
        ];

        const child = spawn('npx', runArgs, { shell: true, cwd: path.resolve(__dirname, '../smart-contract'), env: childEnv });
        let output = '';
        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });
        child.on('close', (code) => {
          // Normalize output for simple parsing
          const norm = output.replace(/\r/g, '\n');

          // Detect common outcomes
          const alreadyVerified = /has already been verified on/i.test(norm) || /already verified/i.test(norm);
          const apiKeyEmpty = /BscScan API key is empty|EXPLORER_API_KEY_EMPTY|HHE80029/i.test(norm);

          // Try to extract an explorer link (BscScan or generic link printed by Hardhat)
          let explorer = null;
          const explMatch = norm.match(/(https?:\/\/[^\s]+bscscan\.com\/address\/0x[0-9a-fA-F]{40}[^\s]*)/i) || norm.match(/Explorer:\s*(https?:\/\/\S+)/i);
          if (explMatch) explorer = explMatch[1];

          if (alreadyVerified) {
            return res.json({ code, status: 'already_verified', explorer, output: norm });
          }

          if (apiKeyEmpty) {
            return res.status(500).json({ code, status: 'api_key_missing', message: 'BscScan API key missing or empty in Hardhat config/environment', output: norm });
          }

          if (code !== 0) {
            return res.status(500).json({ code, status: 'failed', output: norm });
          }

          return res.json({ code, status: 'ok', explorer, output: norm });
        });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse RPC response', details: body });
      }
    });
  });

  rpcReq.on('error', (err) => {
    return res.status(500).json({ error: 'RPC request failed', details: err.message });
  });
  rpcReq.write(rpcPayload);
  rpcReq.end();
});

// Return token ABI/artifact if available (useful for front-end)
app.get("/artifacts/UnrugpadToken.json", (req, res) => {
  const p = path.join(__dirname, "..", "smart-contract", "artifacts", "contracts", "UnrugpadToken.sol", "UnrugpadToken.json");
  if (!fs.existsSync(p)) return res.status(404).json({ error: "Artifact not found" });
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: "Failed to read artifact" });
  }
});

// Interact endpoint disabled on server for security (use MetaMask / client-side signing)
app.post("/interact", (req, res) => {
  return res.status(403).json({ error: "Server-side interactions disabled. Use MetaMask in the browser." });
});

// GET /api/verify-proxy/status?proxyAddress=0x...
// Returns verification status and explorer link for a contract
app.get('/api/verify-proxy/status', async (req, res) => {
  const proxyAddress = req.query.proxyAddress;
  if (!proxyAddress) {
    return res.status(400).json({ error: 'proxyAddress required' });
  }

  // Load BscScan API key from smart-contract/.env or process.env
  const path = require('path');
  const smartEnvPath = path.resolve(__dirname, '../smart-contract/.env');
  let smartEnv = {};
  try {
    if (fs.existsSync(smartEnvPath)) {
      const envFile = fs.readFileSync(smartEnvPath);
      smartEnv = require('dotenv').parse(envFile);
    }
  } catch (e) {
    // ignore
  }
  const apiKey = smartEnv.BSCSCAN_API_KEY || process.env.BSCSCAN_API_KEY;
  const https = require('https');

  // If API key is available, use BscScan API (preferred)
  if (apiKey) {
    const url = `https://api.bscscan.com/api?module=contract&action=getsourcecode&address=${proxyAddress}&apikey=${apiKey}`;
    try {
      https.get(url, (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => body += chunk.toString());
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (!parsed.result || !Array.isArray(parsed.result) || parsed.result.length === 0) {
              return res.json({ status: 'unknown', explorer: `https://bscscan.com/address/${proxyAddress}` });
            }
            const result = parsed.result[0];
            if (result.SourceCode && result.SourceCode.length > 0) {
              return res.json({ status: 'already_verified', explorer: `https://bscscan.com/address/${proxyAddress}#code` });
            } else {
              return res.json({ status: 'not_verified', explorer: `https://bscscan.com/address/${proxyAddress}` });
            }
          } catch (e) {
            return res.status(500).json({ status: 'failed', error: 'Failed to parse BscScan response', details: body });
          }
        });
      }).on('error', (err) => {
        return res.status(500).json({ status: 'failed', error: 'BscScan API request failed', details: err.message });
      });
    } catch (e) {
      return res.status(500).json({ status: 'failed', error: 'Internal server error', details: String(e) });
    }
    return;
  }

  // No API key: fall back to scraping the BscScan public address page for verification indicators
  const pageUrl = `https://bscscan.com/address/${proxyAddress}#code`;
  try {
    https.get(pageUrl, (pageRes) => {
      let html = '';
      pageRes.on('data', (chunk) => html += chunk.toString());
      pageRes.on('end', () => {
        // Heuristics: look for evidence of verified source code or 'Sorry, We are unable to locate this Contract.'
        const verifiedMarker = /Contract Source Code Verified|Verified Source Code|<span[^>]*>Verified<\/span>/i;
        const notFoundMarker = /Unable to locate this Contract|Sorry, We are unable to locate this Contract/i;
        if (verifiedMarker.test(html)) {
          return res.json({ status: 'already_verified', explorer: `https://bscscan.com/address/${proxyAddress}#code`, note: 'detected via HTML fallback (no API key)'});
        }
        if (notFoundMarker.test(html)) {
          return res.json({ status: 'unknown', explorer: `https://bscscan.com/address/${proxyAddress}` });
        }
        // If neither marker is decisive, try to detect presence of a 'Source Code' section
        if (/Source Code for Contract/i.test(html) || /<div[^>]+id="verifiedbytecode"/i.test(html) || /SourceCode/i.test(html)) {
          return res.json({ status: 'already_verified', explorer: `https://bscscan.com/address/${proxyAddress}#code`, note: 'detected via HTML fallback (no API key)'});
        }
        return res.json({ status: 'not_verified', explorer: `https://bscscan.com/address/${proxyAddress}` });
      });
    }).on('error', (err) => {
      return res.status(500).json({ status: 'failed', error: 'BscScan page request failed', details: err.message });
    });
  } catch (e) {
    return res.status(500).json({ status: 'failed', error: 'Internal server error', details: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Unrugpad backend listening on http://localhost:${PORT}`);
});
