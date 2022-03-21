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

const provider = new ethers.providers.Web3Provider(web3Provider);
const router = new AlphaRouter({ chainId: 1, provider });

async function quote(contract, decimals) {
  // console.time('quote');
  const WETH = new Token(
    1,
    contract,
    decimals,
    'WETH',
    'Wrapped Ether'
  );

  const USDC = new Token(
    1,
    '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
    6,
    'USDC',
    'USD//C'
  );

  const typedValueParsed = Math.floor(1 * (10 ** 18)).toFixed();
  const wethAmount = CurrencyAmount.fromRawAmount(WETH, new bn(typedValueParsed));

  const route = await router.route(
    wethAmount,
    USDC,
    TradeType.EXACT_INPUT,
    {
      recipient: MY_ADDRESS,
      slippageTolerance: new Percent(5, 100),
      deadline: Math.floor(Date.now()/1000 +1800)
    }
  );
  return route.quote;
  // console.timeEnd('quote');

  // console.log(`Quote Exact In: ${route.quote.toFixed(2)}`);
  // console.log(`Gas Adjusted Quote In: ${route.quoteGasAdjusted.toFixed(2)}`);
  // console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed(6)}`);
}
