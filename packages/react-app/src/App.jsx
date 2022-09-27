import { Button, Card, List, Menu, Col, Row } from "antd";
// import Blockies from "react-blockies";
import "antd/dist/antd.css";
import { NetworkStatus } from "@apollo/client";
import { useBalance, useContractLoader, useOnBlock, useUserProviderAndSigner } from "eth-hooks";
import React, { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "react-router-dom";
import "./App.css";
import { Account, Contract, Header, ThemeSwitch, Faucet, FaucetHint, NetworkSwitch } from "./components";
import { NETWORKS } from "./constants";
import externalContracts from "./contracts/external_contracts";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import { Transactor, Web3ModalSetup } from "./helpers";
import { Subgraph } from "./views";
import { useStaticJsonRPC } from "./hooks";
import { gql, useQuery } from "@apollo/client";
import { RampInstantSDK } from "@ramp-network/ramp-instant-sdk";

function trimAddress(address) {
  // return address;
  return "0x" + address.substring(2, 5) + "..." + address.substring(address.length - 3, address.length);
}

const fetchLoogies = async (address, readContracts) => {
  const loogies = [];
  let loogiesBalance = 0;

  try {
    let lbalance = await readContracts.Loogies.balanceOf(address);

    // PLOOG owned by user address
    if (lbalance && lbalance.toNumber) {
      loogiesBalance += lbalance.toNumber();
    }

    for (let tokenIndex = 0; tokenIndex < lbalance.toNumber(); tokenIndex++) {
      const tokenId = await readContracts.Loogies.tokenOfOwnerByIndex(address, tokenIndex);
      // if (DEBUG) console.log("Getting loogie tokenId: ", tokenId);
      const tokenURI = await readContracts.Loogies.tokenURI(tokenId);
      // if (DEBUG) console.log("tokenURI: ", tokenURI);
      // const jsonManifestString = atob(tokenURI.substring(29));
      const jsonManifestString = Buffer.from(tokenURI.substring(29), "base64");

      const jsonManifest = JSON.parse(jsonManifestString);
      loogies.push({
        id: tokenId,
        symbol: "PLOOG",
        uri: tokenURI,
        playing: false,
        owner: address,
        ...jsonManifest,
      });
    }
  } catch (error) {
    console.log("Error getting loogies balance: ", error);
  }

  return { loogies, loogiesBalance };
};

const MAX_PLAYERS = 4;
// const INI_HEALTH = 100;
const BOX_SIZE = 64;
// estimated block time, in seconds
const BLOCK_TIME = 15;

const { ethers } = require("ethers");

/// 📡 What chain are your contracts deployed to?
const initialNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
// const NETWORKCHECK = true;
const USE_BURNER_WALLET = true; // toggle burner wallet feature
const USE_NETWORK_SELECTOR = false;

const web3Modal = Web3ModalSetup();

// 🛰 providers

function App(props) {
  // specify all the chains your app is available on. Eg: ['localhost', 'mainnet', ...otherNetworks ]
  // reference './constants.js' for other networks
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();
  const [selectedNetwork, setSelectedNetwork] = useState(networkOptions[0]);
  // const [currentBlock, setcurrentBlock] = useState(0);
  const location = useLocation();

  const targetNetwork = NETWORKS[selectedNetwork];
  // console.log("🚀 ~ file: App.jsx ~ line 123 ~ App ~ selectedNetwork", selectedNetwork);

  // 🔭 block explorer URL
  const blockExplorer = targetNetwork.blockExplorer;

  // load all your providers
  const provider = useStaticJsonRPC([
    process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : targetNetwork.rpcUrl,
  ]);
  // const mainnetProvider = useStaticJsonRPC(providers);

  if (DEBUG) console.log(`Using ${selectedNetwork} network`);

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  // const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, provider, USE_BURNER_WALLET);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = provider && provider._network && provider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const balance = useBalance(provider, address);

  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(provider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  // const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  // const [gameBlock, setGameBlock] = useState(0);
  // useOnBlock(provider, block => {
  //   console.log("🚀 ~ file: App.jsx ~ line 201 ~ useOnBlock ~ block", block);

  //   setGameBlock(provider._lastBlockNumber);
  // });

  // add players inside the game query, like i do for worldMatrixes
  const WORLD_QUERY_GRAPHQL = `

  {
    games {
      id,
      gameOn,
      winner,
      height,
      width,
      curseDropCount,
      curseNextGameTicker,
      curseDropCount,
      curseInterval,
      ticker,
      tickerBlock,
      createdAt,
      updatedAt
    },
    players {
        id,
        x,
        y,
        loogieId,
        health
    },
    worldMatrixes {
      id,
      x,
      y,
      healthAmountToCollect,
      cursed,
      player {
        id,
        x,
        y,
        loogieId,
        health
      }
    }
  }
  
  `;
  const WORLD_QUERY_GQL = gql(WORLD_QUERY_GRAPHQL);
  const { loading, error, data, refetch, networkStatus } = useQuery(WORLD_QUERY_GQL, {
    pollInterval: 1000,
    // pollInterval: 2500,
    fetchPolicy: "network-only", // Doesn't check cache before making a network request
    // notifyOnNetworkStatusChange: true,
  });

  const [yourLoogiesBalance, setYourLoogiesBalance] = useState(0);
  const [yourLoogies, setYourLoogies] = useState();

  const [loadingLoogies, setLoadingLoogies] = useState(true);
  // const [waitingForMove, setWaitingForMove] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 1;

  // Update user nfts
  useEffect(() => {
    //  loogies
    if (DEBUG) console.log("Updating loogies balance...");

    if (readContracts.Loogies) {
      async function fetchData() {
        // You can await here
        try {
          const { loogies, loogiesBalance } = await fetchLoogies(address, readContracts);
          setYourLoogies(loogies.reverse());
          setYourLoogiesBalance(loogiesBalance);
        } catch (error) {
          console.log("Error: ", error);
        }
        setLoadingLoogies(false);
      }
      fetchData();
    } else {
      if (DEBUG) console.log("Loogies contracts not defined yet.");
    }
  }, [address, readContracts]);

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (DEBUG && address && selectedChainId && balance && readContracts && writeContracts) {
      // console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      // console.log("🌎 mainnetProvider", mainnetProvider);
      // console.log("🏠 localChainId", localChainId);
      // console.log("👩‍💼 selected address:", address);
      // console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      // console.log("💵 balance", balance ? ethers.utils.formatEther(balance) : "...");
      // console.log("📝 readContracts", readContracts);
      // console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    address,
    selectedChainId,
    balance,
    readContracts,
    writeContracts,
    // mainnetContracts,
    localChainId,
  ]);

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
    // eslint-disable-next-line
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  // TODO: set initial state
  const [currentGame, setCurrentGame] = useState(false);

  const [playersData, setPlayersData] = useState();
  const [currentPlayerAddress, setCurrentPlayerAddress] = useState();

  // move to current player
  // const [playerCanMove, setPlayerCanMove] = useState(false);

  useEffect(() => {
    if (readContracts.Game) {
      const updatePlayersData = async () => {
        console.log("PARSING PLAYERS:::");
        try {
          if (data?.players && data?.players.length > 0) {
            let newPlayersData = {};
            for (const player of data.players) {
              const currentPosition = player;
              console.log("loading info for ", currentPosition);

              // TODO: review, save and get from state
              const tokenURI = await readContracts.Game.tokenURIOf(currentPosition.id);
              const jsonManifestString = Buffer.from(tokenURI.substring(29), "base64");
              const jsonManifest = JSON.parse(jsonManifestString);
              const playerId = currentPosition.id.toLowerCase();
              const currentPlayerAddress = {
                id: playerId,
                loogieId: currentPosition.loogieId,
                position: { x: currentPosition.x, y: currentPosition.y },
                ticker: parseInt(currentPosition.ticker),
                lastBlock: parseInt(currentPosition.lastBlock),
                updatedAt: parseInt(currentPosition.updatedAt),
                health: parseInt(currentPosition.health, 10),
                // cursed: currentPosition.cursed || false, the player is not cursed, the world is
                image: jsonManifest.image,
              };
              newPlayersData[playerId] = currentPlayerAddress;
            }
            console.log("final player info", newPlayersData);

            setPlayersData(newPlayersData);
          } else {
            console.log("No players data");
          }
        } catch (error) {
          console.log(error);
        }
      };

      updatePlayersData();
    } else {
      console.log("Contracts not defined yet.");
    }
  }, [data?.players, readContracts.Game]);

  useEffect(() => {
    // TODO: set initial state
    setCurrentGame(data?.games[data?.games.length - 1] || {});
  }, [data?.games]);

  useEffect(() => {
    if (playersData && address && playersData[address.toLowerCase()]) {
      setCurrentPlayerAddress(address.toLowerCase());
    }
  }, [playersData, address]);

  const [priceRightNow, setPriceRightNow] = useState(false);
  useEffect(() => {
    const setPriceRightNowAsync = async () => {
      if (readContracts.Loogies) {
        try {
          const priceRightNow = await readContracts.Loogies.price();
          // console.log(ethers.utils.formatEther(priceRightNow));
          setPriceRightNow(priceRightNow);
        } catch (error) {
          console.log(error);
        }
      }
    };

    setPriceRightNowAsync();
  }, [readContracts.Loogies]);

  const [canMint, setCanMint] = useState(false);
  useEffect(() => {
    if (balance && priceRightNow) {
      setCanMint(
        parseFloat(ethers.utils.formatEther(balance)).toFixed(2) >
          parseFloat(ethers.utils.formatEther(priceRightNow)).toFixed(2),
      );
    }
  }, [balance, priceRightNow]);

  // TODO: move to apollo subscription
  const [needsManualTicker, setNeedsManualTicker] = useState(false);
  useEffect(() => {
    const setNeedsManualTickerAsync = async () => {
      // update needsManualTicker when apollo is refetched
      if (readContracts.Game && networkStatus === NetworkStatus.refetch) {
        try {
          const needsManualTicker = await readContracts.Game.needsManualTicker();
          setNeedsManualTicker(needsManualTicker);
        } catch (error) {
          console.log(error);
        }
      }
    };

    setNeedsManualTickerAsync();
  }, [readContracts.Game, networkStatus]);

  const faucetAvailable = provider && provider.connection && targetNetwork.name.indexOf("local") !== -1;
  console.log("🚀 ~ file: App.jsx ~ line 422 ~ App ~ faucetAvailable", faucetAvailable);

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header
        link={"https://github.com/alexx855/loogie-royale-ethonline"}
        title={"⚔️ Loogie Royale"}
        subTitle={"A web3 battle royale game with loogies!"}
      >
        {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flex: 1 }}>
            {USE_NETWORK_SELECTOR && (
              <div style={{ marginRight: 20 }}>
                <NetworkSwitch
                  networkOptions={networkOptions}
                  selectedNetwork={selectedNetwork}
                  setSelectedNetwork={setSelectedNetwork}
                />
              </div>
            )}
            <Account
              useBurner={USE_BURNER_WALLET}
              address={address}
              minimized={false}
              localProvider={provider}
              userSigner={userSigner}
              mainnetProvider={provider}
              price={1}
              web3Modal={web3Modal}
              loadWeb3Modal={loadWeb3Modal}
              logoutOfWeb3Modal={logoutOfWeb3Modal}
              blockExplorer={blockExplorer}
            />
          </div>
        </div>
      </Header>
      {balance && balance.lte(ethers.BigNumber.from("0")) && (
        <FaucetHint
          localProvider={provider}
          targetNetwork={targetNetwork}
          address={address}
          value={ethers.utils.parseEther("1")}
        />
      )}

      <Menu style={{ textAlign: "center", marginTop: 20 }} selectedKeys={[location.pathname]} mode="horizontal">
        <Menu.Item key="/">
          <Link to="/">Game</Link>
        </Menu.Item>
        <Menu.Item key="/debug">
          <Link to="/debug">Debug Contracts</Link>
        </Menu.Item>
        <Menu.Item key="/subgraph">
          <Link to="/subgraph">Subgraph</Link>
        </Menu.Item>
      </Menu>

      <Switch>
        <Route exact path="/">
          {loading ? (
            <p>Loading graph...</p>
          ) : error ? (
            <p>Error loading graph</p>
          ) : (
            <>
              <div
                style={{
                  position: "relative",
                  // background: "rgba(0, 0, 0, 0.5)",
                  width: "100vw",
                  height: "auto",
                  display: "flex",
                  justifyContent: "space-between",
                  maxWidth: "800px",
                  overflow: "hidden",
                  // overflow: "visible",
                  margin: "1em auto",
                  padding: "2em",
                }}
              >
                {/* game UI and data */}
                <div
                  style={{
                    width: "270px",
                  }}
                >
                  {/* Game On */}
                  {currentGame && currentGame.gameOn === true ? (
                    <>
                      <Button
                        size="large"
                        shape="round"
                        style={{ marginBottom: "1em" }}
                        disabled={balance && balance.lte(ethers.BigNumber.from("0"))}
                        // disabled={!needsManualTicker}
                        onClick={async () => {
                          try {
                            setNeedsManualTicker(false);
                            await tx(writeContracts.Game.runTicker());
                            if (DEBUG) console.log("Updating game state onchain...");
                          } catch (error) {
                            console.log(error);
                            setNeedsManualTicker(true);
                          }
                        }}
                      >
                        Update
                      </Button>

                      {/* Game Over */}
                      {currentGame.winner !== "0x0000000000000000000000000000000000000000" ? (
                        <>
                          {currentGame.winner === currentPlayerAddress ? (
                            <h2 style={{ color: "green" }}>You won!</h2>
                          ) : (
                            <h2 style={{ color: "red" }}>You lost!</h2>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Current active Player */}
                          {currentPlayerAddress && playersData[currentPlayerAddress] ? (
                            <>
                              <h3>Connected as: {trimAddress(playersData[currentPlayerAddress]?.id)}</h3>
                              <p>
                                Playing Game #{currentGame.id} with loogie #
                                {playersData[currentPlayerAddress]?.loogieId}{" "}
                              </p>

                              {/* <ul
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  marginTop: "10px",
                                }}
                              >
                                <li>Health: {playersData[currentPlayerAddress]?.health} </li>
                                <li>
                                  Position:{" "}
                                  {`${playersData[currentPlayerAddress]?.position.x},${playersData[currentPlayerAddress]?.position.y}`}
                                </li>
                                <li>
                                  IsPositionCursed:{" "}
                                  {`${
                                    data.worldMatrixes.find(
                                      matrix =>
                                        matrix.player && matrix.player.id.toLowerCase() === currentPlayerAddress,
                                    )?.cursed === true
                                  }`}
                                </li>
                                <li>LastActionTick: {playersData[currentPlayerAddress]?.ticker} </li>
                                <li>LastActionTime: {playersData[currentPlayerAddress]?.updatedAt} </li>
                                <li>LastActionBlock: {playersData[currentPlayerAddress]?.lastBlock}</li>
                              </ul> */}
                            </>
                          ) : (
                            <>
                              {/*  Game On, But Not Current active Player */}
                              <h3>You're expecting game #{currentGame.id}</h3>
                              {/* <p>You are waiting for the game to end.</p> */}
                            </>
                          )}

                          {currentGame && (
                            <>
                              <ul
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                }}
                              >
                                {/* <li>gameOn: {`${currentGame.gameOn}`}</li> */}
                                <li>Ticker: {currentGame.ticker}</li>
                                <li>Current block: {currentGame.block}</li>
                                <li>
                                  Winner: {`${currentGame.winner !== "0x0000000000000000000000000000000000000000"}`}
                                </li>
                                <li>
                                  Players alive:{" "}
                                  {playersData && Object.values(playersData).filter(p => p.health > 0).length}{" "}
                                </li>
                                <li>
                                  Endgame:{" "}
                                  {playersData && Object.values(playersData).filter(p => p.health > 0).length <= 1
                                    ? "true"
                                    : "false"}
                                </li>
                                <li>createdAt: {currentGame.createdAt}</li>
                                <li>updatedAt: {currentGame.updatedAt}</li>
                                <li>curseInterval: {currentGame.curseInterval}</li>
                                <li>curseNextGameTicker: {currentGame.curseNextGameTicker}</li>
                                <li>curseDropCount: {currentGame.curseDropCount}</li>
                                <li>
                                  NextCurseIn:{" "}
                                  {currentGame.ticker >= currentGame.curseNextGameTicker
                                    ? "next update"
                                    : `in ${currentGame.curseNextGameTicker - currentGame.ticker} ticks`}
                                </li>
                                <li>needsManualTicker: {`${needsManualTicker}`}</li>
                              </ul>
                            </>
                          )}
                          {playersData && (
                            <>
                              <h3>Players: </h3>

                              <ul
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                }}
                              >
                                {Object.keys(playersData).map(player => (
                                  <li key={player}>
                                    <strong>
                                      {trimAddress(player)}: {playersData[player]?.loogieId}
                                    </strong>
                                    <br />
                                    {/* <strong>health:</strong> {playersData[player]?.health} <br /> */}
                                    {/* <strong>position:</strong>{" "}
                                    {`${playersData[player]?.position.x},${playersData[player]?.position.y}`} <br /> */}
                                    <strong>ticker:</strong> {`${playersData[player]?.ticker}`} <br />
                                    <strong>updatedAt:</strong> {`${playersData[player]?.updatedAt}`} <br />
                                    <strong>lastBlock:</strong> {`${playersData[player]?.lastBlock}`}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Game Off, waiting for other players */}
                      {/* <h2>lala</h2> */}
                      {!currentGame ||
                        (currentGame && currentGame.gameOn === false && (
                          <>
                            <h3
                              style={{
                                fontSize: "1em",
                                // textAlign: "left",
                                paddingLeft: "0.5em",
                                paddingRight: "0.5em",
                              }}
                            >
                              Waiting for {MAX_PLAYERS - data.worldMatrixes.filter(world => world.player).length} more
                              players{" "}
                            </h3>
                            {priceRightNow && address && readContracts && (
                              <div style={{ margin: "1em 0" }}>
                                <Button
                                  size="large"
                                  type="primary"
                                  shape="round"
                                  disabled={!canMint}
                                  onClick={async () => {
                                    try {
                                      setLoadingLoogies(true);

                                      await tx(writeContracts.Loogies.mintItem({ value: priceRightNow }));
                                      const { loogies, loogiesBalance } = await fetchLoogies(address, readContracts);

                                      if (loogies && loogies.length > 0) {
                                        setYourLoogies(loogies.reverse());
                                      }

                                      if (loogiesBalance) {
                                        setYourLoogiesBalance(loogiesBalance);
                                      }
                                    } catch (error) {
                                      console.log("🚀 ~ file: App.jsx ~ line 673 ~ onClick={ ~ error", error);
                                    }

                                    setLoadingLoogies(false);
                                  }}
                                >
                                  Mint loogie for Ξ {ethers.utils.formatEther(priceRightNow)}
                                </Button>
                              </div>
                            )}

                            {!canMint && priceRightNow && balance && (
                              <div>
                                <Button
                                  size="large"
                                  type="secondary"
                                  shape="round"
                                  onClick={() => {
                                    new RampInstantSDK({
                                      hostAppName: "scaffold-eth",
                                      hostLogoUrl: "https://scaffoldeth.io/scaffold-eth.png",
                                      swapAmount: priceRightNow, // 0.001 ETH in wei  ?
                                      swapAsset: "ETH", // review, it should be OETH
                                      userAddress: address,
                                    })
                                      .on("*", event => console.log(event))
                                      .show();
                                  }}
                                >
                                  Deposit using ramp
                                </Button>

                                {DEBUG && (
                                  <p>
                                    You need Ξ {ethers.utils.formatEther(priceRightNow)} to mint a Loogie and you have Ξ
                                    {ethers.utils.formatEther(balance)}
                                  </p>
                                )}
                              </div>
                            )}

                            <div id="your-loogies">
                              {yourLoogies && yourLoogies.length === 0 && (
                                <div>
                                  <h4>You need a loogie to register</h4>
                                </div>
                              )}

                              <div>
                                <List
                                  grid={{
                                    gutter: 1,
                                    xs: 1,
                                    sm: 1,
                                    md: 1,
                                    lg: 1,
                                    xl: 1,
                                    xxl: 1,
                                  }}
                                  pagination={{
                                    total: yourLoogiesBalance,
                                    defaultPageSize: perPage,
                                    defaultCurrent: page,
                                    simple: true,
                                    onChange: currentPage => {
                                      setPage(currentPage);
                                    },
                                  }}
                                  loading={loadingLoogies}
                                  dataSource={yourLoogies}
                                  renderItem={item => {
                                    const id = item.id.toNumber();

                                    return (
                                      <List.Item key={id + "_" + item.uri + "_" + item.owner}>
                                        <Card
                                          style={
                                            {
                                              // backgroundColor: "#b3e2f4",
                                              // border: "1px solid #0071bb",
                                              // borderRadius: 10,
                                              // marginRight: 10,
                                            }
                                          }
                                          headStyle={{ paddingRight: 12, paddingLeft: 12 }}
                                          title={
                                            <div>
                                              <span style={{ fontSize: 16, marginRight: 8 }}>{item.name}</span>

                                              {/* TODO: handle unregister */}
                                              {playersData &&
                                              playersData[currentPlayerAddress]?.loogieId.toString() ===
                                                id.toString() ? (
                                                <Button
                                                  size="large"
                                                  shape="round"
                                                  disabled={true}
                                                  style={{ marginBottom: "1em" }}
                                                  // onClick={async () => {
                                                  //   setLoadingLoogies(true);
                                                  //   tx(writeContracts.Game.unregister(currentGame.id)).then(async () => {
                                                  //     setLoadingLoogies(false);
                                                  //   });
                                                  // }}
                                                >
                                                  Leave game
                                                </Button>
                                              ) : (
                                                <Button
                                                  size="large"
                                                  shape="round"
                                                  disabled={
                                                    (currentGame && currentGame.gameOn) ||
                                                    (playersData &&
                                                      typeof playersData[currentPlayerAddress] !== "undefined")
                                                  }
                                                  onClick={async () => {
                                                    console.log();
                                                    try {
                                                      setLoadingLoogies(true);
                                                      await tx(writeContracts.Game.register(id));
                                                      if (DEBUG) console.log("Updating active player...");
                                                    } catch (error) {
                                                      console.log(
                                                        "🚀 ~ file: App.jsx ~ line 621 ~ onClick={ ~ error",
                                                        error,
                                                      );
                                                      setLoadingLoogies(false);
                                                    }
                                                  }}
                                                >
                                                  Register
                                                </Button>
                                              )}
                                            </div>
                                          }
                                        >
                                          <img
                                            style={{ maxWidth: "100%" }}
                                            alt={item.id}
                                            src={item.image}
                                            width="auto"
                                          />

                                          {/* TODO: show games played, wins and loses */}
                                          <div style={{ padding: 4 }}>
                                            <div>
                                              <span style={{ fontSize: 16, marginRight: 8 }}>
                                                {item.description || "TODO"}
                                              </span>
                                            </div>
                                          </div>
                                        </Card>
                                      </List.Item>
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          </>
                        ))}
                      {/* Not current game here */}
                    </>
                  )}
                </div>
                {/* end ui data */}

                {/* world matrix container */}
                <div
                  style={{
                    // color: "#111111",
                    // fontWeight: "bold",
                    width: 7 * BOX_SIZE,
                    height: 7 * BOX_SIZE,
                    position: "relative",
                    // top: "50%",
                    // left: "50%",
                    // marginTop: (-height * BOX_SIZE) / 2,
                    // marginLeft: (-width * BOX_SIZE) / 2,
                    // backgroundColor: "#b3e2f4",
                    opacity: !currentGame || !currentGame.gameOn ? 0.5 : 1,
                    // zIndex: 1,
                    // overflow: "visible",
                  }}
                >
                  {/* world matrix */}
                  {data.worldMatrixes.map((world, index) => {
                    const { x, y, player, healthAmountToCollect, cursed } = world;

                    // check if is the end of the game, gameOn and no live players or only one live player
                    const endGame =
                      currentGame &&
                      currentGame.gameOn &&
                      playersData &&
                      Object.values(playersData).filter(p => p.health > 0).length <= 1;

                    const canMoveHere =
                      currentPlayerAddress &&
                      // data.worldMatrixes.find(world => world.id === `${x}-${y}`)?.cursed === false &&
                      playersData[currentPlayerAddress]?.health > 0 &&
                      !(
                        playersData[currentPlayerAddress]?.position?.x === x &&
                        playersData[currentPlayerAddress]?.position?.y === y
                      ) &&
                      data.worldMatrixes.find(world => world.id === `${x}-${y}`)?.player === null;

                    const canAttackHere =
                      currentPlayerAddress &&
                      playersData[currentPlayerAddress]?.health > 0 &&
                      !(
                        playersData[currentPlayerAddress]?.position?.x === x &&
                        playersData[currentPlayerAddress]?.position?.y === y
                      ) &&
                      !(data.worldMatrixes.find(world => world.id === `${x}-${y}`)?.player === null) &&
                      data.worldMatrixes.find(world => world.id === `${x}-${y}`)?.player?.health > 0;

                    const hasHealthHere = parseInt(healthAmountToCollect, 10) > 0;

                    return (
                      <div
                        key={`${index}-${x}-${y}`}
                        style={{
                          width: BOX_SIZE,
                          height: BOX_SIZE,
                          // padding: 1,
                          position: "absolute",
                          left: BOX_SIZE * x,
                          top: BOX_SIZE * y,
                          // overflow: "visible",
                          background:
                            currentPlayerAddress &&
                            player &&
                            currentPlayerAddress === player.id &&
                            playersData[currentPlayerAddress]?.health > 0
                              ? "#00ff00"
                              : cursed
                              ? "red"
                              : (x + y) % 2
                              ? "#BBBBBB"
                              : "#EEEEEE",
                          // cursor: canMoveHere ? "pointer" : "not-allowed",
                          // zIndex: 1,
                        }}
                        className="world-box"
                      >
                        {player && player.health > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              paddingBottom: 2,
                              textAlign: "center",
                              width: "100%",
                              fontSize: "1.1rem",
                              lineHeight: 1,
                              color: "red",
                              fontWeight: "bold",
                              textShadow: "0 0 5px black",
                              zIndex: 1,
                            }}
                          >
                            {player.health}
                          </span>
                        )}

                        {healthAmountToCollect && healthAmountToCollect > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              paddingBottom: 2,
                              textAlign: "center",
                              width: "100%",
                              fontSize: "1.1rem",
                              lineHeight: 1,
                              color: "white",
                              fontWeight: "bold",
                              textShadow: "0 0 5px black",
                              zIndex: 1,
                            }}
                          >
                            {healthAmountToCollect}
                          </span>
                        )}

                        {/* TODO: save image url to the graph when user register ?? */}
                        {player && player.id && playersData && playersData[player.id]?.image && (
                          <img
                            alt={player.id}
                            src={playersData[player.id].image}
                            style={{
                              // transform: "scale(2, 2)",
                              width: "100%",
                              height: "100%",
                              // top: -20,
                              position: "relative",
                              // left: 0,
                              // zIndex: 3,
                              filter: player.health <= 0 ? "grayscale(100%)" : "",
                              opacity: player.health <= 0 ? 0.5 : 1,
                              transform: player.health <= 0 ? "rotate(180deg)" : "",
                            }}
                          />
                        )}

                        {hasHealthHere > 0 && (
                          <img
                            alt="Health"
                            src="Health_Full.svg"
                            style={{
                              // transform: "scale(3, 3)",
                              width: "100%",
                              height: "100%",
                              // top: -20,
                              position: "relative",
                              // left: 0,
                              // zIndex: 3,
                            }}
                          />
                        )}

                        {currentGame.gameOn && !endGame && (
                          <div
                            // style={{
                            //   background: canMoveHere
                            //     ? "var(--antd-wave-shadow-color)"
                            //     : canAttackHere
                            //     ? "red"
                            //     : "transparent",
                            // }}
                            className={`move ${canMoveHere ? "can-move" : ""} ${canAttackHere ? "can-attack" : ""} ${
                              hasHealthHere ? "has-health" : ""
                            }`}
                            onClick={async () => {
                              console.log("clicked", x, y);

                              // const canMoveHere =
                              //   currentPlayerAddress &&
                              //   playersData[currentPlayerAddress]?.position?.x !== x &&
                              //   playersData[currentPlayerAddress]?.position?.y !== y &&
                              //   playersData[currentPlayerAddress]?.health > 0;

                              console.log(
                                "🚀 ~ file: App.jsx ~ line 835 ~ {data.worldMatrixes.map ~ canMoveHere",
                                canMoveHere,
                              );
                              // const canAttackHere =
                              //   currentPlayerAddress &&
                              //   data.worldMatrixes.find(world => world.id === `${x}-${y}`)?.player;

                              console.log(
                                "🚀 ~ file: App.jsx ~ line 841 ~ {data.worldMatrixes.map ~ canAttackHere",
                                canAttackHere,
                              );

                              if (!canMoveHere && !canAttackHere) return;

                              try {
                                // setWaitingForMove(true);
                                await tx(writeContracts.Game.move(x, y));
                                if (DEBUG) console.log("User move to ", x, y);
                              } catch (error) {
                                console.log("🚀 ~ file: App.jsx ~ line 621 ~ onClick={ ~ error", error);
                                // setWaitingForMove(false);
                              }
                            }}
                          >
                            {/* <span style={{ marginLeft: 3 }}>{"" + x + "," + y}</span> */}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Route>

        <Route exact path="/debug">
          <Contract
            name="Game"
            // price={price}
            signer={userSigner}
            provider={provider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
          <Contract
            name="Loogies"
            // price={price}
            signer={userSigner}
            provider={provider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
        </Route>

        <Route path="/subgraph">
          <Subgraph
            subgraphUri={props.subgraphUri}
            tx={tx}
            writeContracts={writeContracts}
            mainnetProvider={provider}
          />
        </Route>
      </Switch>

      <ThemeSwitch />

      {/* {faucetAvailable && (
        <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
          <Faucet localProvider={provider} price={1} />
        </div>
      )} */}
    </div>
  );
}

export default App;
