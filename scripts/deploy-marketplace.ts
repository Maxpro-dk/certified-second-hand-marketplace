// import { network } from "hardhat";
// import { formatEther } from "viem";
// import { writeFileSync, mkdirSync, existsSync } from "fs";
// import { join } from "path";

// /**
//  * Deployment script for the CertifiedSecondHandMarketplace contract
//  * Saves deployment details to a JSON file
//  *
//  * Usage:
//  * npx hardhat run scripts/deploy-marketplace.ts --network etherlinkTestnet
//  */
// async function main() {
//   console.log("🚀 Starting CertifiedSecondHandMarketplace contract deployment...");

//   // Connect to the network using Hardhat 3 pattern
//   const { viem } = await network.connect();

//   // Get the deployer account
//   const [deployer, platformWallet] = await viem.getWalletClients();
//   console.log("📋 Deploying with account:", deployer.account.address);
//   console.log("🏦 Platform wallet:", platformWallet.account.address);

//   // Get the deployer's balance
//   const publicClient = await viem.getPublicClient();
//   const balance = await publicClient.getBalance({
//     address: deployer.account.address,
//   });
//   console.log("💰 Deployer balance:", formatEther(balance), "ETH");

//   // Deploy the CertifiedSecondHandMarketplace contract
//   console.log("📦 Deploying CertifiedSecondHandMarketplace contract...");
//   const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [
//     platformWallet.account.address
//   ]);

//   console.log("✅ CertifiedSecondHandMarketplace contract deployed successfully!");
//   console.log("📍 Contract address:", marketplace.address);
//   console.log("👤 Contract owner:", deployer.account.address);
//   console.log("🏦 Platform wallet:", platformWallet.account.address);

//   // Verify the deployment
//   const contractOwner = await marketplace.read.contractOwner();
//   const platformWalletAddress = await marketplace.read.platformWallet();
//   const totalItems = await marketplace.read.getTotalItemsCount();
//   const isDeployerCertifier = await marketplace.read.certifiers([deployer.account.address]);
//   const isPlatformCertifier = await marketplace.read.certifiers([platformWallet.account.address]);

//   console.log("\n🔍 Deployment verification:");
//   console.log("  Contract owner:", contractOwner);
//   console.log("  Platform wallet:", platformWalletAddress);
//   console.log("  Total items:", totalItems.toString());
//   console.log("  Deployer is certifier:", isDeployerCertifier);
//   console.log("  Platform wallet is certifier:", isPlatformCertifier);
//   console.log("  Owner matches deployer:", contractOwner.toLowerCase() === deployer.account.address.toLowerCase());
//   console.log("  Platform wallet matches:", platformWalletAddress.toLowerCase() === platformWallet.account.address.toLowerCase());

//   // Prepare deployment data to save
//   const deploymentData = {
//     timestamp: new Date().toISOString(),
//     contract: {
//       name: "CertifiedSecondHandMarketplace",
//       address: marketplace.address,
//       abi: marketplace.abi,
//     },
//     deployment: {
//       deployer: deployer.account.address,
//       platformWallet: platformWallet.account.address,
//       blockNumber: await publicClient.getBlockNumber(),
//     },
//     verification: {
//       contractOwner: contractOwner,
//       platformWallet: platformWalletAddress,
//       totalItems: totalItems.toString(),
//       deployerIsCertifier: isDeployerCertifier,
//       platformIsCertifier: isPlatformCertifier,
//     }
//   };

//   // Create deployments directory if it doesn't exist
//   const deploymentsDir = join(__dirname, '..', 'deployments');
//   if (!existsSync(deploymentsDir)) {
//     mkdirSync(deploymentsDir, { recursive: true });
//   }

//   // Save deployment data to JSON file
//   const deploymentFile = join(deploymentsDir, `deployment-${Date.now()}.json`);
//   writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  
//   // Also save a latest deployment file for easy access
//   const latestDeploymentFile = join(deploymentsDir, `deployment-latest.json`);
//   writeFileSync(latestDeploymentFile, JSON.stringify(deploymentData, null, 2));

//   console.log("\n💾 Deployment details saved to:");
//   console.log("   ", deploymentFile);
//   console.log("   ", latestDeploymentFile);

//   console.log("\n📝 Deployment Summary:");
//   console.log("  ✓ Contract deployed to:", marketplace.address);
//   console.log("  ✓ Owner set to:", contractOwner);
//   console.log("  ✓ Platform wallet set to:", platformWalletAddress);
//   console.log("  ✓ Deployer registered as certifier");
//   console.log("  ✓ Platform wallet registered as certifier");
//   console.log("  ✓ Marketplace ready for user registration");

//   console.log("\n🎯 Next steps:");
//   console.log("  1. Contract address saved to deployment files");
//   console.log("  2. Use the ABI from deployment file for frontend integration");
//   console.log("  3. Register additional certifiers if needed");
//   console.log("  4. Test user registration and item listing");
//   console.log("  5. Verify contract on block explorer if needed");
//   console.log("  6. Set up frontend to interact with the contract");

//   return {
//     address: marketplace.address,
//     deploymentFile,
//     latestDeploymentFile
//   };
// }

// // Execute the deployment
// main()
//   .then((result) => {
//     console.log(`\n🎉 Deployment completed!`);
//     console.log(`   Contract address: ${result.address}`);
//     console.log(`   Deployment files: ${result.deploymentFile}, ${result.latestDeploymentFile}`);
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("❌ Deployment failed:", error);
//     process.exit(1);
//   });