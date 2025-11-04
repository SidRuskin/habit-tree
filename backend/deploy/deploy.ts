import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedHabitTree = await deploy("HabitTree", {
    from: deployer,
    log: true,
  });

  console.log(`HabitTree contract: `, deployedHabitTree.address);
};
export default func;
func.id = "deploy_habittree"; // id required to prevent reexecution
func.tags = ["HabitTree"];

