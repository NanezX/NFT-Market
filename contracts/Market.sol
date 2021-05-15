// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Market is OwnableUpgradeable{
    uint fee;
    address payable recipient;
    function initialize(address payable _recipient, uint _fee) public initializer {
        OwnableUpgradeable.__Ownable_init();
        recipient = _recipient;
        fee = _fee; // [0 - 10000]
    }
    function setFee(uint _fee) external onlyOwner{
        fee = _fee;
    }
    function getFee() external view returns (uint){
        return fee;
    }
    function setRecipient(address payable _recipient) external onlyOwner{
        recipient = _recipient;
    }
    function getRecipient() external view returns (address){
        return recipient;
    }
}