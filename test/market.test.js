const { expect } = require("chai");
const { ethers, upgrades} = require("hardhat");
const fetch = require("node-fetch");
const hre = require("hardhat");
const {time} = require('@openzeppelin/test-helpers');

let owner, recipient, account1;
const token1155={
    address: "0xd07dc4262BCDbf85190C01c996b4C06a461d2430",
    id: "65678"
}
const ownerToken_1155 = "0x5a098be98f6715782ee73dc9c5b9574bd4c130c9";
// Balance: 651,82063 DAI
const ownerDAI = "0x41428daf581f6dd447c6586863d17b3c8fc6f936";

const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const LINK_ADDRESS = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

describe("Market NFT", ()=>{
    beforeEach(async ()=>{
        // Getting hardhat accounts
        [owner, recipient, account1] = await ethers.getSigners();
    });

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
            params: [ownerToken_1155]
        });
        const ownerToken1155 = await ethers.provider.getSigner(ownerToken_1155);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        // Create offer into the market and check the event
        let tx;
        await expect(
            tx = await market.connect(ownerToken1155).createOffer(
                token1155.address,
                token1155.id,
                10,
                (time.duration.hours(1)).toNumber(),
                ethers.utils.parseEther('1')
            )
        )   // (Using Chai matchers to check the event. Oh yeah B) )
            .to.emit(market, 'OfferCreated')
            .withArgs(
                0, 
                token1155.address, 
                token1155.id, 
                10, 
                ethers.utils.parseEther('1'), 
                await ownerToken1155.getAddress()
            );
        tx = await tx.wait();

        // Check the offer state (PENDING == 3)
        // The function is: getOffer(Offer_ID)
        let [,,,,,,state] = await market.getOffer(0);
        expect(3).to.equal(state);
    });

    it("Must be approve and activate the offer", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1155]
        });
        const ownerToken1155 = await ethers.provider.getSigner(ownerToken_1155);
        let Itoken1155 = await ethers.getContractAt("IERC1155Upgradeable", token1155.address);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        let tx = await market.connect(ownerToken1155).createOffer(
                token1155.address,
                token1155.id,
                10,
                (time.duration.hours(1)).toNumber(),
                ethers.utils.parseEther('1')
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
        
        // Check if is approved and if offer state is activated
        const approved = await Itoken1155.isApprovedForAll(await ownerToken1155.getAddress(), market.address);
        expect(true).to.equal(approved);
        // (ACTIVE == 1)
        [,,,,,,state] = await market.getOffer(0);
        expect(1).to.equal(state);
    });

    it("Must be purchased correctly with Ether", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1155]
        });
        const ownerToken1155 = await ethers.provider.getSigner(ownerToken_1155);
        let Itoken1155 = await ethers.getContractAt("IERC1155Upgradeable", token1155.address);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        // Create offer into the market and check the event
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
        const balanceBeforeSelled = await ownerToken1155.getBalance();
        
        const overrides = { 
            value: ethers.utils.parseEther("1"),
        };

        // Transfer the tokens  
        tx = await market.connect(account1).buyTokenOffer(0,0, overrides);
        tx = await tx.wait();
        expect(10).to.equal(await Itoken1155.balanceOf(await account1.getAddress(), token1155.id));
        expect(20).to.equal(await Itoken1155.balanceOf(await ownerToken1155.getAddress(), token1155.id));
        expect(await ownerToken1155.getBalance()).to.be.above(balanceBeforeSelled);
    });

    it("Must be purchased correctly with DAI Token", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1155]
        });
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerDAI]
        });
        const ownerToken1155 = await ethers.provider.getSigner(ownerToken_1155);
        const owner_DAI = await ethers.provider.getSigner(ownerDAI);
        // Giving ether to the account that have DAI tokens
        await account1.sendTransaction({
            to: await owner_DAI.getAddress(),
            value: ethers.utils.parseEther('10.0'),
        });

        let Itoken1155 = await ethers.getContractAt("IERC1155Upgradeable", token1155.address);
        let Itoken20 = await ethers.getContractAt("IERC20", DAI_ADDRESS);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

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
        tx = await Itoken20.connect(owner_DAI).approve(market.address, amountAproxToken);
        tx = await tx.wait();

        // // Transfer the tokens  
        tx = await market.connect(owner_DAI).buyTokenOffer(0,1);
        tx = await tx.wait();

        expect(10).to.equal(await Itoken1155.balanceOf(await owner_DAI.getAddress(), token1155.id));
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