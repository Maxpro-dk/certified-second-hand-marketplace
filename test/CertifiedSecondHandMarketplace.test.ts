import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("CertifiedSecondHandMarketplace - Tests Minimaux", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Déploiement et vérification du owner", async function () {
    const [owner] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    assert.equal(
      (await marketplace.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase()
    );
  });

  it("Enregistrement utilisateur (registerUser, getUser)", async function () {
    const [, user1] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    const hash = await marketplace.write.registerUser([
      "Alice",
      "alice@test.com",
      "Paris"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const user = await marketplace.read.getUser([user1.account.address]);
    assert.equal(user[0], "Alice");
    assert.equal(user[1], "alice@test.com");
    assert.equal(user[2], "Paris");
    assert.equal(user[3], true);
  });

  it("Enregistrement item (registerItem, getAllItems)", async function () {
    const [, user1] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer utilisateur d'abord
    let hash = await marketplace.write.registerUser([
      "Bob",
      "bob@test.com",
      "Lyon"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer item
    hash = await marketplace.write.registerItem([
      "iPhone 12",
      "SN123456",
      "Excellent état",
      "ipfs://image",
      "ipfs://proof"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const items = await marketplace.read.getAllItems();
    assert.equal(items[0].length, 1); // ids
    assert.equal(items[1][0], "iPhone 12"); // name
    assert.equal(items[2][0], "SN123456"); // numSerie
  });

  it("Ajout certificateur (addCertifier)", async function () {
    const [owner, , certifier] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    const hash = await marketplace.write.addCertifier([certifier.account.address], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    assert.equal(await marketplace.read.certifiers([certifier.account.address]), true);
  });

  it("Certification (certifyItem, isItemCertified)", async function () {
    const [owner, user1] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer utilisateur
    let hash = await marketplace.write.registerUser([
      "Charlie",
      "charlie@test.com",
      "Marseille"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer item
    hash = await marketplace.write.registerItem([
      "iPad",
      "SN789",
      "Comme neuf",
      "ipfs://img",
      "ipfs://proof"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Certifier
    hash = await marketplace.write.certifyItem([1], {
      account: owner.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    assert.equal(await marketplace.read.isItemCertified([1]), true);
  });

  it("Mise en vente (listForSale)", async function () {
    const [, user1] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer utilisateur
    let hash = await marketplace.write.registerUser([
      "David",
      "david@test.com",
      "Nice"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer item
    hash = await marketplace.write.registerItem([
      "MacBook",
      "SN999",
      "Bon état",
      "ipfs://mac",
      "ipfs://proof"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Mettre en vente
    const price = parseEther("2.5");
    hash = await marketplace.write.listForSale([1, price], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const item = await marketplace.read.getItem([1]);
    assert.equal(item[7], true); // forSale
    assert.equal(item[8], price); // price
  });

  it("Achat (buyItem)", async function () {
    const [, seller, buyer] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer vendeur
    let hash = await marketplace.write.registerUser([
      "Seller",
      "seller@test.com",
      "Paris"
    ], {
      account: seller.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer item
    hash = await marketplace.write.registerItem([
      "PS5",
      "SNPS5",
      "Neuf",
      "ipfs://ps5",
      "ipfs://proof"
    ], {
      account: seller.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Mettre en vente
    const price = parseEther("1.0");
    hash = await marketplace.write.listForSale([1, price], {
      account: seller.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Acheter
    hash = await marketplace.write.buyItem([1], {
      value: price,
      account: buyer.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const item = await marketplace.read.getItem([1]);
    assert.equal(
      item[5].toLowerCase(),
      buyer.account.address.toLowerCase()
    );
    assert.equal(item[7], false); // forSale devient false
  });

  it("Liste des items utilisateur (getUserItems)", async function () {
    const [, user1] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer utilisateur
    let hash = await marketplace.write.registerUser([
      "Emma",
      "emma@test.com",
      "Bordeaux"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer 2 items
    hash = await marketplace.write.registerItem([
      "Item 1",
      "SN001",
      "Description 1",
      "ipfs://1",
      "ipfs://proof1"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    hash = await marketplace.write.registerItem([
      "Item 2",
      "SN002",
      "Description 2",
      "ipfs://2",
      "ipfs://proof2"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const userItems = await marketplace.read.getUserItems({
      account: user1.account,
    });
    assert.equal(userItems.length, 2);
    assert.equal(userItems[0], 1);
    assert.equal(userItems[1], 2);
  });

  it("Transfert (transferItem)", async function () {
    const [, user1, user2] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer utilisateur
    let hash = await marketplace.write.registerUser([
      "Frank",
      "frank@test.com",
      "Toulouse"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer item
    hash = await marketplace.write.registerItem([
      "Switch",
      "SNSW",
      "Très bon état",
      "ipfs://switch",
      "ipfs://proof"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Transférer
    hash = await marketplace.write.transferItem([1, user2.account.address], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const item = await marketplace.read.getItem([1]);
    assert.equal(
      item[5].toLowerCase(),
      user2.account.address.toLowerCase()
    );

    const user1Items = await marketplace.read.getUserItems({
      account: user1.account,
    });
    const user2Items = await marketplace.read.getUserItems({
      account: user2.account,
    });
    assert.equal(user1Items.length, 0);
    assert.equal(user2Items.length, 1);
  });

  it("Historique transactions (getItemTransactions)", async function () {
    const [, user1, user2] = await viem.getWalletClients();
    const marketplace = await viem.deployContract("CertifiedSecondHandMarketplace", []);

    // Enregistrer utilisateur
    let hash = await marketplace.write.registerUser([
      "Grace",
      "grace@test.com",
      "Nantes"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Enregistrer item
    hash = await marketplace.write.registerItem([
      "Xbox",
      "SNXBOX",
      "Occasion",
      "ipfs://xbox",
      "ipfs://proof"
    ], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Mettre en vente et acheter
    const price = parseEther("0.5");
    hash = await marketplace.write.listForSale([1, price], {
      account: user1.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    hash = await marketplace.write.buyItem([1], {
      value: price,
      account: user2.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Vérifier transactions
    const transactions = await marketplace.read.getItemTransactions([1]);
    assert.equal(transactions[0].length, 2); // registration + achat
    assert.equal(
      transactions[0][0].toLowerCase(),
      user1.account.address.toLowerCase()
    ); // Premier owner
    assert.equal(
      transactions[0][1].toLowerCase(),
      user2.account.address.toLowerCase()
    ); // Deuxième owner
    assert.equal(transactions[2][0], 0n); // Premier prix = 0 (registration)
    assert.equal(transactions[2][1], price); // Deuxième prix = prix d'achat
  });
});