// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
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
    struct offer{
        address tokenAddress;
        uint96 tokenId;
        uint88 amount;
        uint88 deadline;
        uint72 price;
        STATE state;
        address creator;
    }
    mapping(uint => offer) offers;
    event OfferCreated(
        uint indexed id, 
        address indexed tokenAddress, 
        uint96 indexed tokenId,
        uint88 amount,
        uint88 price,
        address creator
    );

    /// @notice The function initializable to proxy.
    /// @dev Only is used one time. The fee is represented in bip [0 - 10000]
    /// @param _recipient The recipient that will receive the transactions fees
    /// @param _fee The transaction fee
    function initialize(address payable _recipient, uint _fee) public initializer {
        OwnableUpgradeable.__Ownable_init();
        recipient = _recipient;
        fee = _fee;
    }

    /// @notice Create an offer in the market
    /** @dev After create the offer, the creator must approve the market to manage the tokens and
        call to activateOffer function to make it available */
    /// @param _tokenAddress The address of the token being offered
    /// @param _tokenId The id of the token being offered
    /// @param _amount The amount of token that is offered.
    /// @param _deadline How long the offer will last
    /// @param _price The price in USD that is necesary to buy the amount of tokens
    function createOffer(address _tokenAddress, uint96 _tokenId, uint88 _amount, uint88 _deadline, uint72 _price) external {
        IERC1155Upgradeable token = IERC1155Upgradeable(_tokenAddress);
        require(token.balanceOf(msg.sender, _tokenId)>= _amount, "Don't have enough tokens");
        offers[quantityOffers] = offer(_tokenAddress, _tokenId, _amount, uint88(block.timestamp + _deadline), _price, STATE.PENDING, msg.sender);
        emit OfferCreated(quantityOffers,_tokenAddress, _tokenId, _amount, _price, msg.sender);
        quantityOffers++;
    }

    /// @notice Activate an offer to make it available to buy
    /// @dev The msg.sender must be the same of the token owner
    /// @param _offerId The offer identifier 
    function activateOffer(uint96 _offerId) external{
        require(STATE.PENDING==offers[_offerId].state, "The offer is not pending");
        require(msg.sender==offers[_offerId].creator, "Not the offer creator");
        // IERC1155Upgradeable token = IERC1155Upgradeable(offers[_offerId].tokenAddress);
        // (IERC1155Upgradeable(offers[_offerId].tokenAddress)).isApprovedForAll(msg.sender, address(this));
        require((IERC1155Upgradeable(offers[_offerId].tokenAddress)).isApprovedForAll(msg.sender, address(this)));
        offers[_offerId].state=STATE.ACTIVE;
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
    function getOffer(uint96 _offerId) view public returns(address, uint96, uint88, uint88, uint72, STATE, address){
        return (
            offers[_offerId].tokenAddress, 
            offers[_offerId].tokenId, 
            offers[_offerId].amount, 
            offers[_offerId].deadline,  
            offers[_offerId].price, 
            offers[_offerId].state,
            offers[_offerId].creator
        );
    }

    function buyTokenOffer(address _tokenAddress, uint _tokenId) external{

    }

    function singleTransfer(address contractToken, address from, address to, uint256 id, uint256 amount) external{
        IERC1155Upgradeable token = IERC1155Upgradeable(contractToken);
        require(token.isApprovedForAll(from, address(this)),"The market doesn't have permission to manage the tokens");
        token.safeTransferFrom(from, to, id, amount, "");
    }

    /** @notice Set the new fee that will be transfer to recipient for every sell.  
    Only the owner of the market can set a new price fee */
    /// @dev The fee must be set with a bases point (bip) within 0 and 10000
    /// @param _fee The new fee to every transaction
    function setFee(uint _fee) external onlyOwner{
        require(_fee>=0 && _fee<=10000);
        fee = _fee;
    }
    /// @notice Get the acttual fee for every sell
    /// @return Return the fee as uint
    function getFee() external view returns (uint){
        return fee;
    }

    /// @notice Set a new recipient that will receive the fee for every sell
    /// @param _recipient The recipient address
    function setRecipient(address payable _recipient) external onlyOwner{
        recipient = _recipient;
    }

    /// @notice Get the acttual recipient for every sell
    /// @return Return the recipient address
    function getRecipient() external view returns (address){
        return recipient;
    }
}