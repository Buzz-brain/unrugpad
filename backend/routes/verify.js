const express = require("express");
const {
  verifyProxyImplementation,
  isVerifiedOnSourceify,
} = require("../services/verificationService");

const router = express.Router();

router.get("/is-verified/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const verified = await isVerifiedOnSourceify(addr);
    const status = verified ? 'verified' : 'not_verified';
    res.json({ address: addr, verified, status });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Backwards-compatible alias used by some clients
router.get("/verify-status/:address", async (req, res) => {
  try {
    const addr = req.params.address;
    const verified = await isVerifiedOnSourceify(addr);
    const status = verified ? 'verified' : 'not_verified';
    res.json({ address: addr, verified, status });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.post("/verify-proxy", async (req, res) => {
  try {
    const { proxyAddress, initCalldata } = req.body;
    if (!proxyAddress)
      return res.status(400).json({ error: "proxyAddress required" });
    const result = await verifyProxyImplementation(
      proxyAddress,
      initCalldata || "0x",
    );
    // If verification is in progress, return 202 Accepted
    if (result && result.status === 'verifying') {
      return res.status(202).json(result);
    }
    // Otherwise return 200 with result
    return res.status(200).json(result);
  } catch (err) {
    const msg = err.message || String(err);
    // Map known Sourcify/transient errors to 202 for in-progress or 200 pending
    if (msg.includes("already being verified")) {
      return res.status(202).json({ status: 'verifying', message: msg });
    }
    if (msg.includes("Sourcify verification failed") || msg.includes("Request failed with status code 404")) {
      return res.status(202).json({ status: 'pending', message: msg });
    }
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
