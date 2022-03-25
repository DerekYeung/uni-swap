require('dotenv').config();
const path = require.resolve('./worker.js');
const EventEmitter = require('events');
const { Worker } = require('worker_threads');
const Bus = require('./bus');
const coins = require('./moe_coins.json').RECORDS;
const numWorkers = process.env.WORKER || 1;

const RPC = process.env.RPC;
class Master {
  constructor() {
    this.workers = [];
    this.workerRequests = [];
  }
  init() {
    const path = require.resolve('./worker.js');
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(path, { stderr: true, workerData: {
        id: i,
        RPC
      } });

      worker.id = i;
      worker.job = 0;
      worker.available = true;
      worker.executing = '';
      worker.missingDeps = new Set();
      worker.startTime = 0;

      this.workers.push(worker);

      const cacheGet = txid => this.onCacheGet(txid);
      const blockchainFetch = txid => this.onBlockchainFetch(worker, txid);
      const missDeps = txid => this.onMissDeps(worker, txid);
      const listTx = txids => this.listTx(txids);
      const checkCacheFromGuardian = txid => this.checkCacheFromGuardian(txid);
      const handlers = { missDeps, cacheGet, blockchainFetch, listTx, checkCacheFromGuardian };

      Bus.listen(worker, handlers);

      if (this.workerRequests.length) {
        worker.available = false;
        this.workerRequests.shift()(worker);
      }
    }
  }

  requestWorker() {
    const clients = this.workers.map((worker, index) => {
      const job = worker.job;
      return {
        job,
        index
      };
    })
    clients.sort((a, b) => {
      return a.job - b.job;
    });

    const worker = this.workers[clients[0].index];
    worker.job++;
    return worker;
  }

  async quote(contract, decimals) {
    const worker = await this.requestWorker();
    try {
      const result = await Bus.sendRequest(worker, 'quote', contract, decimals);
      console.log('quote success')
    } catch (e) {
      console.log('quote error', contract, e.message);
    }
    worker.job--;
    return true;
  }

  async test() {
    console.time('all');
    const list = coins.splice(0, 10);
    // for (let i = 0; i < list.length; i++) {
    //   await this.quote(list[i].contract, list[i].decimals);
    // }
    await this.quote('0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18);

    // const all = list.map(node => {
    //   return this.quote(node.contract, node.decimals);
    // });
    // const done = await Promise.all(all);
    // const success = done.filter(r => {
    //   return !!r;
    // });
    console.timeEnd('all')
    // console.log(coins.length, success.length);
  }
}


const master = new Master();
master.init();
master.test().then(() => {
  master.test();
});