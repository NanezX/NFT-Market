const { expect } = require("chai");
const { ethers, upgrades} = require("hardhat");
const fetch = require("node-fetch");
const hre = require("hardhat");
const {time} = require("@openzeppelin/test-helpers");

// Accounts
const ownerToken_1155 = "0x5a098be98f6715782ee73dc9c5b9574bd4c130c9";
const buyer_DAI = "0x41428daf581f6dd447c6586863d17b3c8fc6f936";
const buyer_LINK = "0x3fcac584d0b71a9564602c1f0288ec1c0d9846cf";

// Token addresses
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const LINK_ADDRESS = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const token1155={
    address: "0xd07dc4262BCDbf85190C01c996b4C06a461d2430",
    id: "65678"
}

let FactoryContract, market, Itoken1155, ItokenDAI;
let ownerMarket, recipient, account1, ownerToken1155, buyerDAI, buyerLINK;

before(async ()=>{
    // Getting hardhat accounts
    [ownerMarket, recipient, account1] = await ethers.getSigners();

    // Setting the custom accounts
    // 1. Owner of Token1155
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ownerToken_1155]
    });
    ownerToken1155 = await ethers.provider.getSigner(ownerToken_1155);

    // 2. Buyer with DAI (and sending ether to the account)
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [buyer_DAI]
    });
    await account1.sendTransaction({
        to: buyer_DAI,
        value: ethers.utils.parseEther('10.0'),
    });
    buyerDAI = await ethers.provider.getSigner(buyer_DAI);

    // 3. Buyer with LINK (and sending ether to the account)
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [buyer_LINK]
    });
    await account1.sendTransaction({
        to: buyer_LINK,
        value: ethers.utils.parseEther('10.0'),
    });
    buyerLINK = await ethers.provider.getSigner(buyer_LINK);

    // Tokens
    Itoken1155 = await ethers.getContractAt("IERC1155Upgradeable", token1155.address);
    ItokenDAI = await ethers.getContractAt("IERC20", DAI_ADDRESS);
    ItokenLINK = await ethers.getContractAt("IERC20", LINK_ADDRESS);
});
describe("Market NFT V2 - Setting", ()=>{
    it("Checking the deploy and upgrade", async ()=>{
        // Deploying
        FactoryContract = await ethers.getContractFactory("Market");
        market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);

        // Upgrading
        const FactoryV2 = await ethers.getContractFactory("MarketV2");
        const marketV2 = await upgrades.upgradeProxy(market.address, FactoryV2);

    });
});

