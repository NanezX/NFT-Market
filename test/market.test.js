const { expect } = require("chai");
const { ethers, upgrades} = require("hardhat");
const fetch = require("node-fetch");
const hre = require("hardhat");

const {time} = require('@openzeppelin/test-helpers');

let owner, recipient, account1;
const token1={
    address: "0xd07dc4262BCDbf85190C01c996b4C06a461d2430",
    id: "65678"
}
const ownerToken_1 = "0x5a098be98f6715782ee73dc9c5b9574bd4c130c9";

describe("Market NFT", ()=>{
    beforeEach(async ()=>{
        // Getting hardhat accounts
        [owner, recipient, account1] = await ethers.getSigners();
    });

    it("Checking", async ()=>{
        // Deploying
        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        const _price = await market.getPrice(1);
        console.log(_price.toString());


    });
/*
    it("Must be return the correct owner, fee and recipient", async ()=>{
        // Deploying
        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        const _owner = await market.owner();
        const _fee = await market.getFee();
        const _recipient = await market.getRecipient();
        expect(100).to.equal(_fee);
        expect(recipient.address).to.equal(_recipient);
        expect(owner.address).to.equal(_owner);
    });

    it("Must be change the fee and recipient correctly", async()=>{
        // Deploying
        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 150]);

        // Changing the fee
        let tx = await market.connect(owner).setFee(200);
        tx = await tx.wait();
        const _fee = await market.getFee();
        // Transfering the ownership
        tx = await market.connect(owner).setRecipient(account1.address);
        tx = await tx.wait();
        const _newRecipient = await market.getRecipient();

        expect(200).to.equal(_fee);
        expect(account1.address).to.equal(_newRecipient);
    });
    
    it("Must be create an offer correctly", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1]
        });
        const ownerToken1 = await ethers.provider.getSigner(ownerToken_1);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        // Create offer into the market and check the event
        let tx;
        await expect(
            tx = await market.connect(ownerToken1).createOffer(
                token1.address,
                token1.id,
                10,
                (time.duration.hours(1)).toNumber(),
                ethers.utils.parseEther('1')
            )
        )   // (Using Chai matchers to check the event. Oh yeah B) )
            .to.emit(market, 'OfferCreated')
            .withArgs(
                0, 
                token1.address, 
                token1.id, 
                10, 
                ethers.utils.parseEther('1'), 
                await ownerToken1.getAddress()
            );
        tx = await tx.wait();

        // Check the offer state (PENDING == 3)
        // The function is: getOffer(Offer_ID)
        let [,,,,,state,] = await market.getOffer(0);
        expect(3).to.equal(state);

    });

    it("Must be approve and activate the offer", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1]
        });
        const ownerToken1 = await ethers.provider.getSigner(ownerToken_1);
        let Itoken1 = await ethers.getContractAt("IERC1155Upgradeable", token1.address);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        let tx = await market.connect(ownerToken1).createOffer(
                token1.address,
                token1.id,
                10,
                (time.duration.hours(1)).toNumber(),
                ethers.utils.parseEther('1')
            );
        tx = await tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken1.connect(ownerToken1).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activated the offer in the market
        tx = await market.connect(ownerToken1).activateOffer(0);
        tx = await tx.wait();
        
        // Check if is approved and if offer state is activated
        const approved = await Itoken1.isApprovedForAll(await ownerToken1.getAddress(), market.address);
        expect(true).to.equal(approved);
        // (ACTIVE == 1)
        [,,,,,state,] = await market.getOffer(0);
        expect(1).to.equal(state);
    });

    it("Approve and activate the offer", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1]
        });
        const ownerToken1 = await ethers.provider.getSigner(ownerToken_1);
        let Itoken1 = await ethers.getContractAt("IERC1155Upgradeable", token1.address);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        // Create offer into the market and check the event
        let tx = await market.connect(ownerToken1).createOffer(
            token1.address,
            token1.id,
            10,
            (time.duration.hours(1)).toNumber(),
            ethers.utils.parseEther('1')
        );
        tx = await tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken1.connect(ownerToken1).setApprovalForAll(
            market.address,
            true
        );
        tx = await tx.wait();

        // Activated the offer in the market
        tx = await market.connect(ownerToken1).activateOffer(0);
        tx = await tx.wait();

        const overrides = { 
            value: ethers.utils.parseEther("1"),
        };

        // Transfer the tokens  
        tx = await market.connect(account1).buyTokenOffer(0, overrides);
        tx = await tx.wait();
        expect(10).to.equal(await Itoken1.balanceOf(await account1.getAddress(), token1.id));
        expect(20).to.equal(await Itoken1.balanceOf(await ownerToken1.getAddress(), token1.id));
    });
    */
});

/*      TIME MANIPULATION Examples
      let block1 = await time.latestBlock();
      let time1 = await time.latest();
      console.log(block1.toString());
      console.log(time1.toString());

      time.increase(time.duration.hours(1));
*/