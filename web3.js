
'use strict';

const Web3 = require('web3');
const Web3WsProvider = require('web3-providers-ws')
const config = require('./config');

const { ethers, Contract } = require('ethers');

const options = {
  reconnect: {
    auto: true,
    delay: 1000,
    maxAttempts: 9999,
    onTimeout: false,
  },
}

const rpc = config.WSRPC;
const provider = new Web3.providers.WebsocketProvider('ws://' + rpc, options);
const ethersProvider = new ethers.providers.Web3Provider(
  new Web3WsProvider('ws://' + rpc, {
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
  }),
);
const web3 = new Web3(provider);
const eth = web3.eth;

function getContract(address, abi, signerOrProvider = ethersProvider) {
  return new Contract(address, abi, signerOrProvider);
}

async function updatePoolInfo(pool, blockNumber) {
  const contract = pool.contract;
  const info = pool.info || {};
  const token0 = info.token0;
  const token1 = info.token1;
  if (!blockNumber) {
    blockNumber = (await eth.getBlock('latest')).number;
  }
  if (!token0 || !token1) {
    const [ a, b ] = await Promise.all([
      contract.token0(),
      contract.token1()
    ]);
    info.token0 = a;
    info.token1 = b;
  }
  if (!info.getReserves || blockNumber > info.blockNumber) {
    const reserves = await contract.getReserves();
    info.reserves = {
      token0: reserves[0].toString(),
      token1: reserves[1].toString(),
    };
  }
  info.blockNumber = blockNumber;
  pool.info = info;
  return pool;
}

module.exports = {
  provider,
  ethersProvider,
  web3,
  eth,
  getContract,
  updatePoolInfo
};