const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KYCRegistry", function () {
    let contract, owner, validator, user, bank;

    beforeEach(async () => {
        [owner, validator, user, bank] = await ethers.getSigners();
        const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
        contract = await KYCRegistry.deploy();
    });

    it("should register a KYC hash", async () => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes("QmFakeIPFSCID123"));
        await contract.connect(user).registerKYCHash(hash, "QmFakeIPFSCID123", 365);
        const record = await contract.getKYCRecord(user.address);
        expect(record.kycHash).to.equal(hash);
        expect(record.isVerified).to.equal(false);
    });

    it("should verify KYC as validator", async () => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes("QmFakeIPFSCID456"));
        await contract.connect(user).registerKYCHash(hash, "QmFakeIPFSCID456", 365);
        await contract.connect(owner).verifyKYC(user.address); // owner is auto-validator
        const record = await contract.getKYCRecord(user.address);
        expect(record.isVerified).to.equal(true);
    });

    it("should allow bank to request access", async () => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes("QmFakeIPFSCID789"));
        await contract.connect(user).registerKYCHash(hash, "QmFakeIPFSCID789", 365);
        await contract.connect(bank).requestAccess(user.address);
        expect(await contract.hasPendingRequest(user.address, bank.address)).to.equal(true);
    });

    it("should grant and verify consent", async () => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes("QmFakeIPFSCIDabc"));
        await contract.connect(user).registerKYCHash(hash, "QmFakeIPFSCIDabc", 365);
        await contract.connect(bank).requestAccess(user.address);
        await contract.connect(user).grantConsent(bank.address);
        expect(await contract.hasConsent(user.address, bank.address)).to.equal(true);
    });

    it("should revoke consent", async () => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes("QmFakeIPFSCIDxyz"));
        await contract.connect(user).registerKYCHash(hash, "QmFakeIPFSCIDxyz", 365);
        await contract.connect(bank).requestAccess(user.address);
        await contract.connect(user).grantConsent(bank.address);
        await contract.connect(user).revokeConsent(bank.address);
        expect(await contract.hasConsent(user.address, bank.address)).to.equal(false);
    });

    it("should not allow non-validator to verify KYC", async () => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes("QmFakeIPFSCIDdef"));
        await contract.connect(user).registerKYCHash(hash, "QmFakeIPFSCIDdef", 365);
        await expect(contract.connect(bank).verifyKYC(user.address))
            .to.be.revertedWith("KYCRegistry: caller is not a validator");
    });
});
