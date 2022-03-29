require('dotenv').config();
const workerPath = require.resolve('./worker.js');
const EventEmitter = require('events');
const { Worker } = require('worker_threads');
const { RPC, WORKERS } = require('./config');
const Bus = require('./bus');
const coins = require('./moe_coins.json').RECORDS;

class Quoter {
  constructor() {
    this.workers = [];
    this.workerRequests = [];
  }
  init() {
    for (let i = 0; i < WORKERS; i++) {
      const worker = new Worker(workerPath, { stderr: true, workerData: {
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

  async quote(params = {}) {
    const worker = await this.requestWorker();
    try {
      const result = await Bus.sendRequest(worker, 'quote', params);
      return result;
    } catch (e) {
      console.log('quote error', params, e.message);
      throw e;
    } finally {
      worker.job--;
    }
  }

  async test() {
    console.time('all');
    const list = coins.splice(0, 100);
    // for (let i = 0; i < list.length; i++) {
    //   await this.quote(list[i].contract, list[i].decimals);
    // }
    await this.quote({
      from: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      to: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      amount: 15000
    });

    const all = list.map(node => {
      return this.quote({
        from: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        to: node.contract,
        amount: 15000
      });
    });
    const done = await Promise.all(all);
    const success = done.filter(r => {
      console.log(r);
      return !!r;
    });
    console.timeEnd('all')
    // console.log(coins.length, success.length);
  }
}

module.exports = Quoter;