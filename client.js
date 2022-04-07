'use strict';

const { io } = require("socket.io-client");
// const socket = io("ws://43.129.225.40:7300");
const socket = io("ws://127.0.0.1:7001");


socket.on('connect', () => {
  console.log('on ok');
  socket.emit('quote', {
    from: {
      contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6
    },
    to: {
      contract: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
      decimals: 18
    },
    amount: 15000
  }, res => {
    console.log(res);
  });
})