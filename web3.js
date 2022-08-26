
'use strict';

const Web3 = require('web3');
const Web3WsProvider = require('web3-providers-ws')
const config = require('./config');
const Decimal = require('decimal.js');

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

function getWeb3Contract() {
  return new Contract(address, abi, signerOrProvider);
}

async function updatePoolInfo(pool, blockNumber) {
  const contract = pool.contract;
  const info = pool.info || {};
  const token0 = info.token0;
  const token1 = info.token1;
  const decimal0 = info.decimal0;
  const decimal1 = info.decimal1;
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
  if (!decimal0 || !decimal1) {
    const t0 = getContract(info.token0, config.ABIS.ERC20);
    const t1 = getContract(info.token1, config.ABIS.ERC20);
    const [ a, b ] = await Promise.all([
      t0.decimals(),
      t1.decimals()
    ]);
    info.decimal0 = a;
    info.decimal1 = b;
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

function getAmountIn(input = 0, reserveIn, reserveOut) {
  const rate = new Decimal(1000).minus(new Decimal(0.003).times(1000));
  const numerator = new Decimal(reserveIn).times(input).times(1000);
  const denominator = new Decimal(reserveOut).minus(input).times(rate);
  if (denominator <= 0) {
    return 0;
  }
  const amountIn = Math.floor(numerator.dividedBy(denominator).toNumber()) + 1;
  return amountIn;
}

function getAmountOut(input = 0, reserveIn, reserveOut) {
  const rate = new Decimal(1000).minus(new Decimal(0.003).times(1000));
  const inputWithFee = new Decimal(input).times(rate);
  const numerator = inputWithFee.times(reserveOut);
  const denominator = new Decimal(reserveIn).times(1000).plus(inputWithFee);
  const amountOut = numerator.dividedBy(denominator);
  return Math.floor(amountOut.toNumber());
}

function fromTokenUnit(value, decimals = 0, toFixed = false) {
  if (!value || value <= 0) {
    return value;
  }
  let amount = new Decimal(value);
  if (decimals > 0) {
    for (let i = 0; i < decimals; i++) {
      amount = amount.dividedBy(10);
    }
  }
  if (toFixed) {
    return toFixedValue(amount.toNumber(), decimals);
  }
  return amount.toNumber();
}

function toTokenUnit(amount, decimals = 0, cut = false) {
  let value = new Decimal(amount);
  if (value.isNegative() || value.isZero() || !decimals) {
    return value.toNumber();
  }

  if (decimals > 0) {
    for (let i = 0; i < decimals; i++) {
      value = value.times(10);
    }
    if (!value.isInteger()) {
      if (cut) {
        return Math.floor(value.toNumber());
      }
      console.log(value.toNumber(), decimals);
      throw new Error('Unsupported decimals');
    }
  }
  return value.toNumber();
}

function toFixedValue(number, decimals = 0) {
  if (!number || isNaN(number)) {
    return number;
  }
  return new Decimal(new Decimal(number).toFixed(decimals)).toFixed();
}


module.exports = {
  provider,
  ethersProvider,
  web3,
  eth,
  getContract,
  getWeb3Contract,
  updatePoolInfo,
  getAmountIn,
  getAmountOut,
  fromTokenUnit,
  toTokenUnit,
  toFixedValue
};