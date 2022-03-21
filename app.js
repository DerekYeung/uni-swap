// import { Pool } from "@uniswap/v3-sdk";

// import { ethers } from "ethers";
// import Web3WsProvider from 'web3-providers-ws';

const { Pool } = require("@uniswap/v3-sdk");
const { ethers } = require('ethers');
const Web3WsProvider = require('web3-providers-ws');
const { AlphaRouter } = require("@uniswap/smart-order-router");
const { Token, CurrencyAmount } = require('@uniswap/sdk-core');

const w3p = new Web3WsProvider('ws://43.129.225.40:7892', {
  clientConfig: {
    keepalive: true,
    keepaliveInterval: 60000, // ms
  },
  reconnect: {
    auto: true,
    delay: 1000, // ms
    maxAttempts: false,
    onTimeout: false
  }
});
const router = new AlphaRouter({ chainId: 1, provider: w3p });

const provider = new ethers.providers.Web3Provider(w3p);

const poolAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";

const poolImmutablesAbi = [
  "function factory() external view returns (address)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function tickSpacing() external view returns (int24)",
  "function maxLiquidityPerTick() external view returns (uint128)",
];

const poolContract = new ethers.Contract(
  poolAddress,
  poolImmutablesAbi,
  provider
);

async function getPoolImmutables() {
  const PoolImmutables = {
    factory: await poolContract.factory(),
    token0: await poolContract.token0(),
    token1: await poolContract.token1(),
    // fee: await poolContract.fee(),
    // tickSpacing: await poolContract.tickSpacing(),
    // maxLiquidityPerTick: await poolContract.maxLiquidityPerTick(),
  };
  return PoolImmutables;
}

const WETH = new Token(
  1,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  18,
  'WETH',
  'Wrapped Ether'
);

const USDC = new Token(
  ChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD//C'
);


const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

async function main() {
  // const data = await getPoolImmutables();
  // console.log(data);
}
main();