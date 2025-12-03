# Sample Hardhat 3 Beta Project (`node:test` and `viem`)

This project showcases a Hardhat 3 Beta project using the native Node.js test runner (`node:test`) and the `viem` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using [`node:test`](nodejs.org/api/test.html), the new Node.js native test runner, and [`viem`](https://viem.sh/).
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```


npm install --save-dev hardhat
npx hardhat --init
npx hardhat node
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=<paste one of the Hardhat accounts>



































Here’s a checklist of the client’s complaints, with resolution status and notes:

1. DeploymentResult.jsx: Buy/Sell Fee % Shows 0%
Client Input: Buy fees: 2% (marketing), 1% (dev), 1% (lp); Sell fees: 10% (marketing), 10% (dev), 10% (lp).
Issue: Deployment result page shows 0% for both buy and sell fee.
Status: ❌ Not resolved.
Action Needed: Review how buy/sell fee values are passed and displayed in DeploymentResult.jsx. Ensure correct calculation and rendering.
2. Token Not Showing in Dashboard After Deployment
Issue: Token deployed successfully but does not appear in dashboard.
Status: ❌ Not resolved.
Action Needed: Confirm dashboard fetches tokens using the correct wallet address and refreshes after deployment. Also, ensure smart contract mapping (userTokens) is updated.
3. Contract Not Auto-Verified After Deployment
Issue: Contract is not verified on BscScan/token sniffer.
Status: ❌ Not resolved.
Action Needed: Implement contract verification step after deployment (e.g., using BscScan API).
4. Tax (Buy/Sell Fee) Not Matching Client Expectation
Client Expectation: Buy tax = 0.3%, Sell tax = 0.3%.
Issue: Token sniffer shows Buy: 0.4%, Sell: 0.9%.
Status: ❌ Not resolved.
Action Needed: Double-check fee configuration in deployment form and contract logic. Ensure platform fee (0.3%) is correctly set and not added to user-configured fees.
5. Other Observations (LP Ratio, Holders, Liquidity, etc.)
Status: Informational.
Note: Most of these are blockchain stats, not directly controlled by the dApp, except for LP lock (could add LP lock feature in future).