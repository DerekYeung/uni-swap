'use strict';
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://43.129.225.40:7892'));
web3.eth.getBlockNumber().then(n => console.log('block number', n));
web3.eth.isSyncing().then(n => console.log('syncing', n));
setInterval(() => {
  web3.eth.isSyncing().then(n => console.log('syncing', n));
}, 1000);

const unitxtime = () => { return Math.round(new Date().getTime()); };
const address = '0x8086EdC175a651a25cd0Ee545F75c2CF458abf14'.toUpperCase();

// const subscription = web3.eth.subscribe('pendingTransactions', function(error, result) {
//   if (error) { console.log(error); }
//   // console.log(result);
// });
// subscription.on('data', async function(hash) {
//   const tx = await web3.eth.getTransaction(hash);

//   if (tx) {
//     const from = (tx.from || '').toUpperCase();
//     console.log(unitxtime(), tx.hash, tx);
//     if (from === address) {
//     }
//   }
// });

web3.eth.getTransaction('0xb31ac67e86e6fb6756a14ac90d020cc52c3ad60dfb331480bc3fa90eb404f222').then(tx => {
  console.log(tx);
});
