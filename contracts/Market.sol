// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/InterfaceToken20.sol";
import "hardhat/console.sol";

/// @title A market of ERC-1155 tokens
/// @author Hernandez, Victor
/// @notice This contract can be useful to sell and buy custom ERC-1155 tokens 
/// @dev There are some things that must be done outside of the contract
contract Market is OwnableUpgradeable{
    uint fee;
    uint quantityOffers;
    address payable recipient;
    enum STATE{ CANCELLED, ACTIVE, SELLED, PENDING}
    struct Offer{
        address tokenAddress;
        uint96 priceUSD;
        uint tokenId;
        uint128 amount;
        uint128 deadline;
        address creator;
        STATE state;
    }
    struct PaymentMethod{
        AggregatorV3Interface agregator;
        address token;
    }
    event OfferCreated(
        uint indexed id, 
        address indexed tokenAddress, 
        uint indexed tokenId,
        uint128 amount,
        uint96 price,
        address creator
    );
    mapping(uint => Offer) offers;
    mapping(uint => PaymentMethod) paymentMethods;

    /// @notice The function initializable to proxy.
    /// @dev Only is used one time. The fee is represented in bip [0 - 10000]
    /// @param _recipient The recipient that will receive the transactions fees
    /// @param _fee The transaction fee
    function initialize(address payable _recipient, uint _fee) public initializer {
        OwnableUpgradeable.__Ownable_init();
        recipient = _recipient;
        fee = _fee;
        _initPaymentMethods();
    }
    function _initPaymentMethods() internal initializer{
        paymentMethods[0] = PaymentMethod(
            AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419), 
            address(0)
        );
        paymentMethods[1] = PaymentMethod(
            AggregatorV3Interface(0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9),
            0x6B175474E89094C44Da98b954EedeAC495271d0F
        );
        paymentMethods[2] = PaymentMethod(
            AggregatorV3Interface(0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c),
            0x514910771AF9Ca656af840dff83E8264EcF986CA
        );
    }

    modifier checkOffer(uint id){
        require(offers[id].state == STATE.ACTIVE, "The offer is not available");
        if(offers[id].deadline <= block.timestamp){
            offers[id].state = STATE.CANCELLED;
            require(true, "The offer has expired");
        }
        require(
            offers[id].creator != msg.sender, 
            "The creator of the offer cannot buy their own offer"
        );
        _;
    }
    
    modifier onlyCreator(uint offerId){
        require(
            msg.sender==offers[offerId].creator, 
            "Not the offer creator"
        );
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
    /// @param _tokenAddress The address of the token being offered
    /// @param _tokenId The id of the token being offered
    /// @param _amount The amount of token that is offered.
    /// @param _deadline How long the offer will last
    /// @param _priceUSD The price in USD that is necesary to buy the amount of tokens
    function createOffer(
        address _tokenAddress, 
        uint _tokenId, 
        uint128 _amount, 
        uint128 _deadline, 
        uint96 _priceUSD
        ) 
        external 
        {
        IERC1155Upgradeable token = IERC1155Upgradeable(_tokenAddress);
        require(
            token.balanceOf(msg.sender, _tokenId)>= _amount, 
            "Don't have enough tokens"
        );
        offers[quantityOffers] = Offer(
            _tokenAddress, 
            _priceUSD, 
            _tokenId, 
            _amount, 
            uint128(block.timestamp + _deadline), 
            msg.sender,
            STATE.PENDING 
        );
        emit OfferCreated(
            quantityOffers,
            _tokenAddress, 
            _tokenId, 
            _amount, 
            _priceUSD,
            msg.sender
        );
        quantityOffers++;
    }

    /// @notice Activate an offer to make it available to buy
    /// @dev The msg.sender must be the same of the token owner
    /// @param _offerId The offer identifier 
    function activateOffer(uint _offerId) external onlyCreator(_offerId){
        require(
            STATE.PENDING==offers[_offerId].state,
            "The offer is not pending"
        );
        require(
            (IERC1155Upgradeable(offers[_offerId].tokenAddress)).isApprovedForAll(msg.sender, address(this)),
            "The market is not approved"
        );
        offers[_offerId].state=STATE.ACTIVE;
    }

        // Need a event**************
    function buyTokenOffer(uint offerId, uint8 _payMethod) 
        external 
        payable 
        checkOffer(offerId)
        {
        if(_payMethod == 0){
            _buyWithEther(offerId);
        }else{
            _buyWithTokens(_payMethod, offerId);
        }
        offers[offerId].state = STATE.SELLED;
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
    /// @return The token id in offer
    /// @return The amount of token in the offer
    /// @return The timestamp that the offer will dissapier
    /// @return The price in USD that is necesary to buy the amount of tokens
    /// @return The owner of the tokens
    /// @return Actual state of the offer
    function getOffer(uint _offerId) 
        external 
        view 
        returns (address, uint96, uint, uint128, uint128, address, STATE)
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

    function getPrice(uint offerId, uint8 paymentMethod) public view returns (uint){
        uint decimals;
        if (paymentMethod==0){
            decimals=18;
        }else{
            InterfaceToken20 token = InterfaceToken20(paymentMethods[paymentMethod].token);
            decimals=token.decimals();
        }
        (, int price,,,) = paymentMethods[paymentMethod].agregator.latestRoundData();
        require(price > 0);
        uint8 agregatorDecimals = paymentMethods[paymentMethod].agregator.decimals();

        return ((offers[offerId].priceUSD * (10**agregatorDecimals)) *  (10**decimals)) / uint(price);
    }

    function _buyWithEther(uint _offerId) internal{
        uint amountETH = getPrice(_offerId, 0);
        require(msg.value >= amountETH, "Not enough ether sent");

        uint _fee = (amountETH*fee)/10000;
        uint amountToSend = amountETH - _fee;
        Offer memory offer = offers[_offerId];
        _singleTransfer(offer);

        (bool success,) = payable(offer.creator).call{value: amountToSend}("");
        require(success, "Fail when send to the seller");
        (success, ) = recipient.call{value: _fee}("");
        require(success, "Fail when send ether to recipient");
        if(msg.value > amountETH){
            (success,) = msg.sender.call{ value: address(this).balance }("");
            require(success, "Fail when refund the rest to buyer");
        }
    }
    
    function _buyWithTokens(uint8 _tokenToPay, uint _offerId) internal {
        uint amountTokens = getPrice(_offerId, _tokenToPay);
        InterfaceToken20 token = InterfaceToken20(paymentMethods[_tokenToPay].token);
        require (token.allowance(msg.sender, address(this))>=amountTokens, "Not approved enough tokens to spend");

        uint _fee = (amountTokens*fee)/10000;
        uint amountToSend = amountTokens - _fee;
         Offer memory offer = offers[_offerId];
        _singleTransfer(offer);

        bool success = token.transferFrom(msg.sender, offer.creator, amountToSend);
        require(success, "Fail when transfer the payment");
        success = token.transferFrom(msg.sender, recipient, _fee);
        require(success, "Fail when transfer fee to the recipient");
    }

    function _singleTransfer(Offer memory _offer)internal{
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