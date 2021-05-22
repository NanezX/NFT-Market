const { expect } = require("chai");
const { ethers, upgrades} = require("hardhat");
const fetch = require("node-fetch");
const hre = require("hardhat");
const {time} = require('@openzeppelin/test-helpers');

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
describe("Market NFT - Basics", ()=>{
    beforeEach(async ()=>{
        // Deploying
        FactoryContract = await ethers.getContractFactory("Market");
        market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);
    });

    it("Must be return the correct owner, fee and recipient", async ()=>{
        const _owner = await market.owner();
        const _fee = await market.getFee();
        const _recipient = await market.getRecipient();

        expect(_fee).to.equal(100);
        expect(_recipient).to.equal(recipient.address);
        expect(_owner).to.equal(ownerMarket.address);
    });

    it("Must be change the fee and recipient correctly", async()=>{
        // Changing the fee
        let tx = await market.connect(ownerMarket).setFee(200);
        tx = await tx.wait();
        const _fee1 = await market.getFee();

        // Changing the recipient
        tx = await market.connect(ownerMarket).setRecipient(account1.address);
        tx = await tx.wait();
        const _newRecipient = await market.getRecipient();

        expect(_fee1).to.equal(200);
        expect(_newRecipient).to.equal(account1.address);
    });

    it("Must be create an offer completely", async ()=>{
        // Create offer into the market and check the event emitted
        let tx;
        await expect(
            tx = await market.connect(ownerToken1155).createOffer(
                token1155.address,
                token1155.id,
                10,
                (time.duration.hours(1)).toNumber(),
                100
            )
        )
            .to.emit(market, 'OfferCreated')
            .withArgs(
                0, 
                await ownerToken1155.getAddress(),
                token1155.address, 
                token1155.id,
                await time.latestBlock()
            );
        tx = await tx.wait();

        // Check the offer state (PENDING == 3)
        let [,,,,,,state] = await market.getOffer(0);
        expect(3).to.equal(state);

        // Approve the market to manage the offered tokens.
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();
        // Activated the offer in the market
        tx = await market.connect(ownerToken1155).activateOffer(0);
        tx = await tx.wait();

        // Check if is approved and if offer state is activated
        const approved = await Itoken1155.isApprovedForAll(await ownerToken1155.getAddress(), market.address);
        expect(true).to.equal(approved);
        // (ACTIVE == 1)
        [,,,,,,state] = await market.getOffer(0);
        expect(1).to.equal(state);
    });

    it("Must be cancel the offers", async ()=>{
    
        // Create two offers into the market and check the event emitted
        let tx;
        for (let i=0; i<2; i++){
            tx = await market.connect(ownerToken1155).createOffer(
                token1155.address,
                token1155.id,
                10,
                (time.duration.hours(1)).toNumber(),
                100
            );
            tx = await tx.wait();
        }

        // Approve the market to manage the offered tokens.
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activated the ONLY the 1st offer in the market
        tx = await market.connect(ownerToken1155).activateOffer(0);
        tx = await tx.wait();

        // Cancel both offers
        for(let i=0; i<2; i++){
            await expect(tx = await market.connect(ownerToken1155).cancelOffer(i))
                .to.emit(market, 'OfferCancelled')
                .withArgs(
                    i, // Offer ID
                    await ownerToken1155.getAddress(), // Address of the creator of the offer
                    token1155.address, // Token address
                    token1155.id, // Token ID
                    await time.latestBlock() // Block.time when was cancelled
                );
            tx = await tx.wait();

            // Check the offer state (CANCELLED == 0)
            [,,,,,,state] = await market.getOffer(i); // Get state of the Offer with ID: i
            expect(0).to.equal(state);
        }

    });
    
});

