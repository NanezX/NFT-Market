// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/InterfaceToken20.sol";
import "hardhat/console.sol";
// --------- VERSION 2 --------- 
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

/// @title A market of ERC-1155 tokens
/// @author Hernandez, Victor
/// @notice This contract can be useful to sell and buy custom ERC-1155 tokens 
/// @dev There are a few things that need to be done outside, like approving the management of the token.
contract MarketV2 is OwnableUpgradeable{
    struct Offer {
        address tokenAddress;
        uint96 priceUSD;
        uint tokenId;
        uint amount;
        uint deadline;
        address creator;
        STATE state;
    }
    struct PaymentMethod {
        AggregatorV3Interface agregator;
        address token;
    }
    enum STATE{ CANCELLED, ACTIVE, SOLD, PENDING}
    mapping(uint => Offer) offers;
    mapping(uint => PaymentMethod) paymentMethods;
    uint fee;
    uint quantityOffers;
    address payable recipient;
    event OfferCreated (
        uint indexed id, 
        address indexed creator,
        address tokenAddress, 
        uint tokenId,
        uint time,
        uint8 tokenType
    );
    event OfferSold (
        uint indexed id,
        address indexed buyer,
        address tokenAddress, 
        uint tokenId,
        uint time
    );
    event OfferCancelled (
        uint indexed id,
        address indexed creator,
        address tokenAddress, 
        uint tokenId,
        uint time
    );
    // --------- VERSION 2 --------- 
    // To save the type the token (ERC721 or ERC1155) in a KEY(ID) offer
    mapping(uint => uint8) offerType; 
    uint quantityPaymentMethods;
    event NewPaymentMethod (
        uint id,
        address aggregator,
        address token
    );

    modifier checkOffer(uint id){
        require(offers[id].state == STATE.ACTIVE, "The offer is not available");
        if(offers[id].deadline <= block.timestamp) {
            offers[id].state = STATE.CANCELLED;
            require(false, "The offer has expired");
        }
        require(
            offers[id].creator != msg.sender, 
            "The creator of the offer cannot buy their own offer"
        );
        _;
    }
    
    modifier onlyCreator(uint offerId){
        require(
            msg.sender == offers[offerId].creator, 
            "Not the offer creator"
        );
        _;
    }

    modifier checkPaymentMethod(uint8 payMethod){
        // quantityPaymentMethods
        require((payMethod >= 0) && (payMethod < quantityPaymentMethods + 3));
        _;
    }

    /// @notice Set the new fee that will be transfer to recipient for every sell.
    /// @dev The fee must be set with a bases point (bip) within 0 and 10000
    /// @param _fee The new fee to every transaction
    function setFee(uint _fee) external onlyOwner{
        require(_fee>=0 && _fee<=10000);
        fee = _fee;
    }

    /// @notice Set a new recipient that will receive the fee for every sell
    /// @param _recipient The recipient address
    function setRecipient(address payable _recipient) external onlyOwner{
        recipient = _recipient;
    }

    /// @notice Create an offer in the market
    /// @dev The creator must be call activateOffer function
    /// @param tokenAddress The address of the token being offered
    /// @param tokenId The id of the token being offered
    /// @param amount The amount of token that is offered.
    /// @param deadline How long the offer will last
    /// @param priceUSD The price in USD that is necesary to buy the amount of tokens
    /// @param tokenType The protocol of the token in the offer.
    function createOffer(
        address tokenAddress, 
        uint tokenId, 
        uint amount, 
        uint deadline, 
        uint96 priceUSD,
        uint8 tokenType
        ) 
        external 
        {
        // 0 == ERC721 and 1 == ERC1155
        require(tokenType==0 || tokenType==1, "Invalid token protocol to offer");
        if(tokenType==0){
            _createOffer721(tokenAddress, tokenId, deadline, priceUSD);
        }else{
            _createOffer1155(tokenAddress, tokenId, amount, deadline, priceUSD);
        }

        offerType[quantityOffers] = tokenType;
        emit OfferCreated(
            quantityOffers,
            msg.sender,
            tokenAddress, 
            tokenId,
            block.timestamp,
            tokenType
        );
        quantityOffers++;
    }

    function _createOffer721(
        address _tokenAddress, 
        uint _tokenId, 
        uint _deadline, 
        uint96 _priceUSD
        ) 
        internal
        {
        require(msg.sender == (IERC721Upgradeable(_tokenAddress)).ownerOf(_tokenId));
        offers[quantityOffers] = Offer(
            _tokenAddress, 
            _priceUSD, 
            _tokenId, 
            1, 
            _deadline + block.timestamp, 
            msg.sender,
            STATE.PENDING
        );
    }

    function _createOffer1155(
        address _tokenAddress, 
        uint _tokenId, 
        uint _amount, 
        uint _deadline, 
        uint96 _priceUSD
        ) 
        internal
        {
        // IERC1155Upgradeable token = IERC1155Upgradeable(_tokenAddress);
        require(
             (IERC1155Upgradeable(_tokenAddress)).balanceOf(msg.sender, _tokenId) >= _amount, 
            "Do not have enough tokens"
        );

        offers[quantityOffers] = Offer(
            _tokenAddress, 
            _priceUSD, 
            _tokenId, 
            _amount, 
            _deadline + block.timestamp, 
            msg.sender,
            STATE.PENDING
        );
    }

    function addPaymentMethod(address aggregatorAddress, address tokenAdress) external onlyOwner{
        require(
            aggregatorAddress != address(0) && tokenAdress != address(0),
            "Invalid address"
        );
        paymentMethods[quantityPaymentMethods + 3] = PaymentMethod(
            AggregatorV3Interface(aggregatorAddress),
            tokenAdress
        );
        emit NewPaymentMethod(
            quantityPaymentMethods+3, 
            aggregatorAddress, 
            tokenAdress
        );
        quantityPaymentMethods++;
    }

    /// @notice Activate an offer to make it available to buy
    /// @dev The msg.sender must be the same of the token owner
    /// @param offerId The offer identifier 
    function activateOffer(uint offerId) external onlyCreator(offerId){
        Offer memory actualOffer = offers[offerId];
        require(
            STATE.PENDING==actualOffer.state,
            "The offer is not pending"
        );
        if(offerType[offerId]==0){
            require(
                address(this) == (IERC721Upgradeable(actualOffer.tokenAddress)).getApproved(actualOffer.tokenId),
                "The market is not approved"
            );
        }else{
            require(
                (IERC1155Upgradeable(actualOffer.tokenAddress)).isApprovedForAll(msg.sender, address(this)),
                "The market is not approved"
            );
        }
        offers[offerId].state=STATE.ACTIVE;
    }
    
    function cancelOffer(uint offerId) external onlyCreator(offerId){
        require(
            offers[offerId].state== STATE.PENDING|| offers[offerId].state== STATE.ACTIVE,
            "The offer is already canceled or sold"
        );
        offers[offerId].state=STATE.CANCELLED;
        emit OfferCancelled (
            offerId,
            offers[offerId].creator,
            offers[offerId].tokenAddress, 
            offers[offerId].tokenId,
            block.timestamp
        );
    }

    function buyTokenOffer(uint offerId, uint8 _payMethod) 
        external 
        payable 
        checkOffer(offerId)
        checkPaymentMethod(_payMethod)
        {
        if(_payMethod == 0) {
            _buyWithEther(offerId);
        }else {
            _buyWithTokens(_payMethod, offerId);
        }
        offers[offerId].state = STATE.SOLD;
        emit OfferSold(
            offerId,
            msg.sender,
            offers[offerId].tokenAddress, 
            offers[offerId].tokenId,
            block.timestamp
        );
    }

    /// @notice Get the actual fee for every sell
    /// @return Return the fee as uint
    function getFee() external view returns (uint){
        return fee;
    }

    /// @notice Get the acttual recipient for every sell
    /// @return Return the recipient address
    function getRecipient() external view returns (address){
        return recipient;
    }

    /// @notice Get all the properties of an offer
    /// @param _offerId The offer identifier 
    /// @return The token address in offer
    /// @return The price in USD
    /// @return The token id in offer
    /// @return The amount of token in the offer
    /// @return The time that the offer will dissapier
    /// @return The owner of the tokens
    /// @return Actual state of the offer
    function getOffer(uint _offerId) 
        external 
        view 
        returns (address, uint96, uint, uint, uint, address, STATE)
        {
        return (
            offers[_offerId].tokenAddress, 
            offers[_offerId].priceUSD, 
            offers[_offerId].tokenId, 
            offers[_offerId].amount, 
            offers[_offerId].deadline,  
            offers[_offerId].creator,
            offers[_offerId].state
        );
    }

    /// @notice Get the amount to reach the price of the offer with the chosen method
    /// @param offerId The offer identifier 
    /// @param paymentMethod The chosen payment method
    /// @return The amount of ETH of token needed to reach the price in USD
    function getPrice(uint offerId, uint8 paymentMethod) public view returns (uint){
        uint decimals;
        if (paymentMethod==0) {
            decimals=18;
        }else {
            InterfaceToken20 token = InterfaceToken20(paymentMethods[paymentMethod].token);
            decimals=token.decimals();
        }
        (, int price,,,) = paymentMethods[paymentMethod].agregator.latestRoundData();
        require(price > 0);
        uint8 agregatorDecimals = paymentMethods[paymentMethod].agregator.decimals();

        return ((offers[offerId].priceUSD * (10**agregatorDecimals)) *  (10**decimals)) / uint(price);
    }

    // Buy the offer with Ether
    function _buyWithEther(uint _offerId) internal{
        uint amountETH = getPrice(_offerId, 0);
        require(
            msg.value >= amountETH, 
            "Not enough ether sent"
        );
        uint _fee = (amountETH*fee)/10000;
        uint amountToSend = amountETH - _fee;
        Offer memory offer = offers[_offerId];

        _transferOffer(offer, offerType[_offerId]);

        _sendETH(offer.creator, amountToSend);
        _sendETH(recipient, _fee);
        if(msg.value > amountETH){
            _sendETH(msg.sender, address(this).balance);
        }
    }

    // Buy the offer with Tokens
    function _buyWithTokens(uint8 _tokenToPay, uint _offerId) internal {
        uint amountTokens = getPrice(_offerId, _tokenToPay);
        InterfaceToken20 token = InterfaceToken20(paymentMethods[_tokenToPay].token);
        require (
            token.allowance(msg.sender, address(this))>=amountTokens, 
            "Not approved enough tokens to spend"
        );
        uint _fee = (amountTokens*fee)/10000;
        uint amountToSend = amountTokens - _fee;
         Offer memory offer = offers[_offerId];

        _transferOffer(offer, offerType[_offerId]);


        _sendToken(token, msg.sender, offer.creator, amountToSend);
        _sendToken(token, msg.sender, recipient, _fee);
    }

    // Send an _amount. Avoiding repeat code
    function _sendETH(address _to, uint _amount) internal{
        (bool success,) = _to.call{value: _amount}("");
        require(success, "Fail when send ETH");
    }

    // Send an _amount of token. Avoiding repeat code
    function _sendToken(InterfaceToken20 _token, address _from, address _to, uint _amount) internal{
        bool success = _token.transferFrom(_from, _to, _amount);
        require(success, "Fail when transfer tokens");
    }

    // Choose the type of transfer according to the type of protocol
    function _transferOffer(Offer memory _offer, uint8 _typeProtocol) internal{
        if(_typeProtocol == 0){
            _transferToken721(_offer);
        }else{
            _transferToken1155(_offer);
        }
    }

    // Transfer the 721 token of  the offer 
    function _transferToken721(Offer memory _offer) internal{
        IERC721Upgradeable token = IERC721Upgradeable(_offer.tokenAddress);
        token.safeTransferFrom(_offer.creator, msg.sender, _offer.tokenId);
    }


    // Transfer the 1155 token of  the offer 
    function _transferToken1155(Offer memory _offer) internal{
        IERC1155Upgradeable token = IERC1155Upgradeable(_offer.tokenAddress);
        token.safeTransferFrom(
            _offer.creator, 
            msg.sender, 
            _offer.tokenId, 
            _offer.amount, 
            ""
        );
    }
}