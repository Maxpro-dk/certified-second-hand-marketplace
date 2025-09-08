import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * CertifiedSecondHandMarketplace Contract Deployment Module
 *
 * This module deploys the CertifiedSecondHandMarketplace contract using Hardhat Ignition.
 * The deployer becomes the owner of the contract automatically.
 */
const CertifiedSecondHandMarketplaceModule = buildModule("CertifiedSecondHandMarketplaceModule", (m) => {
  // Deploy the CertifiedSecondHandMarketplace contract
  // No constructor parameters needed - the deployer becomes the owner
  const certifiedSecondHandMarketplace = m.contract("CertifiedSecondHandMarketplace", []);

  // Return the deployed contract for potential use in other modules
  return { certifiedSecondHandMarketplace };
});

export default CertifiedSecondHandMarketplaceModule;