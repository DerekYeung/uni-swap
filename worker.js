const { parentPort, workerData } = require('worker_threads');

const { AlphaRouter } = require("@uniswap/smart-order-router");
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { ethers } = require('ethers');
const Web3WsProvider = require('web3-providers-ws');
const bn = require('bn.js');
const Bus = require('./bus');
const { WSRPC, RPC } = require('./config');
Bus.listen(parentPort, { quote });

const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
const MY_ADDRESS = '0x8086EdC175a651a25cd0Ee545F75c2CF458abf14';
const web3Provider = new Web3WsProvider('ws://' + WSRPC, {
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
const provider = new ethers.providers.StaticJsonRpcProvider('http://' + RPC);
const router = new AlphaRouter({ chainId: 1, provider });

async function quote({
  from = '',
  to = '',
  amount = 0
}) {
  const FROM = new Token(
    1,
    from.contract,
    from.decimals,
  );

  const TO = new Token(
    1,
    to.contract,
    to.decimals,
  );

  const typedValueParsed = Math.floor(parseFloat(amount) * (10 ** from.decimals)).toFixed();
  const sellAmount = CurrencyAmount.fromRawAmount(FROM, new bn(typedValueParsed));

  const route = await router.route(
    sellAmount,
    TO,
    TradeType.EXACT_INPUT,
    // {
    //   recipient: MY_ADDRESS,
    //   slippageTolerance: new Percent(5, 100),
    //   deadline: Math.floor(Date.now()/1000 +1800)
    // }
  );
  if (!route) {
    return {
      error: 'Missing route'
    };
  }
  // console.log(`Quote Exact In: ${route.quote.toFixed(2)}`);
  // console.log(`Gas Adjusted Quote In: ${route.quoteGasAdjusted.toFixed(2)}`);
  // console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed(6)}`);

  return {
    from: from.contract,
    to: to.contract,
    fromToken: parseFloat(amount),
    toToken: parseFloat(route.quote.toFixed(to.decimals)),
    blockNumber: route.blockNumber.toNumber(),
  };
  // console.timeEnd('quote');

}
