'use strict';

const { io } = require("socket.io-client");
const socket = io("ws://127.0.0.1:7001");


socket.on('connect', () => {
  socket.emit('quote', {
    from: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    to: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    amount: 15000
  }, res => {
    console.log(res);
  });
})