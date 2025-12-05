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

  // Use `--` so arguments after it are passed to the script (not to Hardhat)
  // Place --network before the script so Hardhat consumes it and the `--` correctly passes
  // remaining args to the script.
  const args = [
    'run',
    '--network',
    network,
    '../backend/verifyProxy.js',
    '--',
    proxyAddress,
    ...serializedConstructorArgs
  ];
  const path = require('path');
  // Instead of calling `npx hardhat run` (CLI arg forwarding issues), spawn `node` directly
  // and set HARDHAT_NETWORK so the script can use Hardhat's runtime in the correct network.
  // Run the verification script inside the smart-contract project so `require('hardhat')` resolves.
  // Use npx hardhat run --network <network> scripts/verifyProxy.js -- <proxy> <args...>
  const hardhatArgs = [
    'hardhat',
    'run',
    '--network',
    network,
    'scripts/verifyProxy.js',
    '--',
    proxyAddress,
    ...serializedConstructorArgs
  ];

  const child = spawn('npx', hardhatArgs, {
    shell: true,
    cwd: path.resolve(__dirname, '../smart-contract')
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });
  child.on('close', (code) => {
    res.json({ code, output });
  });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Unrugpad backend listening on http://localhost:${PORT}`);
});
