import { network } from "hardhat";
import { formatEther } from "viem";

/**
 * Deployment script for the certified  second  hand  marketplace  contract
 *
 * Usage:
 * npx hardhat run scripts/deploy-marketplace.ts --network etherlinkTestnet
*/
async function main() {
  console.log("🚀 certified  second  hand  marketplace...");

  // Connect to the network using Hardhat 3 pattern
  const { viem } = await network.connect();

  // Get the deployer account
  const [deployer] = await viem.getWalletClients();
  console.log("📋 Deploying with account:", deployer.account.address);

  // Get the deployer's balance
  const publicClient = await viem.getPublicClient();
  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log("💰 Account balance:", formatEther(balance), "ETH");

  // Deploy the marketplace contract
  console.log("📦 Deploying  certified  second  hand  marketplace contract...");
  const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

  console.log("✅  certified  second  hand  marketplace contract deployed successfully!");
  console.log("📍 Contract address:", marketplace.address);
  console.log("👤 Owner address:", deployer.account.address);

  console.log("\n🎯 Next steps:");
  console.log("  1. Save the contract address for frontend integration");
  console.log("  2. Fund the deployer account for withdrawals");
  console.log("  3. Test marketplaces and withdrawals");
  console.log("  4. Verify contract on block explorer if needed");

  return marketplace.address;
}

// Execute the deployment
main()
  .then((address) => {
    console.log(`\n🎉 Deployment completed! Contract address: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });