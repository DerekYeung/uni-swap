'use strict';
require('dotenv').config();
const RPC = process.env.RPC || '';
const WSRPC = process.env.WSRPC || '';
const PORT = process.env.PORT || 7001;
const WORKERS = process.env.WORKERS || 1;
const config = {
  RPC,
  WSRPC,
  PORT,
  WORKERS
};

module.exports = config;