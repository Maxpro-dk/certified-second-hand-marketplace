// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CertifiedSecondHandMarketplace
 * @dev Contrat pour une marketplace de biens d'occasion certifiés avec traçabilité blockchain
 * @notice Permet l'enregistrement, la certification, la vente et le transfert de biens d'occasion
 */
contract CertifiedSecondHandMarketplace {
    // Compteur pour générer des ID uniques pour les items
    uint256 private _tokenIdCounter;
    
    // Propriétaire du contrat (déployeur)
    address public contractOwner;
    
    /**
     * @dev Structure représentant un bien d'occasion
     * @param tokenId Identifiant unique du bien
     * @param name Nom du produit
     * @param value Valeur estimée du bien
     * @param description Description détaillée du bien
     * @param serialNumber Numéro de série unique
     * @param owner Propriétaire actuel du bien
     * @param imageURI Lien vers l'image du bien (IPFS ou autre)
     * @param isForSale Indique si le bien est en vente
     * @param salePrice Prix de vente si le bien est en vente
     * @param isCertified Indique si le bien est certifié
     * @param certifiedBy Adresse de l'entité qui a certifié le bien
     */
    struct Item {
        uint256 tokenId;
        string name;
        uint256 value;
        string description;
        string serialNumber;
        address owner;
        string imageURI;
        bool isForSale;
        uint256 salePrice;
        bool isCertified;
        address certifiedBy;
    }
    
    /**
     * @dev Structure représentant une transaction
     * @param previousOwner Ancien propriétaire
     * @param newOwner Nouveau propriétaire
     * @param transferDate Date de la transaction (timestamp)
     * @param transactionType Type de transaction ("Registration", "Sale", "Transfer")
     * @param price Prix de la transaction (0 pour les transferts gratuits)
     */
    struct Transaction {
        address previousOwner;
        address newOwner;
        uint256 transferDate;
        string transactionType;
        uint256 price;
    }
    
    // Mapping des items par leur ID
    mapping(uint256 => Item) public items;
    
    // Mapping des numéros de série vers les IDs de tokens
    mapping(string => uint256) public serialNumberToTokenId;
    
    // Historique des transactions par item
    mapping(uint256 => Transaction[]) public itemTransactions;
    
    // Utilisateurs enregistrés sur la plateforme
    mapping(address => bool) public registeredUsers;
    
    // Items détenus par chaque utilisateur
    mapping(address => uint256[]) public userItems;
    
    // Entités autorisées à certifier les biens
    mapping(address => bool) public certifiers;
    
    // Propriétaires des tokens
    mapping(uint256 => address) public tokenOwner;
    
    // Frais de plateforme en basis points (100 = 1%)
    uint256 public platformFee = 250; // 2.5%
    
    // Portefeuille pour recevoir les frais de plateforme
    address public platformWallet;
    
    // Événements
    event UserRegistered(address user);
    event ItemRegistered(uint256 tokenId, string serialNumber, address owner);
    event ItemTransferred(uint256 tokenId, address from, address to);
    event ItemForSale(uint256 tokenId, uint256 price);
    event ItemSold(uint256 tokenId, address buyer, uint256 price);
    event ItemCertified(uint256 tokenId, address certifier);

    // Modificateurs

    /**
     * @dev Vérifie que l'utilisateur est enregistré
     */
    modifier onlyRegisteredUser() {
        require(registeredUsers[msg.sender], "User not registered");
        _;
    }
    
    /**
     * @dev Vérifie que l'utilisateur est propriétaire de l'item
     * @param _tokenId ID de l'item à vérifier
     */
    modifier onlyItemOwner(uint256 _tokenId) {
        require(tokenOwner[_tokenId] == msg.sender, "Not the owner");
        _;
    }
    
    /**
     * @dev Vérifie que l'utilisateur est un certifier autorisé
     */
    modifier onlyCertifier() {
        require(certifiers[msg.sender], "Not authorized certifier");
        _;
    }
    
    /**
     * @dev Vérifie que l'utilisateur est le propriétaire du contrat
     */
    modifier onlyOwner() {
        require(msg.sender == contractOwner, "Not contract owner");
        _;
    }
    
    /**
     * @dev Vérifie que l'item existe
     * @param _tokenId ID de l'item à vérifier
     */
    modifier itemExists(uint256 _tokenId) {
        require(tokenOwner[_tokenId] != address(0), "Item does not exist");
        _;
    }
    
    /**
     * @dev Constructeur du contrat
     */
    constructor() {
        contractOwner = msg.sender;
        platformWallet = msg.sender;
        // Le déployeur et le portefeuille de frais sont automatiquement certifiers
        certifiers[msg.sender] = true;
        certifiers[platformWallet] = true;
    }
    
    /**
     * @dev Enregistre un nouvel utilisateur sur la plateforme
     * @notice Les utilisateurs doivent s'enregistrer avant de pouvoir utiliser la plateforme
     */
    function registerUser() external {
        require(!registeredUsers[msg.sender], "Already registered");
        registeredUsers[msg.sender] = true;
        emit UserRegistered(msg.sender);
    }
    
    /**
     * @dev Ajoute un nouveau certifier autorisé
     * @param _certifier Adresse du nouveau certifier
     * @notice Seul le propriétaire du contrat peut ajouter des certifiers
     */
    function addCertifier(address _certifier) external onlyOwner {
        certifiers[_certifier] = true;
    }
    
    /**
     * @dev Enregistre un nouveau bien sur la plateforme
     * @param _name Nom du produit
     * @param _value Valeur estimée
     * @param _description Description détaillée
     * @param _serialNumber Numéro de série unique
     * @param _imageURI Lien vers l'image du produit
     * @notice Le numéro de série doit être unique
     */
    function registerItem(
        string memory _name,
        uint256 _value,
        string memory _description,
        string memory _serialNumber,
        string memory _imageURI
    ) external onlyRegisteredUser {
        require(serialNumberToTokenId[_serialNumber] == 0, "Serial number exists");
        
        // Incrémente le compteur et génère un nouvel ID
        _tokenIdCounter++;
        uint256 _tokenId = _tokenIdCounter;
        
        // Définit le propriétaire initial
        tokenOwner[_tokenId] = msg.sender;
        
        // Crée le nouvel item
        items[_tokenId] = Item({
            tokenId: _tokenId,
            name: _name,
            value: _value,
            description: _description,
            serialNumber: _serialNumber,
            owner: msg.sender,
            imageURI: _imageURI,
            isForSale: false,
            salePrice: 0,
            isCertified: false,
            certifiedBy: address(0)
        });
        
        // Enregistre le mapping numéro de série → ID
        serialNumberToTokenId[_serialNumber] = _tokenId;
        
        // Ajoute l'item à la liste de l'utilisateur
        userItems[msg.sender].push(_tokenId);
        
        // Enregistre la transaction initiale
        itemTransactions[_tokenId].push(Transaction({
            previousOwner: address(0),
            newOwner: msg.sender,
            transferDate: block.timestamp,
            transactionType: "Registration",
            price: 0
        }));
        
        emit ItemRegistered(_tokenId, _serialNumber, msg.sender);
    }
    
    /**
     * @dev Certifie un bien
     * @param _tokenId ID du bien à certifier
     * @notice Seuls les certifiers autorisés peuvent certifier des biens
     */
    function certifyItem(uint256 _tokenId) external onlyCertifier itemExists(_tokenId) {
        Item storage item = items[_tokenId];
        item.isCertified = true;
        item.certifiedBy = msg.sender;
        emit ItemCertified(_tokenId, msg.sender);
    }
    
    /**
     * @dev Met un bien en vente
     * @param _tokenId ID du bien à mettre en vente
     * @param _salePrice Prix de vente
     * @notice Seul le propriétaire peut mettre son bien en vente
     */
    function listItemForSale(uint256 _tokenId, uint256 _salePrice) external onlyItemOwner(_tokenId) {
        items[_tokenId].isForSale = true;
        items[_tokenId].salePrice = _salePrice;
        emit ItemForSale(_tokenId, _salePrice);
    }
    
    /**
     * @dev Achète un bien en vente
     * @param _tokenId ID du bien à acheter
     * @notice Le prix payé doit couvrir le prix de vente
     */
    function purchaseItem(uint256 _tokenId) external payable onlyRegisteredUser itemExists(_tokenId) {
        Item storage item = items[_tokenId];
        require(item.isForSale, "Not for sale");
        require(msg.value >= item.salePrice, "Insufficient funds");
        require(tokenOwner[_tokenId] != msg.sender, "Cannot buy own item");
        
        address seller = tokenOwner[_tokenId];
        uint256 salePrice = item.salePrice;
        
        // Calcul des frais de plateforme et du montant pour le vendeur
        uint256 platformFeeAmount = (salePrice * platformFee) / 10000;
        uint256 sellerAmount = salePrice - platformFeeAmount;
        
        // Transfert de propriété
        tokenOwner[_tokenId] = msg.sender;
        
        // Transfert des fonds
        payable(seller).transfer(sellerAmount);
        payable(platformWallet).transfer(platformFeeAmount);
        
        // Remboursement de l'excédent
        if (msg.value > salePrice) {
            payable(msg.sender).transfer(msg.value - salePrice);
        }
        
        // Mise à jour du statut de vente
        item.isForSale = false;


        
        // Enregistrement de la transaction
        itemTransactions[_tokenId].push(Transaction({
            previousOwner: seller,
            newOwner: msg.sender,
            transferDate: block.timestamp,
            transactionType: "Sale",
            price: salePrice
        }));

         // Retirer l'item de la liste de l'ancien propriétaire
        uint256[] storage previousOwnerItems = userItems[seller];
        for (uint256 i = 0; i < previousOwnerItems.length; i++) {
            if (previousOwnerItems[i] == _tokenId) {
                // Déplacer le dernier élément à la place de celui à supprimer
                previousOwnerItems[i] = previousOwnerItems[previousOwnerItems.length - 1];
                // Supprimer le dernier élément
                previousOwnerItems.pop();
                break;
            }
        }
        
        // Ajout à la liste des items de l'acheteur
        userItems[msg.sender].push(_tokenId);
        
        emit ItemSold(_tokenId, msg.sender, salePrice);
        emit ItemTransferred(_tokenId, seller, msg.sender);
    }
    
    /**
     * @dev Transfert gratuit d'un bien (don)
     * @param _to Adresse du destinataire
     * @param _tokenId ID du bien à transférer
     * @notice Le destinataire doit être un utilisateur enregistré
     */
    function transferItem(address _to, uint256 _tokenId) external onlyItemOwner(_tokenId) {
        require(registeredUsers[_to], "Recipient not registered");
        
        address previousOwner = tokenOwner[_tokenId];
        tokenOwner[_tokenId] = _to;
        
        // Si l'item était en vente, annulation de la vente
        if (items[_tokenId].isForSale) {
            items[_tokenId].isForSale = false;
        }
        
        // Retirer l'item de la liste de l'ancien propriétaire
        uint256[] storage previousOwnerItems = userItems[previousOwner];
        for (uint256 i = 0; i < previousOwnerItems.length; i++) {
            if (previousOwnerItems[i] == _tokenId) {
                // Déplacer le dernier élément à la place de celui à supprimer
                previousOwnerItems[i] = previousOwnerItems[previousOwnerItems.length - 1];
                // Supprimer le dernier élément
                previousOwnerItems.pop();
                break;
            }
        }
        
        // Ajout à la liste du destinataire
        userItems[_to].push(_tokenId);
        
        // Enregistrement de la transaction
        itemTransactions[_tokenId].push(Transaction({
            previousOwner: previousOwner,
            newOwner: _to,
            transferDate: block.timestamp,
            transactionType: "Transfer",
            price: 0
        }));
        
        emit ItemTransferred(_tokenId, previousOwner, _to);
    }
    
    /**
     * @dev Vérifie l'authenticité d'un bien par son numéro de série
     * @param _serialNumber Numéro de série à vérifier
     * @return exists Si le bien existe
     * @return tokenId ID du bien
     * @return owner Propriétaire actuel
     * @return isCertified Si le bien est certifié
     */
    function verifyItemBySerialNumber(string memory _serialNumber) external view returns (
        bool exists,
        uint256 tokenId,
        address owner,
        bool isCertified
    ) {
        tokenId = serialNumberToTokenId[_serialNumber];
        if (tokenId == 0 || tokenOwner[tokenId] == address(0)) {
            return (false, 0, address(0), false);
        }
        
        return (true, tokenId, tokenOwner[tokenId], items[tokenId].isCertified);
    }
    
    /**
     * @dev Récupère l'historique des transactions d'un bien
     * @param _tokenId ID du bien
     * @return Tableau des transactions
     */
    function getItemHistory(uint256 _tokenId) external view itemExists(_tokenId) returns (Transaction[] memory) {
        return itemTransactions[_tokenId];
    }
    
    /**
     * @dev Récupère les items d'un utilisateur
     * @param _user Adresse de l'utilisateur
     * @return Tableau des IDs d'items
     */
    function getUserItems(address _user) external view returns (uint256[] memory) {
        return userItems[_user];
    }
    
    /**
     * @dev Récupère le nombre total de biens pour un utilisateur
     * @return nombre Total de biens possédés par l'utilisateur
     */
    function getUserItemsCount() external view returns (uint256) {
        return userItems[msg.sender].length;
    }
    
    /**
     * @dev Récupère le nombre total de biens enregistrés sur la plateforme
     * @return nombre Total de biens existants
     * @notice Inclut tous les biens, qu'ils soient en vente ou non
     */
    function getTotalItemsCount() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev Récupère le nombre total de biens actifs (non supprimés/détruits)
     * @return nombre Total de biens actuellement existants
     * @notice Un bien est considéré comme actif s'il a un propriétaire
     */
    function getActiveItemsCount() external view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (tokenOwner[i] != address(0)) {
                activeCount++;
            }
        }
        return activeCount;
    }
    
    /**
     * @dev Récupère tous les biens disponibles à la vente
     * @return Tableau des IDs d'items en vente
     */
    function getAvailableItems() external view returns (uint256[] memory) {
        uint256 availableCount = 0;
        
        // Compte les items disponibles
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (tokenOwner[i] != address(0) && items[i].isForSale) {
                availableCount++;
            }
        }
        
        uint256[] memory availableItems = new uint256[](availableCount);
        uint256 currentIndex = 0;
        
        // Remplit le tableau avec les items disponibles
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (tokenOwner[i] != address(0) && items[i].isForSale) {
                availableItems[currentIndex] = i;
                currentIndex++;
            }
        }
        
        return availableItems;
    }
    
    /**
     * @dev Récupère le nombre de biens disponibles à la vente
     * @return nombre Total de biens actuellement en vente
     */
    function getAvailableItemsCount() external view returns (uint256) {
        uint256 availableCount = 0;
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (tokenOwner[i] != address(0) && items[i].isForSale) {
                availableCount++;
            }
        }
        return availableCount;
    }
    
    /**
     * @dev Récupère le nombre de biens certifiés
     * @return nombre Total de biens certifiés sur la plateforme
     */
    function getCertifiedItemsCount() external view returns (uint256) {
        uint256 certifiedCount = 0;
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (tokenOwner[i] != address(0) && items[i].isCertified) {
                certifiedCount++;
            }
        }
        return certifiedCount;
    }
    
    /**
     * @dev Récupère le propriétaire d'un bien
     * @param _tokenId ID du bien
     * @return Adresse du propriétaire
     */
    function ownerOf(uint256 _tokenId) public view returns (address) {
        return tokenOwner[_tokenId];
    }
}