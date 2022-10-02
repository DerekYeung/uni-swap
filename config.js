'use strict';
require('dotenv').config();
const RPC = process.env.RPC || '';
const WSRPC = process.env.WSRPC || '';
const PORT = process.env.PORT || 7001;
const WORKERS = process.env.WORKERS || 1;
const UNIV2_ROUTER = process.env.UNIV2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNIV2_FACTORY = process.env.UNIV2_FACTORY || '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f';

const SUSHI_ROUTER = process.env.UNIV2_ROUTER || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';
const SUSHI_FACTORY = process.env.UNIV2_FACTORY || '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac';

const PANCAKE_ROUTER = process.env.PANCAKE_ROUTER || '0x10ed43c718714eb63d5aa57b78b54704e256024e';
const PANCAKE_FACTORY = process.env.PANCAKE_FACTORY || '0xca143ce32fe78f1f7019d7d551a6402fc5350c73';

const WETH_ADDRESS = process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDT_ADDRESS = process.env.USDT_ADDRESS || '0xdac17f958d2ee523a2206206994597c13d831ec7';

const ABIS = {
  UNIV2_ROUTER: require('./abis/univ2_router.json'),
  UNIV2_FACTORY: require('./abis/univ2_factory.json'),
  UNIV2_PAIR: require('./abis/univ2_pair.json'),
  ERC20: require('./abis/erc20.json'),
};
const config = {
  RPC,
  WSRPC,
  PORT,
  WORKERS,
  UNIV2_ROUTER,
  UNIV2_FACTORY,
  SUSHI_ROUTER,
  SUSHI_FACTORY,
  WETH_ADDRESS,
  USDT_ADDRESS,
  PANCAKE_ROUTER,
  PANCAKE_FACTORY,
  ABIS
};

module.exports = config;