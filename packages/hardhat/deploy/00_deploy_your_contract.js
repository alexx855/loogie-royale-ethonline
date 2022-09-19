// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

const localChainId = "31337";

// const sleep = (ms) =>
//   new Promise((r) =>
//     setTimeout(() => {
//       console.log(`waited for ${(ms / 1000).toFixed(3)} seconds`);
//       r();
//     }, ms)
//   );

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  await deploy("YourContract", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    // args: [ "Hello", ethers.utils.parseEther("1.5") ],
    log: true,
    waitConfirmations: 5,
  });

  console.log(
    `Attempting to deploy LoogiesMock.sol to network number ${chainId} from ${deployer.address}`
  );

  const loogiesContract = await deploy("Loogies", {
    from: deployer,
    log: true,
  });
  const loogiesContractAddress = loogiesContract.address;
  // }

  console.log(
    `Attempting to deploy Game.sol to network number ${chainId} from ${deployer.address}`
  );

  const gameContract = await deploy("Game", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    args: [loogiesContractAddress],
    log: true,
  });

  console.log(`Game contract deployed to ${gameContract.address}`);

  const GameContract = await ethers.getContract("Game", deployer);

  // await GameContract.start();
  await GameContract.setDropOnCollect(true);

  // if (chainId !== localChainId) {
  //   await GameContract.transferOwnership(
  //     "0x2E4D22389510eD618A4cF778409270C34eE1AF9e"
  //   );
  // }

  try {
    if (chainId !== localChainId)
      await run("verify:verify", {
        address: gameContract.address,
        contract: "contracts/Game.sol:Game",
        constructorArguments: [
          loogiesContractAddress,
          // loogieCoinContractAddress,
        ],
      });
  } catch (error) {
    console.error(error);
  }

  // Getting a previously deployed contract
  // const YourContract = await ethers.getContract("YourContract", deployer);
  // /*  await YourContract.setPurpose("Hello");

  //   To take ownership of yourContract using the ownable library uncomment next line and add the
  //   address you want to be the owner.
  //   // await yourContract.transferOwnership(YOUR_ADDRESS_HERE);

  //   //const yourContract = await ethers.getContractAt('YourContract', "0xaAC799eC2d00C013f1F11c37E654e59B0429DF6A") //<-- if you want to instantiate a version of a contract at a specific address!
  // */

  /*
  //If you want to send value to an address from the deployer
  const deployerWallet = ethers.provider.getSigner()
  await deployerWallet.sendTransaction({
    to: "0x34aA3F359A9D614239015126635CE7732c18fDF3",
    value: ethers.utils.parseEther("0.001")
  })
  */

  /*
  //If you want to send some ETH to a contract on deploy (make your constructor payable!)
  const yourContract = await deploy("YourContract", [], {
  value: ethers.utils.parseEther("0.05")
  });
  */

  /*
  //If you want to link a library into your contract:
  // reference: https://github.com/austintgriffith/scaffold-eth/blob/using-libraries-example/packages/hardhat/scripts/deploy.js#L19
  const yourContract = await deploy("YourContract", [], {}, {
   LibraryName: **LibraryAddress**
  });
  */

  // Verify from the command line by running `yarn verify`

  // You can also Verify your contracts with Etherscan here...
  // You don't want to verify on localhost
  // try {
  //   if (chainId !== localChainId) {
  //     await run("verify:verify", {
  //       address: YourContract.address,
  //       contract: "contracts/YourContract.sol:YourContract",
  //       constructorArguments: [],
  //     });
  //   }
  // } catch (error) {
  //   console.error(error);
  // }
};
module.exports.tags = ["YourContract"];
