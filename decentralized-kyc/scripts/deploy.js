/**
 * scripts/deploy.js
 * ──────────────────
 * Hardhat deployment script for KYCRegistry contract.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * After deployment, copy the contract address to KYC_CONTRACT_ADDRESS in .env
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying KYCRegistry...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log(`📛 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

    // Deploy contract
    const KYCRegistry = await hre.ethers.getContractFactory("KYCRegistry");
    const contract = await KYCRegistry.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`✅ KYCRegistry deployed to: ${address}`);
    console.log(`📋 Transaction hash: ${contract.deploymentTransaction().hash}\n`);

    // Write deployment info to a JSON file for reference
    const deployInfo = {
        network: hre.network.name,
        contractAddress: address,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        txHash: contract.deploymentTransaction().hash,
    };

    const outPath = path.join(__dirname, "..", "deployment.json");
    fs.writeFileSync(outPath, JSON.stringify(deployInfo, null, 2));
    console.log(`📁 Deployment info saved to: deployment.json`);
    console.log(`\n👉 Add to your .env:\n   KYC_CONTRACT_ADDRESS=${address}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
