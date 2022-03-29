const { parentPort, workerData } = require('worker_threads');

const { AlphaRouter } = require("@uniswap/smart-order-router");
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { ethers } = require('ethers');
const Web3WsProvider = require('web3-providers-ws');
const bn = require('bn.js');
const Bus = require('./bus');
Bus.listen(parentPort, { quote });

const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
const MY_ADDRESS = '0x8086EdC175a651a25cd0Ee545F75c2CF458abf14';
const web3Provider = new Web3WsProvider('ws://43.129.225.40:7892', {
  clientConfig: {
    keepalive: true,
    keepaliveInterval: 60000, // ms
  },
  reconnect: {
    auto: true,
    delay: 1000, // ms
    maxAttempts: false,
    onTimeout: false
  }
});

// const provider = new ethers.providers.Web3Provider(web3Provider);
const provider = new ethers.providers.StaticJsonRpcProvider('http://43.129.225.40:7891');
const router = new AlphaRouter({ chainId: 1, provider });

async function quote(contract, decimals) {
  contract = '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9';
  decimals = 18;
  // console.time('quote');
  const USDT = new Token(
    1,
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    6,
    'USDT',
    'USDT'
  );

  const target = new Token(
    1,
    contract,
    decimals,
    'USDC',
    'USD//C'
  );

  const typedValueParsed = Math.floor(15000 * (10 ** 6)).toFixed();
  const sellAmount = CurrencyAmount.fromRawAmount(USDT, new bn(typedValueParsed));

  const route = await router.route(
    sellAmount,
    target,
    TradeType.EXACT_INPUT,
    // {
    //   recipient: MY_ADDRESS,
    //   slippageTolerance: new Percent(5, 100),
    //   deadline: Math.floor(Date.now()/1000 +1800)
    // }
  );
  // console.log(route);
  return route.quote;
  // console.timeEnd('quote');

  // console.log(`Quote Exact In: ${route.quote.toFixed(2)}`);
  // console.log(`Gas Adjusted Quote In: ${route.quoteGasAdjusted.toFixed(2)}`);
  // console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed(6)}`);
}
