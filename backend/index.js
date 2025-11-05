const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

require("dotenv").config({ path: path.join(__dirname, ".env") });

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
