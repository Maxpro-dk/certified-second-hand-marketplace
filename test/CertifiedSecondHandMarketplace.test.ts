import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther } from "viem";

describe("CertifiedSecondHandMarketplace", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  describe("Deployment", function () {
    it("Should set the right owner and platform wallet", async function () {
      const [owner, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      assert.equal(
        (await marketplace.read.contractOwner()).toLowerCase(),
        owner.account.address.toLowerCase()
      );
      assert.equal(
        (await marketplace.read.platformWallet()).toLowerCase(),
        platformWallet.account.address.toLowerCase()
      );
    });

    it("Should initialize with zero items", async function () {
      const [owner, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      assert.equal(await marketplace.read.getTotalItemsCount(), 0n);
      assert.equal(await marketplace.read.getActiveItemsCount(), 0n);
      assert.equal(await marketplace.read.getAvailableItemsCount(), 0n);
      assert.equal(await marketplace.read.getCertifiedItemsCount(), 0n);
    });

    it("Should set deployer and platform wallet as certifiers", async function () {
      const [owner, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      assert.equal(await marketplace.read.certifiers([owner.account.address]), true);
      assert.equal(await marketplace.read.certifiers([platformWallet.account.address]), true);
    });
  });

  describe("User Registration", function () {
    it("Should allow users to register", async function () {
      const [, , user1] = await viem.getWalletClients();
      const [, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      const hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      assert.equal(await marketplace.read.registeredUsers([user1.account.address]), true);
    });

    it("Should prevent duplicate registration", async function () {
      const [, , user1] = await viem.getWalletClients();
      const [, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      await assert.rejects(async () => {
        await marketplace.write.registerUser({
          account: user1.account,
        });
      }, /Already registered/);
    });
  });

  describe("Item Registration", function () {
    it("Should allow registered users to register items", async function () {
      const [, , user1] = await viem.getWalletClients();
      const [, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user first
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register item
      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item description",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      assert.equal(await marketplace.read.getTotalItemsCount(), 1n);
      assert.equal(await marketplace.read.getActiveItemsCount(), 1n);
      
      const item = await marketplace.read.items([1n]);
      assert.equal(item[1], "Test Item"); // name
      assert.equal(item[2], parseEther("1.0")); // value
      assert.equal(item[4], "SN123456"); // serialNumber
      assert.equal(
        item[5].toLowerCase(), // originalOwner
        user1.account.address.toLowerCase()
      );
    });

    it("Should prevent duplicate serial numbers", async function () {
      const [, , user1] = await viem.getWalletClients();
      const [, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user first
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register first item
      hash = await marketplace.write.registerItem([
        "Test Item 1",
        parseEther("1.0"),
        "First test item",
        "SN123456",
        "ipfs://test-image-1"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to register second item with same serial number
      await assert.rejects(async () => {
        await marketplace.write.registerItem([
          "Test Item 2",
          parseEther("2.0"),
          "Second test item",
          "SN123456", // Same serial number
          "ipfs://test-image-2"
        ], {
          account: user1.account,
        });
      }, /Serial number exists/);
    });

    it("Should prevent unregistered users from registering items", async function () {
      const [, , user1] = await viem.getWalletClients();
      const [, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Try to register item without registering user first
      await assert.rejects(async () => {
        await marketplace.write.registerItem([
          "Test Item",
          parseEther("1.0"),
          "A test item",
          "SN123456",
          "ipfs://test-image"
        ], {
          account: user1.account,
        });
      }, /User not registered/);
    });
  });

  describe("Item Certification", function () {
    it("Should allow certifiers to certify items", async function () {
      const [owner, platformWallet, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user and item
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Certify item (owner is a certifier by default)
      hash = await marketplace.write.certifyItem([1n], {
        account: owner.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.items([1n]);
      assert.equal(item[9], true); // isCertified
      assert.equal(
        item[10].toLowerCase(), // certifiedBy
        owner.account.address.toLowerCase()
      );
    });

    it("Should prevent non-certifiers from certifying items", async function () {
      const [, platformWallet, user1, nonCertifier] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user and item
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register non-certifier user
      hash = await marketplace.write.registerUser({
        account: nonCertifier.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to certify item as non-certifier
      await assert.rejects(async () => {
        await marketplace.write.certifyItem([1n], {
          account: nonCertifier.account,
        });
      }, /Not authorized certifier/);
    });
  });

  describe("Item Listing and Sales", function () {
    it("Should allow owners to list items for sale", async function () {
      const [, platformWallet, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user and item
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // List item for sale
      const salePrice = parseEther("1.5");
      hash = await marketplace.write.listItemForSale([1n, salePrice], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const item = await marketplace.read.items([1n]);
      assert.equal(item[7], true); // isForSale
      assert.equal(item[8], salePrice); // salePrice
    });

    it("Should prevent non-owners from listing items", async function () {
      const [, platformWallet, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register users
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerUser({
        account: user2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register item with user1
      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to list item with user2 (not owner)
      await assert.rejects(async () => {
        await marketplace.write.listItemForSale([1n, parseEther("1.5")], {
          account: user2.account,
        });
      }, /Not the owner/);
    });

    it("Should allow purchasing items with platform fee", async function () {
      const [, platformWallet, seller, buyer] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register users
      let hash = await marketplace.write.registerUser({
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerUser({
        account: buyer.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register and list item
      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const salePrice = parseEther("1.5");
      hash = await marketplace.write.listItemForSale([1n, salePrice], {
        account: seller.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Get initial balances
      const sellerBalanceBefore = await publicClient.getBalance({
        address: seller.account.address,
      });
      const platformBalanceBefore = await publicClient.getBalance({
        address: platformWallet.account.address,
      });

      // Purchase item
      hash = await marketplace.write.purchaseItem([1n], {
        value: salePrice,
        account: buyer.account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Check balances after purchase
      const sellerBalanceAfter = await publicClient.getBalance({
        address: seller.account.address,
      });
      const platformBalanceAfter = await publicClient.getBalance({
        address: platformWallet.account.address,
      });

      // Calculate expected amounts
      const platformFeeAmount = (salePrice * 250n) / 10000n; // 2.5% fee
      const sellerAmount = salePrice - platformFeeAmount;

      // Check item ownership transfer
      assert.equal(
        (await marketplace.read.ownerOf([1n])).toLowerCase(),
        buyer.account.address.toLowerCase()
      );
      
      // Check item is no longer for sale
      const item = await marketplace.read.items([1n]);
      assert.equal(item[7], false); // isForSale

      // Check balances (approximate due to gas costs)
      const sellerExpected = sellerBalanceBefore + sellerAmount;
      const platformExpected = platformBalanceBefore + platformFeeAmount;
      
      // Allow for small difference due to gas costs
      assert.ok(sellerBalanceAfter >= sellerExpected - parseEther("0.01") && sellerBalanceAfter <= sellerExpected);
      assert.equal(platformBalanceAfter, platformExpected);
    });

    it("Should prevent self-purchase", async function () {
      const [, platformWallet, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user and item
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // List item for sale
      const salePrice = parseEther("1.5");
      hash = await marketplace.write.listItemForSale([1n, salePrice], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to purchase own item
      await assert.rejects(async () => {
        await marketplace.write.purchaseItem([1n], {
          value: salePrice,
          account: user1.account,
        });
      }, /Cannot buy own item/);
    });
  });

  describe("Item Transfers", function () {
    it("Should allow owners to transfer items to registered users", async function () {
      const [, platformWallet, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register users
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerUser({
        account: user2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register item
      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Transfer item
      hash = await marketplace.write.transferItem([user2.account.address, 1n], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      assert.equal(
        (await marketplace.read.ownerOf([1n])).toLowerCase(),
        user2.account.address.toLowerCase()
      );
    });

    it("Should prevent transfers to unregistered users", async function () {
      const [, platformWallet, user1, unregisteredUser] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user1 only
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register item
      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Try to transfer to unregistered user
      await assert.rejects(async () => {
        await marketplace.write.transferItem([unregisteredUser.account.address, 1n], {
          account: user1.account,
        });
      }, /Recipient not registered/);
    });
  });

  describe("View Functions", function () {
    it("Should return correct item verification details", async function () {
      const [, platformWallet, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user and item
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify item
      const verification = await marketplace.read.verifyItemBySerialNumber(["SN123456"]);
      assert.equal(verification[0], true); // exists
      assert.equal(verification[1], 1n); // tokenId
      assert.equal(
        verification[2].toLowerCase(), // owner
        user1.account.address.toLowerCase()
      );
      assert.equal(verification[3], false); // isCertified
    });

    it("Should return user items correctly", async function () {
      const [, platformWallet, user1] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register user
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register multiple items
      for (let i = 0; i < 3; i++) {
        hash = await marketplace.write.registerItem([
          `Test Item ${i}`,
          parseEther("1.0"),
          `A test item ${i}`,
          `SN12345${i}`,
          `ipfs://test-image-${i}`
        ], {
          account: user1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const userItems = await marketplace.read.getUserItems([user1.account.address]);
      assert.equal(userItems.length, 3);
      assert.equal(await marketplace.read.getUserItemsCount({
        account: user1.account,
      }), 3n);
    });

    it("Should return available items correctly", async function () {
      const [, platformWallet, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register users
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerUser({
        account: user2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register items - some for sale, some not
      const itemsToCreate = [
        { name: "Item 1", forSale: true, price: parseEther("1.0") },
        { name: "Item 2", forSale: false, price: 0n },
        { name: "Item 3", forSale: true, price: parseEther("2.0") },
        { name: "Item 4", forSale: true, price: parseEther("3.0") },
      ];

      for (let i = 0; i < itemsToCreate.length; i++) {
        hash = await marketplace.write.registerItem([
          itemsToCreate[i].name,
          parseEther("1.0"),
          `Description ${i}`,
          `SN${i}`,
          `ipfs://image-${i}`
        ], {
          account: user1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash });

        if (itemsToCreate[i].forSale) {
          hash = await marketplace.write.listItemForSale([BigInt(i + 1), itemsToCreate[i].price], {
            account: user1.account,
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      const availableItems = await marketplace.read.getAvailableItems();
      assert.equal(availableItems.length, 3);
      assert.equal(await marketplace.read.getAvailableItemsCount(), 3n);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle item history correctly", async function () {
      const [, platformWallet, user1, user2] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Register users
      let hash = await marketplace.write.registerUser({
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await marketplace.write.registerUser({
        account: user2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Register item
      hash = await marketplace.write.registerItem([
        "Test Item",
        parseEther("1.0"),
        "A test item",
        "SN123456",
        "ipfs://test-image"
      ], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Transfer item
      hash = await marketplace.write.transferItem([user2.account.address, 1n], {
        account: user1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Get item history
      const history = await marketplace.read.getItemHistory([1n]);
      assert.equal(history.length, 2);
      assert.equal(history[0].transactionType, "Registration");
      assert.equal(history[1].transactionType, "Transfer");
    });

    it("Should handle non-existent items correctly", async function () {
      const [, platformWallet] = await viem.getWalletClients();
      const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", [platformWallet.account.address]);

      // Verify non-existent serial number
      const verification = await marketplace.read.verifyItemBySerialNumber(["NONEXISTENT"]);
      assert.equal(verification[0], false); // exists

      // Try to access non-existent item - this should not throw an error but return empty/default values
      // The contract doesn't seem to have a require statement for item existence in the items mapping
      // So we'll just check that it doesn't throw and returns some values
      const item = await marketplace.read.items([999n]);
      assert.ok(item !== undefined);
    });
  });
});