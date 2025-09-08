import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    hardhat: {
      type: "edr-simulated", // Ajout du champ type requis
      chainId: 31337, // Réseau local Hardhat
      accounts: {
        count: 10, // 10 comptes pour les tests
        initialIndex: 0,
        accountsBalance: "10000000000000000000000", // 10,000 ETH par compte
      },
      gas: "auto",
      gasPrice: "auto",
      blockGasLimit: 30000000, // Limite de gaz élevée
      allowUnlimitedContractSize: true, // Pour les tests locaux
      loggingEnabled: true, // Logs pour le débogage
    },
    localhost: {
      type: "http", // Type HTTP pour le nœud local
      url: "http://127.0.0.1:8545", // URL par défaut du nœud Hardhat
      chainId: 31337, // Même chainId que le réseau hardhat
      gas: "auto",
      gasPrice: "auto",
    },
  
    
  },
};

export default config;
