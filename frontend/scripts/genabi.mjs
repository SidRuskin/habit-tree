import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const BACKEND_DIR = path.resolve(__dirname, "../../backend");
const FRONTEND_DIR = path.resolve(__dirname, "..");
const DEPLOYMENTS_DIR = path.join(BACKEND_DIR, "deployments");
const ABI_DIR = path.join(FRONTEND_DIR, "abi");
const ADDRESSES_FILE = path.join(FRONTEND_DIR, "addresses.json");

// Network configurations
const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
  },
  localhost: {
    chainId: 31337,
    name: "localhost",
  },
};

// Contract names to process
const CONTRACT_NAMES = ["HabitTree"];

/**
 * Read deployment information from hardhat-deploy
 * @param {string} network - Network name (e.g., "sepolia")
 * @param {string} contractName - Contract name
 * @returns {Object|null} Deployment info or null if not deployed
 */
function readDeployment(network, contractName) {
  const networkDir = path.join(DEPLOYMENTS_DIR, network);
  
  if (!fs.existsSync(networkDir)) {
    return null;
  }

  // Try direct file: deployments/<network>/<contract>.json
  const directFile = path.join(networkDir, `${contractName}.json`);
  if (fs.existsSync(directFile)) {
    try {
      const content = fs.readFileSync(directFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Failed to read ${directFile}:`, error.message);
      return null;
    }
  }

  // Try nested structure: deployments/<network>/<contract>.sol/<contract>.json
  const nestedDir = path.join(networkDir, `${contractName}.sol`);
  const nestedFile = path.join(nestedDir, `${contractName}.json`);
  if (fs.existsSync(nestedFile)) {
    try {
      const content = fs.readFileSync(nestedFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Failed to read ${nestedFile}:`, error.message);
      return null;
    }
  }

  return null;
}

/**
 * Get ABI from artifacts if deployment file doesn't have it
 * @param {string} contractName - Contract name
 * @returns {Array|null} ABI or null
 */
function getABIFromArtifacts(contractName) {
  const artifactsDir = path.join(BACKEND_DIR, "artifacts", "contracts");
  const contractFile = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
  
  if (fs.existsSync(contractFile)) {
    try {
      const content = fs.readFileSync(contractFile, "utf-8");
      const artifact = JSON.parse(content);
      return artifact.abi || null;
    } catch (error) {
      console.warn(`Failed to read artifact ${contractFile}:`, error.message);
      return null;
    }
  }

  return null;
}

/**
 * Generate ABI files and address mappings
 */
function generateABIAndAddresses() {
  console.log("Generating ABI files and address mappings...\n");

  // Create ABI directory if it doesn't exist
  if (!fs.existsSync(ABI_DIR)) {
    fs.mkdirSync(ABI_DIR, { recursive: true });
    console.log(`Created ABI directory: ${ABI_DIR}`);
  }

  // Initialize addresses object for all networks
  const addresses = {};
  for (const network of Object.values(NETWORKS)) {
    addresses[network.chainId] = {};
  }

  let processedCount = 0;
  let skippedCount = 0;

  // Process each contract
  for (const contractName of CONTRACT_NAMES) {
    console.log(`Processing ${contractName}...`);

    let contractDeployed = false;
    let contractABI = null;

    // Try to read deployment from all networks
    for (const [networkKey, network] of Object.entries(NETWORKS)) {
      const deployment = readDeployment(networkKey, contractName);

      if (deployment && deployment.address) {
        const address = deployment.address;
        console.log(`  ✓ Found deployment on ${networkKey} at: ${address}`);

        // Add to addresses mapping for this network
        addresses[network.chainId][contractName] = address;
        contractDeployed = true;

        // Get ABI from deployment (use first found deployment's ABI)
        if (!contractABI && deployment.abi && deployment.abi.length > 0) {
          contractABI = deployment.abi;
        }
      } else {
        console.log(`  ⚠️  ${contractName} not deployed on ${networkKey}`);
      }
    }

    if (!contractDeployed) {
      console.log(`  ⚠️  ${contractName} not deployed on any network, skipping...`);
      skippedCount++;
      continue;
    }

    // Get ABI from artifacts if not found in deployment
    if (!contractABI || contractABI.length === 0) {
      console.log(`  ⚠️  No ABI in deployment files, trying artifacts...`);
      contractABI = getABIFromArtifacts(contractName);
    }

    if (!contractABI || contractABI.length === 0) {
      console.log(`  ⚠️  No ABI found for ${contractName}, skipping ABI generation...`);
    } else {
      // Write ABI file
      const abiFile = path.join(ABI_DIR, `${contractName}.json`);
      fs.writeFileSync(abiFile, JSON.stringify(contractABI, null, 2), "utf-8");
      console.log(`  ✓ Generated ABI file: ${abiFile}`);
    }

    processedCount++;
  }

  // Clean up empty network entries
  for (const chainId of Object.keys(addresses)) {
    if (Object.keys(addresses[chainId]).length === 0) {
      delete addresses[chainId];
    }
  }

  // Write addresses file
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2), "utf-8");
  console.log(`\n✓ Generated addresses file: ${ADDRESSES_FILE}`);

  console.log(`\nSummary:`);
  console.log(`  Processed: ${processedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Total: ${CONTRACT_NAMES.length}`);
  console.log(`  Networks with deployments: ${Object.keys(addresses).length}`);
}

// Run the script
try {
  generateABIAndAddresses();
  console.log("\n✅ ABI and address generation completed successfully!");
} catch (error) {
  console.error("\n❌ Error generating ABI and addresses:", error);
  process.exit(1);
}
