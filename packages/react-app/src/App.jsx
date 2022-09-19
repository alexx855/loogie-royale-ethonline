import { Button, Col, Row, Card, List, Menu, Tooltip } from "antd";
// import Blockies from "react-blockies";
import "antd/dist/antd.css";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import React, { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "react-router-dom";
import "./App.css";
import {
  Account,
  Contract,
  Faucet,
  GasGauge,
  Header,
  Ramp,
  ThemeSwitch,
  NetworkDisplay,
  FaucetHint,
  NetworkSwitch,
} from "./components";
import { NETWORKS, ALCHEMY_KEY } from "./constants";
import externalContracts from "./contracts/external_contracts";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import { Transactor, Web3ModalSetup } from "./helpers";
import { Home, ExampleUI, Hints, Subgraph } from "./views";
import { useStaticJsonRPC } from "./hooks";
import { gql, useQuery } from "@apollo/client";

function trimAddress(address) {
  // return address;
  return "0x" + address.slice(2, 5) + "..." + address.substring(address.length - 3, address.length);
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
const INI_HEALTH = 100;

const { ethers } = require("ethers");
/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/scaffold-eth/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Alchemy.com & Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/

/// 📡 What chain are your contracts deployed to?
const initialNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
const NETWORKCHECK = true;
const USE_BURNER_WALLET = true; // toggle burner wallet feature
const USE_NETWORK_SELECTOR = false;

const web3Modal = Web3ModalSetup();

// 🛰 providers
const providers = [
  "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
  `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
  "https://rpc.scaffoldeth.io:48544",
];

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
  console.log("🚀 ~ file: App.jsx ~ line 123 ~ App ~ selectedNetwork", selectedNetwork);

  // 🔭 block explorer URL
  const blockExplorer = targetNetwork.blockExplorer;

  // load all your providers
  const localProvider = useStaticJsonRPC([
    process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : targetNetwork.rpcUrl,
  ]);
  const mainnetProvider = useStaticJsonRPC(providers);

  // if (DEBUG) console.log(`Using ${selectedNetwork} network`);

  // 🛰 providers
  if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider, USE_BURNER_WALLET);
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
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, block => {
    console.log("🚀 ~ file: App.jsx ~ line 201 ~ useOnBlock ~ block", block);

    // setGameBlock(localProvider._lastBlockNumber);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  // const { gameBlock, setGameBlock } = useState(10);

  // keep track of a variable from the contract in the local React state:
  const purpose = useContractReader(readContracts, "YourContract", "purpose");
  const width = 7; // TODO: get from contract
  const height = 7; // TODO: get from contract

  const WORLD_QUERY_GRAPHQL = `
  {
    games {
      id,
      ticker,
      height,
      width,
      restart,
      winner,
      nextCurse,
      gameOn,
      createdAt,
      curseCount
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
        health,
        lastActionTick,
        lastActionBlock,
        lastActionTime
      }
    }
  }
  `;
  const WORLD_QUERY_GQL = gql(WORLD_QUERY_GRAPHQL);
  const { loading, error, data, refetch } = useQuery(WORLD_QUERY_GQL, {
    pollInterval: 1000,
    // pollInterval: 2500,
    fetchPolicy: "network-only", // Doesn't check cache before making a network request
    // notifyOnNetworkStatusChange: true,
  });

  const [yourLoogiesBalance, setYourLoogiesBalance] = useState(0);
  const [yourLoogies, setYourLoogies] = useState();

  const [loadingLoogies, setLoadingLoogies] = useState(true);
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

  const [playersData, setPlayersData] = useState();
  const [currentPlayer, setCurrentPlayer] = useState();

  useEffect(() => {
    const updatePlayersData = async () => {
      if (readContracts.Game) {
        console.log("PARSE PLAYERS:::");
        try {
          let playersData = {};

          if (data && data.worldMatrixes?.length > 0) {
            const playersData = data.worldMatrixes.filter(world => world.player);
            for (let players in playersData) {
              const currentPosition = playersData[players];
              console.log("loading info for ", currentPosition);
              // TODO: review, save and get from state
              const tokenURI = await readContracts.Game.tokenURIOf(currentPosition.player.id);
              const jsonManifestString = Buffer.from(tokenURI.substring(29), "base64");
              const jsonManifest = JSON.parse(jsonManifestString);

              const currentPlayer = {
                id: currentPosition.player.id,
                loogieId: currentPosition.player.loogieId,
                position: { x: currentPosition.x, y: currentPosition.y },
                lastActionTick: parseInt(currentPosition.player.lastActionTick),
                lastActionBlock: parseInt(currentPosition.player.lastActionBlock),
                lastActionTime: parseInt(currentPosition.player.lastActionTime),
                health: parseInt(currentPosition.player.health) || INI_HEALTH,
                cursed: currentPosition.player.cursed || false,
                image: jsonManifest.image,
              };
              playersData[currentPosition.player.id] = currentPlayer;
              if (address && currentPosition.player.id.toLowerCase() === address.toLowerCase()) {
                setCurrentPlayer(currentPlayer);
              }
            }
          } else {
            console.log("No players data");
          }
          console.log("final player info", playersData);
          setPlayersData(playersData);
        } catch (error) {
          console.log(error);
        }
      } else {
        console.log("Contracts not defined yet.");
      }
    };
    updatePlayersData();
  }, [address, data, readContracts.Game]);

  const s = 64;
  const squareW = s;
  const squareH = s;

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
    localChainId,
    myMainnetDAIBalance,
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

  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const [currentGame, setCurrentGame] = useState([{}]);
  // const [players, setPlayers] = useState([]);
  // const [playerCanMove, setPlayerCanMove] = useState(false);

  // review this logic
  useEffect(() => {
    const game = data?.games[0] || {};
    // const players = data?.players || [];
    // const playerCanMove = !(
    //   (
    //     currentPlayer &&
    //     currentPlayer?.health > 0 &&
    //     game.gameOn &&
    //     data.worldMatrixes[currentPlayer.position.x][currentPlayer.position.y].cursed === false
    //   )
    //   // && game.ticker > currentPlayer?.lastAction
    // );
    setCurrentGame(game);
    // setPlayers(players);
    // setPlayerCanMove(playerCanMove);
  }, [setCurrentGame]);

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header>
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
              localProvider={localProvider}
              userSigner={userSigner}
              mainnetProvider={mainnetProvider}
              price={price}
              web3Modal={web3Modal}
              loadWeb3Modal={loadWeb3Modal}
              logoutOfWeb3Modal={logoutOfWeb3Modal}
              blockExplorer={blockExplorer}
            />
          </div>
        </div>
      </Header>
      {yourLocalBalance.lte(ethers.BigNumber.from("0")) && (
        <FaucetHint localProvider={localProvider} targetNetwork={targetNetwork} address={address} />
      )}
      <NetworkDisplay
        NETWORKCHECK={NETWORKCHECK}
        localChainId={localChainId}
        selectedChainId={selectedChainId}
        targetNetwork={targetNetwork}
        logoutOfWeb3Modal={logoutOfWeb3Modal}
        USE_NETWORK_SELECTOR={USE_NETWORK_SELECTOR}
      />
      <Menu style={{ textAlign: "center", marginTop: 20 }} selectedKeys={[location.pathname]} mode="horizontal">
        <Menu.Item key="/">
          <Link to="/">App Home</Link>
        </Menu.Item>
        <Menu.Item key="/play">
          <Link to="/play">Play</Link>
        </Menu.Item>
        <Menu.Item key="/debug">
          <Link to="/debug">Debug Contracts</Link>
        </Menu.Item>
        <Menu.Item key="/hints">
          <Link to="/hints">Hints</Link>
        </Menu.Item>
        <Menu.Item key="/exampleui">
          <Link to="/exampleui">ExampleUI</Link>
        </Menu.Item>
        <Menu.Item key="/mainnetdai">
          <Link to="/mainnetdai">Mainnet DAI</Link>
        </Menu.Item>
        <Menu.Item key="/subgraph">
          <Link to="/subgraph">Subgraph</Link>
        </Menu.Item>
      </Menu>

      <Switch>
        <Route exact path="/">
          {/* pass in any web3 props to this Home component. For example, yourLocalBalance */}
          <Home yourLocalBalance={yourLocalBalance} readContracts={readContracts} />
        </Route>

        <Route exact path="/play">
          {loading ? (
            <p>Loading graph...</p>
          ) : error ? (
            <p>Error loading graph</p>
          ) : (
            <>
              {/* not current player and not playing, so its waiting for player to start a new game */}
              {!currentPlayer && !currentGame.gameOn ? (
                <div>
                  <div style={{ padding: 0, margin: "2rem" }}>
                    {loadingLoogies || (yourLoogies && yourLoogies.length > 0) ? (
                      <div id="your-loogies" style={{ paddingTop: 20 }}>
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
                              onChange: currentPage => {
                                setPage(currentPage);
                              },
                              showTotal: (total, range) => `${range[0]}-${range[1]} of ${yourLoogiesBalance} items`,
                            }}
                            loading={loadingLoogies}
                            dataSource={yourLoogies}
                            renderItem={item => {
                              const id = item.id.toNumber();

                              return (
                                <List.Item key={id + "_" + item.uri + "_" + item.owner}>
                                  <Card
                                    style={{
                                      backgroundColor: "#b3e2f4",
                                      border: "1px solid #0071bb",
                                      borderRadius: 10,
                                      marginRight: 10,
                                    }}
                                    headStyle={{ paddingRight: 12, paddingLeft: 12 }}
                                    title={
                                      <div>
                                        <span style={{ fontSize: 16, marginRight: 8 }}>{item.name}</span>
                                        <Button
                                          size="large"
                                          shape="round"
                                          disabled={currentGame && currentGame.gameOn}
                                          onClick={async () => {
                                            setLoadingLoogies(true);
                                            tx(writeContracts.Game.register(id)).then(async () => {
                                              if (DEBUG) console.log("Updating active player...");
                                              refetch();
                                              // setLoadingLoogies(false);
                                            });
                                          }}
                                        >
                                          Register
                                        </Button>
                                      </div>
                                    }
                                  >
                                    <img alt={item.id} src={item.image} width="240" />

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
                    ) : (
                      <div style={{ minHeight: 200, fontSize: 30 }}>
                        <Card
                          style={{
                            backgroundColor: "#b3e2f4",
                            border: "1px solid #0071bb",
                            borderRadius: 10,
                            marginRight: 10,
                          }}
                          title={
                            <div>
                              <span style={{ fontSize: 18, marginRight: 8, fontWeight: "bold" }}>
                                Want to play? you need a Loogie!
                              </span>
                            </div>
                          }
                        >
                          <div>
                            <p>
                              You can mint a <strong>Loogie</strong> here
                            </p>
                            <p>
                              <Button
                                size="large"
                                shape="round"
                                onClick={async () => {
                                  const priceRightNow = await readContracts.Loogies.price();
                                  // console.log(priceRightNow);
                                  setLoadingLoogies(true);

                                  tx(writeContracts.Loogies.mintItem({ value: priceRightNow }), async function () {
                                    try {
                                      const { loogies, loogiesBalance } = await fetchLoogies(address, readContracts);
                                      setYourLoogies(loogies.reverse());
                                      setYourLoogiesBalance(loogiesBalance);
                                    } catch (error) {
                                      console.log("🚀 ~ file: App.jsx ~ line 794 ~ error", error);
                                    }

                                    setLoadingLoogies(false);
                                  });
                                }}
                              >
                                Mint
                              </Button>
                            </p>
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // we have a current player, or the game is on
                <div
                  style={{
                    position: "relative",
                    background: "rgba(0,0,0,0.5)",
                    // right: 0,
                    // top: 0,
                    width: "100vw",
                    height: "100vh",
                    overflow: "hidden",
                    // zIndex: 9,
                  }}
                >
                  {/* game UI and data */}
                  <div
                    style={{
                      position: "absolute",
                      // backgroundColor: "#b3e2f4",
                      top: "0",
                      left: "0",
                      width: "270px",
                      zIndex: 11,
                    }}
                  >
                    {/* Player related data */}
                    {currentPlayer && currentPlayer.id ? (
                      <>
                        {playersData && playersData[currentPlayer.id] ? (
                          <img
                            alt={currentPlayer.id}
                            src={playersData[currentPlayer.id]?.image.image}
                            style={{
                              transform: "scale(3, 3)",
                              width: "100%",
                              height: "100%",
                              top: -20,
                              position: "absolute",
                              left: 0,
                              zIndex: 3,
                            }}
                          />
                        ) : null}

                        <ul
                          style={{
                            width: "100%",
                            textAlign: "left",
                            marginTop: "10px",
                          }}
                        >
                          <li>Game ID: {currentGame && currentGame.id ? currentGame.id : "no game"} </li>
                          <li>Playing: {currentGame && currentGame.gameOn ? "yes" : "no"} </li>
                          <li>Player: {trimAddress(currentPlayer.id)} </li>
                          <li>Loogie/Token ID: {currentPlayer.loogieId} </li>
                          <li>Health: {currentPlayer.health} </li>
                          <li>Cursed: {`${currentPlayer.cursed}`}</li>
                          <li>Position: {`${currentPlayer.position.x},${currentPlayer.position.y}`}</li>
                          <li>LastActionTick: {currentPlayer.lastActionTick} </li>
                          <li>LastActionTime: {currentPlayer.lastActionTime} </li>
                          <li>LastActionBlock: {currentPlayer.lastActionBlock}</li>
                        </ul>
                      </>
                    ) : null}

                    {/* Game related data */}
                    {currentGame && currentGame.gameOn ? (
                      <>
                        <ul
                          style={{
                            width: "100%",
                            textAlign: "left",
                          }}
                        >
                          {currentGame.winner !== "0x0000000000000000000000000000000000000000" ? (
                            <li>Las Winner: {`${currentGame.winner}`}</li>
                          ) : null}
                          <li>Ticker: {currentGame.ticker}</li>
                          <li>NextCurse: {currentGame.nextCurse}</li>
                          <li>NextCurseIn: {currentGame.ticker - currentGame.nextCurse}</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        {/* There is a game, but it has not started yet */}
                        <h3 style={{ fontSize: "1.5em", paddingLeft: "0.5em", paddingRight: "0.5em" }}>
                          Waiting for {MAX_PLAYERS - data.worldMatrixes.filter(world => world.player).length} players{" "}
                        </h3>

                        {/* TODO: handle unregister */}

                        {currentGame.id && currentGame.gameOn === false && (
                          <Button
                            size="large"
                            shape="round"
                            disabled={currentGame && currentGame.gameOn}
                            style={{ marginBottom: "1em" }}
                            onClick={async () => {
                              // setLoadingLoogies(true);
                              // tx(writeContracts.Game.unregister(currentGame.id)).then(async () => {
                              //   setLoadingLoogies(false);
                              // });
                            }}
                          >
                            Leave game {currentGame.id}
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {/* world matrix container */}
                  <div
                    style={{
                      color: "#111111",
                      fontWeight: "bold",
                      width: width * squareW,
                      height: height * squareH,
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      marginTop: (-height * squareH) / 2,
                      marginLeft: (-width * squareW) / 2,
                      backgroundColor: "#b3e2f4",
                      opacity: !currentGame || !currentGame.gameOn ? 0.5 : 1,
                      zIndex: 1,
                    }}
                  >
                    {/* world matrix */}
                    {data.worldMatrixes.map((world, index) => {
                      const { x, y, player, healthAmountToCollect, cursed } = world;
                      console.log("🚀 ~ file: App.jsx ~ line 766 ~ {data.worldMatrixes.map ~ cursed", cursed);

                      const healthHere = parseInt(healthAmountToCollect);

                      return (
                        <div
                          key={`${index}-${x}-${y}`}
                          style={{
                            width: squareW,
                            height: squareH,
                            // padding: 1,
                            position: "absolute",
                            left: squareW * x,
                            top: squareH * y,
                            overflow: "visible",
                            background: (x + y) % 2 ? "#BBBBBB" : "#EEEEEE",
                          }}
                        >
                          {player && (
                            <>
                              <Tooltip title={`${player.id}  `}>
                                <span
                                  style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    textAlign: "center",
                                    width: "100%",
                                    fontSize: "1.5rem",
                                    color: "red",
                                    fontWeight: "bold",
                                    textShadow: "0 0 5px black",
                                    zIndex: 4,
                                  }}
                                >
                                  {player.health}
                                </span>
                              </Tooltip>
                              {/* TODO: save image url to the graph ?? */}
                              {playersData && playersData[player.id]?.image ? (
                                <img
                                  alt={player.id}
                                  src={playersData[player.id].image}
                                  style={{
                                    transform: "scale(3, 3)",
                                    width: "100%",
                                    height: "100%",
                                    top: -20,
                                    position: "absolute",
                                    left: 0,
                                    zIndex: 3,
                                  }}
                                />
                              ) : null}
                            </>
                          )}
                          <div
                            style={{
                              position: "absolute",
                              height: "100%",
                              width: "100%",
                              left: 0,
                              top: 0,
                              zIndex: 2,
                              background: cursed
                                ? "red"
                                : currentPlayer &&
                                  player &&
                                  currentPlayer.id?.toLowerCase() === player.id?.toLowerCase()
                                ? "#00ff00"
                                : "transparent",
                              boxSizing: "content-box",
                              overflow: "hidden",
                            }}
                          >
                            {healthHere ? (
                              <Tooltip title={`${healthHere} health here`}>
                                <img
                                  alt="Health"
                                  src="Health_Full.svg"
                                  style={{
                                    width: "70%",
                                    height: "70%",
                                  }}
                                />
                              </Tooltip>
                            ) : null}
                            <span style={{ marginLeft: 3 }}>{"" + x + "," + y}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </Route>

        <Route exact path="/debug">
          {/*
                🎛 this scaffolding is full of commonly used components
                this <Contract/> component will automatically parse your ABI
                and give you a form to interact with it locally
            */}

          <Contract
            name="Game"
            price={price}
            signer={userSigner}
            provider={localProvider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
          <Contract
            name="Loogies"
            price={price}
            signer={userSigner}
            provider={localProvider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
          <Contract
            name="YourContract"
            price={price}
            signer={userSigner}
            provider={localProvider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
        </Route>
        <Route path="/hints">
          <Hints
            address={address}
            yourLocalBalance={yourLocalBalance}
            mainnetProvider={mainnetProvider}
            price={price}
          />
        </Route>
        <Route path="/exampleui">
          <ExampleUI
            address={address}
            userSigner={userSigner}
            mainnetProvider={mainnetProvider}
            localProvider={localProvider}
            yourLocalBalance={yourLocalBalance}
            price={price}
            tx={tx}
            writeContracts={writeContracts}
            readContracts={readContracts}
            purpose={purpose}
          />
        </Route>
        <Route path="/mainnetdai">
          <Contract
            name="DAI"
            customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.DAI}
            signer={userSigner}
            provider={mainnetProvider}
            address={address}
            blockExplorer="https://etherscan.io/"
            contractConfig={contractConfig}
            chainId={1}
          />
          {/*
            <Contract
              name="UNI"
              customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.UNI}
              signer={userSigner}
              provider={mainnetProvider}
              address={address}
              blockExplorer="https://etherscan.io/"
            />
            */}
        </Route>
        <Route path="/subgraph">
          <Subgraph
            subgraphUri={props.subgraphUri}
            tx={tx}
            writeContracts={writeContracts}
            mainnetProvider={mainnetProvider}
          />
        </Route>
      </Switch>

      <ThemeSwitch />

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
