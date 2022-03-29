
'use strict';

const Web3 = require('web3');
const config = require('./config');

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
const web3 = new Web3(provider);
const eth = web3.eth;

module.exports = {
  provider,
  web3,
  eth
};