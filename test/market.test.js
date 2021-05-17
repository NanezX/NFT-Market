const { expect } = require("chai");
const { ethers, upgrades} = require("hardhat");
const fetch = require("node-fetch");
const hre = require("hardhat");

const {time} = require('@openzeppelin/test-helpers');

let owner, recipient, account1;

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
});

/*      TIME MANIPULATION Examples
      let block1 = await time.latestBlock();
      let time1 = await time.latest();
      console.log(block1.toString());
      console.log(time1.toString());

      time.increase(time.duration.hours(1));
*/