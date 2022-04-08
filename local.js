'use strict';

const { io } = require("socket.io-client");
// const socket = io("ws://43.129.225.40:7300");
const socket = io("ws://127.0.0.1:7001");

const RECORDS = require('./uni.json').RECORDS;
console.log(RECORDS.length);

socket.on('connect', () => {
  console.log('on ok');
  RECORDS.forEach(node => {
    socket.emit('quote', {
      from: {
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimals: 6
      },
      to: {
        contract: node.contract,
        decimals: node.decimals
      },
      amount: 15000
    }, res => {
      console.log(res);
    });
    socket.emit('quote', {
      from: {
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimals: 6
      },
      to: {
        contract: node.contract,
        decimals: node.decimals
      },
      amount: 15000
    }, res => {
      console.log(res);
    });

  })
})