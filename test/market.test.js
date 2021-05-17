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
    
    it("Transfer ERC1155 tokens", async ()=>{
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ownerToken_1]
        });
        const ownerToken1 = await ethers.provider.getSigner(ownerToken_1);
        let Itoken = await ethers.getContractAt("IERC1155Upgradeable", token1.address);

        const FactoryContract = await ethers.getContractFactory("Market");
        const market = await upgrades.deployProxy(FactoryContract.connect(owner), [recipient.address, 100]);

        // Create offer into the market
        let tx = await market.connect(ownerToken1).createOffer(
            token1.address,
            token1.id,
            10,
            (time.duration.hours(1)).toNumber(),
            ethers.utils.parseEther('1')
        );
        tx = tx.wait();

        // Aproved the market to manage the tokens
        tx = await Itoken.connect(ownerToken1).setApprovalForAll(
            await market.address,
            true
        );
        tx = await tx.wait();

        // Activated the offer in the market
        tx = await market.connect(ownerToken1).activateOffer(
            token1.address,
            token1.id
        );
        tx = await tx.wait();
        
        // Transfer the tokens
        tx = await market.connect(account1).singleTransfer(
            token1.address,
            ownerToken1.getAddress(),
            account1.getAddress(),
            token1.id, 
            10
        );
        tx = await tx.wait();
        expect(10).to.equal(await Itoken.balanceOf(await account1.getAddress(), token1.id));
        expect(20).to.equal(await Itoken.balanceOf(await ownerToken1.getAddress(), token1.id));
    });

    
});

/*      TIME MANIPULATION Examples
      let block1 = await time.latestBlock();
      let time1 = await time.latest();
      console.log(block1.toString());
      console.log(time1.toString());

      time.increase(time.duration.hours(1));
*/