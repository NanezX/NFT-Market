// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "hardhat/console.sol";

contract Token1155 {
    function singleTransfer(address contractToken, address from, address to, uint256 id, uint256 amount) external{
        IERC1155Upgradeable tokens = IERC1155Upgradeable(contractToken);
        tokens.safeTransferFrom(from, to, id, amount, "");
    }
}