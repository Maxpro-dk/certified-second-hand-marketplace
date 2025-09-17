import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther } from "viem";

describe("CertifiedSecondHandMarketplace", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const [owner] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      assert.equal(
        (await marketplace.read.owner()).toLowerCase(),
        owner.account.address.toLowerCase()
      );
    });

    it("Should set owner as certifier", async function () {
      const [owner] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      assert.equal(await marketplace.read.certifiers([owner.account.address]), true);
    });

    it("Should initialize with zero items", async function () {
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);
      const items = await marketplace.read.getAllItems();

      assert.equal(items[0].length, 0); // ids
      assert.equal(items[1].length, 0); // names
    });
  });

  describe("Item Registration", function () {
    it("Should allow anyone to register items without user registration", async function () {
      const [, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      const hash = await marketplace.write.registerItem([
        "iPhone 12",
        "SN123456789",
        "iPhone 12 en excellent état",
        "ipfs://Qm..."
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const items = await marketplace.read.getAllItems();
      assert.equal(items[0].length, 1);
      assert.equal(items[1][0], "iPhone 12");
      assert.equal(items[2][0], "SN123456789");
      assert.equal(
        items[3][0].toLowerCase(),
        user1.account.address.toLowerCase()
      );
    });

    it("Should return user items after registration", async function () {
      const [, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      const hash = await marketplace.write.registerItem([
        "MacBook Pro",
        "SN987654321",
        "MacBook Pro 2020",
        "ipfs://Qm..."
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const userItems = await marketplace.read.getUserItems({
        account: user1.account,
      });
      assert.equal(userItems.length, 1);
      assert.equal(userItems[0], 1);
    });

    it("Should create initial transaction on registration", async function () {
      const [, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      const hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.getItem([1]);
      assert.equal(item[9], 1n); // transactionCount should be 1

      const transactions = await marketplace.read.getItemTransactions([1]);
      assert.equal(transactions[0].length, 1); // owners array
      assert.equal(
        transactions[0][0].toLowerCase(),
        user1.account.address.toLowerCase()
      );
      assert.equal(transactions[2][0], 0n); // salePrice should be 0 for registration
    });
  });

  describe("Certification", function () {
    it("Should add new certifier", async function () {
      const [owner, , certifier] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      const hash = await marketplace.write.addCertifier([certifier.account.address], {
        account: owner.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      assert.equal(await marketplace.read.certifiers([certifier.account.address]), true);
    });

    it("Should only allow owner to add certifiers", async function () {
      const [, user1, certifier] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      await assert.rejects(async () => {
        await marketplace.write.addCertifier([certifier.account.address], {
          account: user1.account,
        });
      }, /Not owner/);
    });

    it("Should certify an item", async function () {
      const [owner, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      let hash = await marketplace.write.registerItem([
        "iPad Air",
        "SN555555555",
        "iPad Air 4ème génération",
        "ipfs://Qm..."
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Certify item
      hash = await marketplace.write.certifyItem([1], {
        account: owner.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const isCertified = await marketplace.read.isItemCertified([1]);
      assert.equal(isCertified, true);

      // Check certification details in item
      const item = await marketplace.read.getItem([1]);
      assert.equal(item[6], true); // isCertified
    });

    it("Should fail if non-certifier tries to certify", async function () {
      const [, user1, nonCertifier] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to certify as non-certifier
      await assert.rejects(async () => {
        await marketplace.write.certifyItem([1], {
          account: nonCertifier.account,
        });
      }, /Not certifier/);
    });

    it("Should fail to certify non-existent item", async function () {
      const [owner] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      await assert.rejects(async () => {
        await marketplace.write.certifyItem([999], {
          account: owner.account,
        });
      }, /Item doesn't exist/);
    });
  });

  describe("Item Listing and Sales", function () {
    it("Should allow owners to list items for sale", async function () {
      const [, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      let hash = await marketplace.write.registerItem([
        "PlayStation 5",
        "SNPS5123456",
        "PS5 avec 2 manettes",
        "ipfs://Qm..."
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // List item for sale
      const salePrice = parseEther("1.5");
      hash = await marketplace.write.listForSale([1, salePrice], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.getItem([1]);
      assert.equal(item[7], true); // forSale
      assert.equal(item[8], salePrice); // price
    });

    it("Should prevent non-owners from listing items", async function () {
      const [, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item with user1
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to list with user2
      await assert.rejects(async () => {
        await marketplace.write.listForSale([1, parseEther("1.5")], {
          account: user2.account,
        });
      }, /Not owner/);
    });

    it("Should allow purchasing items", async function () {
      const [, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register and list item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const salePrice = parseEther("1.0");
      hash = await marketplace.write.listForSale([1, salePrice], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Get initial balance
      const sellerBalanceBefore = await publicClient.getBalance({
        address: seller.account.address,
      });

      // Purchase item
      hash = await marketplace.write.buyItem([1], {
        value: salePrice,
        account: buyer.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Check item ownership
      const item = await marketplace.read.getItem([1]);
      assert.equal(
        item[5].toLowerCase(), // itemOwner (changed from owner to avoid shadowing)
        buyer.account.address.toLowerCase()
      );
      assert.equal(item[7], false); // forSale

      // Check seller received funds
      const sellerBalanceAfter = await publicClient.getBalance({
        address: seller.account.address,
      });
      assert.ok(sellerBalanceAfter > sellerBalanceBefore);

      // Check transaction count increased
      assert.equal(item[9], 2n); // transactionCount (registration + purchase)
    });

    it("Should prevent purchasing items not for sale", async function () {
      const [, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item but don't list for sale
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to purchase item not for sale
      await assert.rejects(async () => {
        await marketplace.write.buyItem([1], {
          value: parseEther("1.0"),
          account: buyer.account,
        });
      }, /Not for sale/);
    });

    it("Should prevent purchasing with insufficient funds", async function () {
      const [, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register and list item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const salePrice = parseEther("1.0");
      hash = await marketplace.write.listForSale([1, salePrice], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to purchase with insufficient funds
      await assert.rejects(async () => {
        await marketplace.write.buyItem([1], {
          value: parseEther("0.5"), // Less than sale price
          account: buyer.account,
        });
      }, /Insufficient funds/);
    });

    it("Should update user items lists after purchase", async function () {
      const [, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register and list item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const salePrice = parseEther("1.0");
      hash = await marketplace.write.listForSale([1, salePrice], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Purchase item
      hash = await marketplace.write.buyItem([1], {
        value: salePrice,
        account: buyer.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Check user items lists
      const sellerItems = await marketplace.read.getUserItems({
        account: seller.account,
      });
      const buyerItems = await marketplace.read.getUserItems({
        account: buyer.account,
      });

      assert.equal(sellerItems.length, 0);
      assert.equal(buyerItems.length, 1);
      assert.equal(buyerItems[0], 1);
    });
  });

  describe("Item Transfers", function () {
    it("Should allow owners to transfer items", async function () {
      const [, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Transfer item
      hash = await marketplace.write.transferItem([1, user2.account.address], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.getItem([1]);
      assert.equal(
        item[5].toLowerCase(), // itemOwner
        user2.account.address.toLowerCase()
      );
      assert.equal(item[7], false); // forSale should be false after transfer

      // Check user items lists
      const user1Items = await marketplace.read.getUserItems({
        account: user1.account,
      });
      const user2Items = await marketplace.read.getUserItems({
        account: user2.account,
      });

      assert.equal(user1Items.length, 0);
      assert.equal(user2Items.length, 1);
      assert.equal(user2Items[0], 1);

      // Check transaction count increased
      assert.equal(item[9], 2n); // transactionCount (registration + transfer)
    });

    it("Should prevent non-owners from transferring items", async function () {
      const [, user1, user2, user3] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item with user1
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to transfer with user2 (not owner)
      await assert.rejects(async () => {
        await marketplace.write.transferItem([1, user3.account.address], {
          account: user2.account,
        });
      }, /Not owner/);
    });

    it("Should add transfer transaction with zero price", async function () {
      const [, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Transfer item
      hash = await marketplace.write.transferItem([1, user2.account.address], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const transactions = await marketplace.read.getItemTransactions([1]);
      assert.equal(transactions[0].length, 2); // owners (registration + transfer)
      assert.equal(
        transactions[0][1].toLowerCase(),
        user2.account.address.toLowerCase()
      );
      assert.equal(transactions[2][1], 0n); // salePrice should be 0 for transfer
    });
  });

  describe("View Functions", function () {
    it("Should return all items correctly", async function () {
      const [, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register multiple items
      const itemsToCreate = [
        { name: "Item 1", numSerie: "SN1", description: "Desc 1", image: "ipfs://1" },
        { name: "Item 2", numSerie: "SN2", description: "Desc 2", image: "ipfs://2" },
        { name: "Item 3", numSerie: "SN3", description: "Desc 3", image: "ipfs://3" },
      ];

      for (const item of itemsToCreate) {
        const hash = await marketplace.write.registerItem([
          item.name,
          item.numSerie,
          item.description,
          item.image
        ], {
          account: user1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const allItems = await marketplace.read.getAllItems();
      assert.equal(allItems[0].length, 3); // ids
      assert.equal(allItems[1].length, 3); // names
      assert.equal(allItems[2].length, 3); // numSeries
      assert.equal(allItems[3].length, 3); // owners
      assert.equal(allItems[4].length, 3); // isCertifieds
      assert.equal(allItems[5].length, 3); // forSales
      assert.equal(allItems[6].length, 3); // prices
      assert.equal(allItems[7].length, 3); // transactionCounts

      // Check all items have 1 transaction (registration)
      for (let i = 0; i < 3; i++) {
        assert.equal(allItems[7][i], 1n); // transactionCount
      }
    });

    it("Should return item details correctly", async function () {
      const [, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      const hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A detailed description",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.getItem([1]);
      assert.equal(item[0], 1); // id
      assert.equal(item[1], "Test Item"); // name
      assert.equal(item[2], "SN123456"); // numSerie
      assert.equal(item[3], "A detailed description"); // description
      assert.equal(item[4], "ipfs://test-image"); // image
      assert.equal(
        item[5].toLowerCase(), // itemOwner
        user1.account.address.toLowerCase()
      );
      assert.equal(item[6], false); // isCertified
      assert.equal(item[7], false); // forSale
      assert.equal(item[8], 0n); // price
      assert.equal(item[9], 1n); // transactionCount
    });

    it("Should return item transactions correctly", async function () {
      const [, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Transfer item to create another transaction
      hash = await marketplace.write.transferItem([1, user2.account.address], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const transactions = await marketplace.read.getItemTransactions([1]);
      assert.equal(transactions[0].length, 2); // owners (registration + transfer)
      assert.equal(transactions[1].length, 2); // datetimes
      assert.equal(transactions[2].length, 2); // salePrices

      // Check transaction details
      assert.equal(
        transactions[0][0].toLowerCase(),
        user1.account.address.toLowerCase()
      ); // First transaction (registration)
      assert.equal(
        transactions[0][1].toLowerCase(),
        user2.account.address.toLowerCase()
      ); // Second transaction (transfer)
      assert.equal(transactions[2][0], 0n); // Registration price = 0
      assert.equal(transactions[2][1], 0n); // Transfer price = 0
    });
  });

  describe("Edge Cases", function () {
    it("Should handle non-existent items correctly", async function () {
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Try to access non-existent item
      await assert.rejects(async () => {
        await marketplace.read.getItem([999]);
      }, /Item doesn't exist/);

      await assert.rejects(async () => {
        await marketplace.read.isItemCertified([999]);
      }, /Item doesn't exist/);

      await assert.rejects(async () => {
        await marketplace.read.getItemTransactions([999]);
      }, /Item doesn't exist/);
    });

    it("Should handle item purchase with exact funds", async function () {
      const [, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register and list item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const salePrice = parseEther("1.0");
      hash = await marketplace.write.listForSale([1, salePrice], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Purchase with exact amount
      hash = await marketplace.write.buyItem([1], {
        value: salePrice,
        account: buyer.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.getItem([1]);
      assert.equal(
        item[5].toLowerCase(), // itemOwner
        buyer.account.address.toLowerCase()
      );
    });

    it("Should handle purchase transaction correctly", async function () {
      const [, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

      // Register and list item
      let hash = await marketplace.write.registerItem([
        "Test Item",
        "SN123456",
        "A test item",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const salePrice = parseEther("1.0");
      hash = await marketplace.write.listForSale([1, salePrice], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Purchase item
      hash = await marketplace.write.buyItem([1], {
        value: salePrice,
        account: buyer.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Check transaction history
      const transactions = await marketplace.read.getItemTransactions([1]);
      assert.equal(transactions[0].length, 2); // registration + purchase
      assert.equal(transactions[2][1], salePrice); // Purchase price should match salePrice
      assert.equal(
        transactions[0][1].toLowerCase(),
        buyer.account.address.toLowerCase()
      ); // Purchase transaction owner should be buyer
    });
  });
});