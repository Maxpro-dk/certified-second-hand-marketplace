// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertifiedSecondHandMarketplace {
    uint16 private _itemIdCounter;
    address public owner;

    struct Transaction {
        address owner;
        uint32 datetime;
        uint256 salePrice;
    }

    struct User {
        string name;
        string email;
        string location;
        bool status; // Active or Inactive
    }
    
    struct Item {
        uint16 id;
        string name;
        string numSerie;
        string description;
        string image;
        address owner;
        bool isCertified;
        address certifiedBy;
        bool forSale;
        uint256 price;
        Transaction[] transactions;
        string proofImage; // New field for proof image
    }
    
    mapping(uint16 => Item) public items;
    mapping(address => uint16[]) public userItems;
    mapping(address => bool) public certifiers;
    mapping(address => User) public users;
    
    event ItemRegistered(uint16 id, address owner);
    event userRegistered(address userAddress, string name, string email, string location);
    event ItemCertified(uint16 id, address certifier);
    event ItemSold(uint16 id, address buyer, uint256 price);
    event ItemTransferred(uint16 id, address from, address to);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyItemOwner(uint16 _itemId) {
        require(items[_itemId].owner == msg.sender, "Not owner");
        _;
    }
    
    modifier onlyCertifier() {
        require(certifiers[msg.sender], "Not certifier");
        _;
    }

     modifier onlyRegistered() {
        require(users[msg.sender].status == true, "Not registered");
        _; 
    }
    
    modifier itemExists(uint16 _itemId) {
        require(items[_itemId].owner != address(0), "Item doesn't exist");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        certifiers[msg.sender] = true;
    }

    function registerUser(string memory _name, string memory _email, string memory _location) public  {
        users[msg.sender] = User({
            name: _name,
            email: _email,
            location: _location,
            status: true
        });

        emit userRegistered(msg.sender, _name, _email, _location);
    }

    function getUser(address _userAddress) external view returns (string memory name, string memory email, string memory location, bool status) {
        User storage user = users[_userAddress];
        return (user.name, user.email, user.location, user.status);
    }
    
    // Enregistrer un bien
    function registerItem(
        string memory _name,
        string memory _numSerie,
        string memory _description,
        string memory _image,
        string memory _proofImage
    ) external onlyRegistered {
        _itemIdCounter++;
        
        // Create the item first
        Item storage newItem = items[_itemIdCounter];
        newItem.id = _itemIdCounter;
        newItem.name = _name;
        newItem.numSerie = _numSerie;
        newItem.description = _description;
        newItem.image = _image;
        newItem.proofImage = _proofImage;
        newItem.owner = msg.sender;
        newItem.isCertified = false;
        newItem.certifiedBy = address(0);
        newItem.forSale = false;
        newItem.price = 0;
        
        // Ajouter la transaction initiale
        newItem.transactions.push(Transaction({
            owner: msg.sender,
            datetime: uint32(block.timestamp),
            salePrice: 0
        }));
        
        userItems[msg.sender].push(_itemIdCounter);
        emit ItemRegistered(_itemIdCounter, msg.sender);
    }
    
    // Récupérer tous les biens
    function getAllItems() external view returns (
        uint16[] memory ids,
        string[] memory names,
        string[] memory numSeries,
        string[] memory images,
        string[] memory descriptions,
        address[] memory owners,
        bool[] memory isCertifieds,
        bool[] memory forSales,
        uint256[] memory prices,
        uint256[] memory transactionCounts,
        string[] memory proofImages,
        string[] memory ownerNames
    ) {
        uint16 itemCount = _itemIdCounter;
        
        ids = new uint16[](itemCount);
        names = new string[](itemCount);
        numSeries = new string[](itemCount);
        descriptions = new string[](itemCount);
        images = new string[](itemCount);
        owners = new address[](itemCount);
        isCertifieds = new bool[](itemCount);
        forSales = new bool[](itemCount);
        prices = new uint256[](itemCount);
        transactionCounts = new uint256[](itemCount);
        proofImages = new string[](itemCount);
        ownerNames = new string[](itemCount);
        
        for (uint16 i = 1; i <= itemCount; i++) {
            if (items[i].owner != address(0)) {
                ids[i-1] = items[i].id;
                names[i-1] = items[i].name;
                numSeries[i-1] = items[i].numSerie;
                images[i-1] = items[i].image;
                descriptions[i-1] = items[i].description;
                owners[i-1] = items[i].owner;
                isCertifieds[i-1] = items[i].isCertified;
                forSales[i-1] = items[i].forSale;
                prices[i-1] = items[i].price;
                transactionCounts[i-1] = items[i].transactions.length;
                proofImages[i-1] = items[i].proofImage;
                ownerNames[i-1] = users[items[i].owner].name;
            }
        }
        
        return (ids, names, numSeries,images, descriptions, owners, isCertifieds, forSales, prices, transactionCounts, proofImages, ownerNames);
    }
    
    // Lister tous les biens d'un utilisateur
    function getUserItems() external view returns (uint16[] memory) {
        return userItems[msg.sender];
    }
    
    // Ajouter un certificateur
    function addCertifier(address _certifier) external onlyOwner {
        certifiers[_certifier] = true;
    }
    
    // Certifier un article
    function certifyItem(uint16 _itemId) external onlyCertifier itemExists(_itemId) {
        items[_itemId].isCertified = true;
        items[_itemId].certifiedBy = msg.sender;
        emit ItemCertified(_itemId, msg.sender);
    }
    
    // Vérifier si un article est certifié
    function isItemCertified(uint16 _itemId) external view itemExists(_itemId) returns (bool) {
        return items[_itemId].isCertified;
    }
    
    // Mettre en vente
    function listForSale(uint16 _itemId, uint256 _price) external onlyItemOwner(_itemId) {
        items[_itemId].forSale = true;
        items[_itemId].price = _price;
    }
    
    // Acheter un article
    function buyItem(uint16 _itemId) external payable itemExists(_itemId) {
        Item storage item = items[_itemId];
        require(item.forSale, "Not for sale");
        require(msg.value >= item.price, "Insufficient funds");
        
        address seller = item.owner;
        
        // Transfert de propriété
        item.owner = msg.sender;
        item.forSale = false;
        
        // Ajouter la transaction
        item.transactions.push(Transaction({
            owner: msg.sender,
            datetime: uint32(block.timestamp),
            salePrice: item.price
        }));
        
        // Paiement
        payable(seller).transfer(item.price);
        
        // Mise à jour des listes
        _removeItemFromUser(seller, _itemId);
        userItems[msg.sender].push(_itemId);
        
        emit ItemSold(_itemId, msg.sender, item.price);
    }
    
    // Transfert gratuit
    function transferItem(uint16 _itemId, address _to) external onlyItemOwner(_itemId) {
        items[_itemId].owner = _to;
        items[_itemId].forSale = false;
        
        // Ajouter la transaction
        items[_itemId].transactions.push(Transaction({
            owner: _to,
            datetime: uint32(block.timestamp),
            salePrice: 0
        }));
        
        _removeItemFromUser(msg.sender, _itemId);
        userItems[_to].push(_itemId);
        
        emit ItemTransferred(_itemId, msg.sender, _to);
    }
    
    // Fonction utilitaire pour retirer un item d'un utilisateur
    function _removeItemFromUser(address _user, uint16 _itemId) private {
        uint16[] storage userItemsList = userItems[_user];
        for (uint256 i = 0; i < userItemsList.length; i++) {
            if (userItemsList[i] == _itemId) {
                userItemsList[i] = userItemsList[userItemsList.length - 1];
                userItemsList.pop();
                break;
            }
        }
    }
    
    // Obtenir les détails d'un item
    function getItem(uint16 _itemId) external view itemExists(_itemId) returns (
        uint16 id,
        string memory name,
        string memory numSerie,
        string memory description,
        string memory image,
        address itemOwner, // Changed from 'owner' to 'itemOwner' to avoid shadowing
        bool isCertified,
        bool forSale,
        uint256 price,
        uint256 transactionCount,
        string memory proofImage
    ) {
        Item storage item = items[_itemId];
        return (
            item.id,
            item.name,
            item.numSerie,
            item.description,
            item.image,
            item.owner,
            item.isCertified,
            item.forSale,
            item.price,
            item.transactions.length,
            item.proofImage
        );
    }
    
    // Obtenir l'historique des transactions d'un item
    function getItemTransactions(uint16 _itemId) external view itemExists(_itemId) returns (
        address[] memory owners,
        uint32[] memory datetimes,
        uint256[] memory salePrices
    ) {
        Item storage item = items[_itemId];
        uint256 length = item.transactions.length;
        
        owners = new address[](length);
        datetimes = new uint32[](length);
        salePrices = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            owners[i] = item.transactions[i].owner;
            datetimes[i] = item.transactions[i].datetime;
            salePrices[i] = item.transactions[i].salePrice;
        }
        
        return (owners, datetimes, salePrices);
    }
}