'use strict';
require('dotenv').config();
const RPC = process.env.RPC || '';
const WSRPC = process.env.WSRPC || '';
const PORT = process.env.PORT || 7001;
const WORKERS = process.env.WORKERS || 1;
const UNIV2_ROUTER = process.env.UNIV2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNIV2_FACTORY = process.env.UNIV2_FACTORY || '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f';
const WETH_ADDRESS = process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDT_ADDRESS = process.env.USDT_ADDRESS || '0xdac17f958d2ee523a2206206994597c13d831ec7';
const ABIS = {
  UNIV2_ROUTER: require('./abis/univ2_router.json'),
  UNIV2_FACTORY: require('./abis/univ2_factory.json'),
  UNIV2_PAIR: require('./abis/univ2_pair.json'),
};
const config = {
  RPC,
  WSRPC,
  PORT,
  WORKERS,
  UNIV2_ROUTER,
  UNIV2_FACTORY,
  WETH_ADDRESS,
  USDT_ADDRESS,
  ABIS
};

module.exports = config;