describe("Market NFT - Trades", ()=>{
    beforeEach(async ()=>{
        // Deploying
        FactoryContract = await ethers.getContractFactory("Market");
        market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);
    });

    it("Must buy with the offer with Ether", async ()=>{
        // Create offer into the market
        let tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            10,
            (time.duration.hours(1)).toNumber(),
            100
        );
        tx = await tx.wait();

        // Approve the market to manage the offered tokens.
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activated the offer in the market
        tx = await market.connect(ownerToken1155).activateOffer(0);
        tx = await tx.wait();

        // Getting the creator ETH balance before selling the offer
        const balanceETHBeforeSelled = await ownerToken1155.getBalance();

        // Buy the offer. (offerId: 0, method: 0 == EHT) and checking the event emitted
        await expect(tx = await market.connect(account1).buyTokenOffer(0, 0, {value: ethers.utils.parseEther("1")}))
            .to.emit(market, 'OfferSold')
            .withArgs(
                0, 
                await account1.getAddress(),
                token1155.address, 
                token1155.id, 
                await time.latestBlock()
            );
        tx = await tx.wait();

        expect(10).to.equal(await Itoken1155.balanceOf(await account1.getAddress(), token1155.id));
        expect(20).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ownerToken1155.getBalance()).to.be.above(balanceETHBeforeSelled);
    });

    it("Must buy with the offer with Ether DAI Token", async ()=>{
        // Create offer into the market
        let tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            5,
            (time.duration.hours(1)).toNumber(),
            50
        );
        tx = await tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();
        
        // Activated the offer in the market
        tx = await market.connect(ownerToken1155).activateOffer(0);
        tx = await tx.wait();

        // Getting the aprox token amount to reach the price of offer 0 with method 1 (DAI)
        let amountAproxToken = await market.getPrice(0, 1);

        // Setting an margin of 2% to the price
        amountAproxToken = (amountAproxToken.mul(102)).div(100);

        // Approve the market to manage the ERC20 tokens ()
        tx = await ItokenDAI.connect(buyerDAI).approve(market.address, amountAproxToken);
        tx = await tx.wait();

        // Getting the creator DAI balance before selling the offer
        const balanceDAIcreator = await ItokenDAI.balanceOf(await ownerToken1155.getAddress());

        // Buy the offer. (offerId: 0, method: 1 == DAI) and checking the event emitted
        await expect(tx = await market.connect(buyerDAI).buyTokenOffer(0,1))
            .to.emit(market, 'OfferSold')
            .withArgs(
                0, 
                await buyerDAI.getAddress(), 
                token1155.address, 
                token1155.id, 
                await time.latestBlock()
            );
        tx = await tx.wait();

        expect(5).to.equal(await Itoken1155.balanceOf(await buyerDAI.getAddress(), token1155.id));
        expect(15).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ItokenDAI.balanceOf(await ownerToken1155.getAddress())).to.be.above(balanceDAIcreator);
    });

    it("Must create two offers and only buy the 2nd offer with LINK Token", async ()=>{
        // Create the 1st offer (10 tokens ERC1155)
        let tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            10,
            (time.duration.hours(1)).toNumber(),
            100
        );
        tx = await tx.wait();

        // Create the 2nd offer (5 tokens ERC1155)
        tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            5,
            (time.duration.hours(1)).toNumber(),
            50
        );
        tx = await tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activating the offer 0 and 1 in the market
        for (let i=0; i<2; i++){
            tx = await market.connect(ownerToken1155).activateOffer(i);
            tx = await tx.wait();
        }

        // Getting the aprox token amount to reach the price of 2nd offer (ID:1) with method 2 (LINK)
        let amountAproxToken = await market.getPrice(1, 2);

        // Setting an margin of 2% to the price
        amountAproxToken = (amountAproxToken.mul(102)).div(100);

        // Approve the market to manage the ERC20 tokens ()
        tx = await ItokenLINK.connect(buyerLINK).approve(market.address, amountAproxToken);
        tx = await tx.wait();

        // Getting the creator LINK balance before selling the offer
        const balanceLINKcreator = await ItokenLINK.balanceOf(await ownerToken1155.getAddress());

        // Buy the 2nd offer with LINK.. (offerId: 1, method: 2 == DAI) and checking the event emitted
        await expect(tx = await market.connect(buyerLINK).buyTokenOffer(1,2))
            .to.emit(market, 'OfferSold')
            .withArgs(
                1, 
                await buyerLINK.getAddress(), 
                token1155.address, 
                token1155.id, 
                await time.latestBlock()
            );
        tx = await tx.wait();

        expect(5).to.equal(await Itoken1155.balanceOf(await buyerLINK.getAddress(), token1155.id));
        expect(10).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ItokenLINK.balanceOf(await ownerToken1155.getAddress())).to.be.above(balanceLINKcreator);
    });
    
});
/*
describe("Market NFT - Requirements management", ()=>{
    beforeEach(async ()=>{
        // Deploying
        FactoryContract = await ethers.getContractFactory("Market");
        market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);
    });

    it("Must be purchased the offer correctly with Ether", async ()=>{
        // Create offer into the market
        let tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            10,
            (time.duration.hours(1)).toNumber(),
            100
        );
        tx = await tx.wait();

        // Approve the market to manage the offered tokens.
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activated the offer in the market
        tx = await market.connect(ownerToken1155).activateOffer(0);
        tx = await tx.wait();

        // Getting the creator ETH balance before selling the offer
        const balanceETHBeforeSelled = await ownerToken1155.getBalance();

        // Buy the offer. (offerId: 0, method: 0 == EHT) and checking the event emitted
        await expect(tx = await market.connect(account1).buyTokenOffer(0, 0, {value: ethers.utils.parseEther("1")}))
            .to.emit(market, 'OfferSold')
            .withArgs(
                0, 
                await account1.getAddress(),
                token1155.address, 
                token1155.id, 
                await time.latestBlock()
            );
        tx = await tx.wait();

        expect(10).to.equal(await Itoken1155.balanceOf(await account1.getAddress(), token1155.id));
        expect(20).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ownerToken1155.getBalance()).to.be.above(balanceETHBeforeSelled);
    });

    it("Must be purchased correctly with DAI Token", async ()=>{
        // Create offer into the market
        let tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            5,
            (time.duration.hours(1)).toNumber(),
            50
        );
        tx = await tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();
        
        // Activated the offer in the market
        tx = await market.connect(ownerToken1155).activateOffer(0);
        tx = await tx.wait();

        // Getting the aprox token amount to reach the price of offer 0 with method 1 (DAI)
        let amountAproxToken = await market.getPrice(0, 1);

        // Setting an margin of 2% to the price
        amountAproxToken = (amountAproxToken.mul(102)).div(100);

        // Approve the market to manage the ERC20 tokens ()
        tx = await ItokenDAI.connect(buyerDAI).approve(market.address, amountAproxToken);
        tx = await tx.wait();

        // Getting the creator DAI balance before selling the offer
        const balanceDAIcreator = await ItokenDAI.balanceOf(await ownerToken1155.getAddress());

        // Buy the offer. (offerId: 0, method: 1 == DAI) and checking the event emitted
        await expect(tx = await market.connect(buyerDAI).buyTokenOffer(0,1))
            .to.emit(market, 'OfferSold')
            .withArgs(
                0, 
                await buyerDAI.getAddress(), 
                token1155.address, 
                token1155.id, 
                await time.latestBlock()
            );
        tx = await tx.wait();

        expect(5).to.equal(await Itoken1155.balanceOf(await buyerDAI.getAddress(), token1155.id));
        expect(15).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ItokenDAI.balanceOf(await ownerToken1155.getAddress())).to.be.above(balanceDAIcreator);
    });

    it("Must be create two offer and only buy the 2nd offer with LINK", async ()=>{
        // Create the 1st offer (10 tokens ERC1155)
        let tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            10,
            (time.duration.hours(1)).toNumber(),
            100
        );
        tx = await tx.wait();

        // Create the 2nd offer (5 tokens ERC1155)
        tx = await market.connect(ownerToken1155).createOffer(
            token1155.address,
            token1155.id,
            5,
            (time.duration.hours(1)).toNumber(),
            50
        );
        tx = await tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken1155.connect(ownerToken1155).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activating the offer 0 and 1 in the market
        for (let i=0; i<2; i++){
            tx = await market.connect(ownerToken1155).activateOffer(i);
            tx = await tx.wait();
        }

        // Getting the aprox token amount to reach the price of 2nd offer (ID:1) with method 2 (LINK)
        let amountAproxToken = await market.getPrice(1, 2);

        // Setting an margin of 2% to the price
        amountAproxToken = (amountAproxToken.mul(102)).div(100);

        // Approve the market to manage the ERC20 tokens ()
        tx = await ItokenLINK.connect(buyerLINK).approve(market.address, amountAproxToken);
        tx = await tx.wait();

        // Getting the creator LINK balance before selling the offer
        const balanceLINKcreator = await ItokenLINK.balanceOf(await ownerToken1155.getAddress());

        // Buy the 2nd offer with LINK.. (offerId: 1, method: 2 == DAI) and checking the event emitted
        await expect(tx = await market.connect(buyerLINK).buyTokenOffer(1,2))
            .to.emit(market, 'OfferSold')
            .withArgs(
                1, 
                await buyerLINK.getAddress(), 
                token1155.address, 
                token1155.id, 
                await time.latestBlock()
            );
        tx = await tx.wait();

        expect(5).to.equal(await Itoken1155.balanceOf(await buyerLINK.getAddress(), token1155.id));
        expect(10).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ItokenLINK.balanceOf(await ownerToken1155.getAddress())).to.be.above(balanceLINKcreator);
    });
    
});
*/
/*      TIME MANIPULATION Examples
      let block1 = await time.latestBlock();
      let time1 = await time.latest();
      console.log(block1.toString());
      console.log(time1.toString());

      time.increase(time.duration.hours(1));
*/