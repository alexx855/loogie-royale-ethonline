// BLOCKNATIVE ID FOR Notify.js:
export const BLOCKNATIVE_DAPPID = "712b3909-ae23-4a19-ada1-b352967b0c94";

const localRpcUrl = process.env.REACT_APP_CODESPACES
  ? `https://${window.location.hostname.replace("3000", "8545")}`
  : "http://" + (global.window ? window.location.hostname : "localhost") + ":8545";

export const NETWORKS = {
  localhost: {
    name: "localhost",
    color: "#666666",
    chainId: 31337,
    blockExplorer: "",
    rpcUrl: localRpcUrl,
  },
  localOptimismL1: {
    name: "localOptimismL1",
    color: "#f01a37",
    chainId: 31337,
    blockExplorer: "",
    rpcUrl: "http://" + (global.window ? window.location.hostname : "localhost") + ":9545",
  },
  localOptimism: {
    name: "localOptimism",
    color: "#f01a37",
    chainId: 420,
    blockExplorer: "",
    rpcUrl: "http://" + (global.window ? window.location.hostname : "localhost") + ":8545",
    gasPrice: 0,
  },
  optimism: {
    name: "optimism",
    color: "#f01a37",
    chainId: 10,
    blockExplorer: "https://optimistic.etherscan.io/",
    rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/HEDy1DXIQw-JXfwdkTbTqa2kK-0-jh5S`,
  },
  polygon: {
    name: "polygon",
    color: "#2bbdf7",
    chainId: 137,
    price: 1,
    gasPrice: 1000000000,
    rpcUrl: "https://polygon-mainnet.g.alchemy.com/v2/T5KTLLvEmtGGqhg-sy59pzBH8iG1ijbP",
    blockExplorer: "https://polygonscan.com/",
  },
  mumbai: {
    name: "mumbai",
    color: "#92D9FA",
    chainId: 80001,
    price: 1,
    gasPrice: 1000000000,
    rpcUrl: "https://polygon-mumbai.g.alchemy.com/v2/OuKuSf4dYfAXSmtDgLnJR67hlcSjxL-u",
    faucet: "https://faucet.polygon.technology/",
    blockExplorer: "https://mumbai.polygonscan.com/",
  },
};

export const NETWORK = chainId => {
  for (const n in NETWORKS) {
    if (NETWORKS[n].chainId === chainId) {
      return NETWORKS[n];
    }
  }
};
