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
    address payable recipient;
    enum STATE{ CANCELLED, ACTIVE, SELLED, PENDING}
    struct offer{
        uint88 amount;
        uint64 deadline;
        uint88 price;
        STATE state;
        address creator;
    }
    mapping(address => mapping(uint => offer)) offers;

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
    function createOffer(address _tokenAddress, uint _tokenId, uint64 _amount, uint64 _deadline, uint64 _price) external{
        IERC1155Upgradeable token = IERC1155Upgradeable(_tokenAddress);
        require(token.balanceOf(msg.sender, _tokenId)>= _amount, "Don't have enough tokens");
        offers[_tokenAddress][_tokenId] = offer(_amount, uint64(block.timestamp + _deadline), _price, STATE.PENDING, msg.sender);
    }

    /// @notice Activate an offer to make it available to buy
    /// @dev The msg.sender must be the same of the token owner
    /// @param _tokenAddress The address of the offer token
    /// @param _tokenId The id of the offer token
    function activateOffer(address _tokenAddress, uint _tokenId) external{
        require(STATE.PENDING==offers[_tokenAddress][_tokenId].state, "The offer is not pending");
        require(msg.sender==offers[_tokenAddress][_tokenId].creator, "Not the offer creator");
        IERC1155Upgradeable token = IERC1155Upgradeable(_tokenAddress);
        require(token.isApprovedForAll(msg.sender, address(this)));
        offers[_tokenAddress][_tokenId].state=STATE.ACTIVE;
    }

    /// @notice Get the properties of an offer
    /// @param _tokenAddress The address of the offer token
    /// @param _tokenId The id of the offer token
    /// @return The amount of token in the offer
    /// @return The timestamp that the offer will dissapier
    /// @return The price in USD that is necesary to buy the amount of tokens
    /// @return The owner of the tokens
    /// @return Actual state of the offer
    function getOffer(address _tokenAddress, uint _tokenId) view public returns(uint88, uint64, uint88, STATE, address){
        console.log("Gasleft 1: %s", gasleft());
        // offer memory _offer = offers[_tokenAddress][_tokenId];
        return (
            offers[_tokenAddress][_tokenId].amount, 
            offers[_tokenAddress][_tokenId].deadline,  
            offers[_tokenAddress][_tokenId].price, 
            offers[_tokenAddress][_tokenId].state,
            offers[_tokenAddress][_tokenId].creator
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