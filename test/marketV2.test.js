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
let FactoryContract, market, Itoken1155, ItokenDAI, ItokenLINK;
let ownerMarket, recipient, account1, ownerToken1155, buyerDAI, buyerLINK;

// ---------- Version 2 -------------
const buyer_USDT = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_AGGREGATOR = "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D";
// CryptoKitties
const ownerToken_721 = "0x68b42e44079d1d0a4a037e8c6ecd62c48967e69f";
const token721 = {
    address: "0x06012c8cf97bead5deae237070f9587f8e7a266d", // contract address
    id1: "842201",
    id2: "1068782",
    id3: "76"
}
let FactoryV2, marketV2, Itoken721, ItokenUSDT;
let ownerToken721, buyerUSDT;

describe("Market NFT V2", ()=>{
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

        // ---------------- VERSION 2 ------------------------------
        // 4. Buyer with USDT (and sending ether to the account)
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [buyer_USDT]
        });
        buyerUSDT = await ethers.provider.getSigner(buyer_USDT);
        await account1.sendTransaction({
            to: buyer_USDT,
            value: ethers.utils.parseEther('10.0'),
        });

        // 5. Owner token721
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_721]
        });
        ownerToken721 = await ethers.provider.getSigner(ownerToken_721);

        // USDT Token
        ItokenUSDT = await ethers.getContractAt("IERC20", USDT_ADDRESS);
        // Token ERC721
        Itoken721 = await ethers.getContractAt("IERC721Upgradeable", token721.address);
    });

    describe("Context: Use Market V1. Then upgrade to Market V2 and use it", ()=>{
        it("Create and sell an offer in market V1, and later in V2", async()=>{
            // Deploying MarketV1
            FactoryContract = await ethers.getContractFactory("Market");
            market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);

            let tx = await market.connect(ownerToken1155).createOffer(
                token1155.address,
                token1155.id,
                5,
                (time.duration.hours(1)).toNumber(),
                50
            );
            tx = tx.wait();
    
            // Approve the market to manage the offered tokens.
            tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
                market.address,
                true
            );
            // Activated the offer in the market
            tx = await market.connect(ownerToken1155).activateOffer(0);
            tx = await tx.wait();

            // Buy the offer with Version 1. (offerId: 0, method: 0 == EHT)
            tx = await market.connect(account1).buyTokenOffer(0, 0, {value: ethers.utils.parseEther("1")});
            tx = await tx.wait();

            // ----------- Market V2 ---------------

            // Upgrading to V2
            FactoryV2 = await ethers.getContractFactory("MarketV2");
            marketV2 = await upgrades.upgradeProxy(market.address, FactoryV2);

            // Create offer in Market V2
            await expect(tx = await marketV2.connect(ownerToken1155).createOffer(
                token1155.address,
                token1155.id,
                5,
                (time.duration.hours(1)).toNumber(),
                50,
                1 // 1 == Protocol ERC1155
                )
            )
                .to.emit(marketV2, 'OfferCreated')
                .withArgs(
                    1, 
                    await ownerToken1155.getAddress(),
                    token1155.address, 
                    token1155.id,
                    await time.latestBlock(),
                    1
                );
            tx = await tx.wait();

            // Activated the offer in the market V2
            tx = await marketV2.connect(ownerToken1155).activateOffer(1);
            tx = await tx.wait();

            // Getting the creator ETH balance before selling the offer
            const balanceETHBeforeSelled = await ownerToken1155.getBalance();

            // Buy the offer with Version 2. (offerId: 1, method: 0 == EHT)
            tx = await market.connect(account1).buyTokenOffer(1, 0, {value: ethers.utils.parseEther("1")});
            tx = await tx.wait();

            expect(10).to.equal(await Itoken1155.balanceOf(await account1.getAddress(), token1155.id));
            expect(20).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
            expect(await ownerToken1155.getBalance()).to.be.above(balanceETHBeforeSelled);
        });
    });

    describe("Context: Upgrade to Market V2 and use it", ()=>{
        before(async ()=>{
            // Deploying MarketV1
            FactoryContract = await ethers.getContractFactory("Market");
            market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);
            // Upgrading V2
            FactoryV2 = await ethers.getContractFactory("MarketV2");
            marketV2 = await upgrades.upgradeProxy(market.address, FactoryV2);
        });
        
        it("Must create an offer of the ERC1155 and buy with USDT", async ()=>{

        });
        it("Must create an offer of the ERC721 and buy with Ether", async ()=>{

        });

        it("Must allow add a new payment method (USDT)", async ()=>{
            let tx;
            await expect (tx = await marketV2.connect(ownerMarket).addPaymentMethod(USDT_AGGREGATOR, USDT_ADDRESS))
                .to.emit(marketV2, 'NewPaymentMethod')
                .withArgs(3, USDT_AGGREGATOR, USDT_ADDRESS);
            tx = tx.wait();
        });

        it("Must create an offer of the ERC1155 and buy with USDT", async ()=>{

        });
        it("Must create an offer of the ERC721 and buy with USDT", async ()=>{

        });
    });
});

