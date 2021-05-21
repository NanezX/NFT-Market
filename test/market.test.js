const { expect } = require("chai");
const { ethers, upgrades} = require("hardhat");
const fetch = require("node-fetch");
const hre = require("hardhat");
const {time} = require('@openzeppelin/test-helpers');

// Accounts
const ownerToken_1155 = "0x5a098be98f6715782ee73dc9c5b9574bd4c130c9";
const buyer_DAI = "0x41428daf581f6dd447c6586863d17b3c8fc6f936";

// Token addresses
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const LINK_ADDRESS = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const token1155={
    address: "0xd07dc4262BCDbf85190C01c996b4C06a461d2430",
    id: "65678"
}

let FactoryContract, market, Itoken1155, Itoken20;
let ownerMarket, recipient, account1, ownerToken1155, buyerDAI;

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

    // Tokens
    Itoken1155 = await ethers.getContractAt("IERC1155Upgradeable", token1155.address);
    Itoken20 = await ethers.getContractAt("IERC20", DAI_ADDRESS);
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
        // Create offer into the market and check the event
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
                10, 
                100
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
    
});

describe("Market NFT - Trades", ()=>{
    beforeEach(async ()=>{
        // Deploying
        FactoryContract = await ethers.getContractFactory("Market");
        market = await upgrades.deployProxy(FactoryContract.connect(ownerMarket), [recipient.address, 100]);
    });

    it("Must be purchased the offer correctly with Ether", async ()=>{
        // Create offer into the market and check the event
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
        const balanceETHBeforeSelled = await ownerToken1155.getBalance();

        // Buy the offer. (offerId: 0, method: 0 == EHT)
        tx = await market.connect(account1).buyTokenOffer(0, 0, { value: ethers.utils.parseEther("1") });
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
            10,
            (time.duration.hours(1)).toNumber(),
            100
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
        tx = await Itoken20.connect(buyerDAI).approve(market.address, amountAproxToken);
        tx = await tx.wait();

        // Buy the offer. (offerId: 0, method: 1 == DAI)
        tx = await market.connect(buyerDAI).buyTokenOffer(0,1);
        tx = await tx.wait();

        expect(10).to.equal(await Itoken1155.balanceOf(await buyerDAI.getAddress(), token1155.id));
        expect(10).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
    });
});

/*      TIME MANIPULATION Examples
      let block1 = await time.latestBlock();
      let time1 = await time.latest();
      console.log(block1.toString());
      console.log(time1.toString());

      time.increase(time.duration.hours(1));
*/