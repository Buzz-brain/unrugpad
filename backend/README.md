Unrugpad Deployer (backend-assisted)

This is a minimal Express-based backend that invokes the existing Foundry deploy script in this repo to deploy `UnrugpadToken` proxies with custom parameters.

Prerequisites
- Node.js (16+ recommended)
- Foundry (forge) installed and available in PATH
- The repository compiled with `forge build` (optional but helpful)

Environment
- Set the following environment variables for the server process (do NOT commit private keys):
  - PRIVATE_KEY - hex private key of the deployer (used by `forge script` in the server run)
  - RPC_URL - RPC endpoint URL (e.g., Infura or Alchemy) for the target network
  - PORT - (optional) port for the server (default 3000)

Install & Run
1. cd server
2. npm install
3. (recommended) Run `forge build` at the repo root so script artifacts are ready
4. Start the server (example on PowerShell):

```powershell
$env:PRIVATE_KEY = '<your_private_key_here>'
$env:RPC_URL = 'https://rpc.sepolia.org'
node index.js
```

Usage
- Open http://localhost:3000 in your browser and fill the form. The server will call:

`forge script script/Deploy.s.sol:DeployWithCustomParams --broadcast --private-key $PRIVATE_KEY --rpc-url $RPC_URL`

and return the CLI output in the response. The Foundry script reads further env vars (TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY, OWNER, MARKETING_WALLET, DEV_WALLET, PLATFORM_WALLET, ROUTER_ADDRESS) which the server sets from the form before invoking `forge script`.

Security notes
- Do NOT store PRIVATE_KEY in source control. Use environment variable injection, a secret manager, or an HSM in production.
- This server runs the deploy command synchronously and returns CLI output — for production you'd run async job queues and persist results.
- Validate all inputs and rate-limit access before exposing to the internet.

Next steps
- Add authentication on the endpoint
- Parse forge output to extract deployed addresses and store them
- Add webhook or email notifications when deployment completes
- Optionally replace Foundry invocation with direct ethers.js deployment for lighter-weight integration
