const { parentPort, workerData } = require('worker_threads');
const { RPC } = require('./config');

const { UniswapPair, ChainId, UniswapVersion, ETH, UniswapPairSettings } = require('simple-uniswap-sdk');
const Bus = require('./bus');
Bus.listen(parentPort, { quote });

const pairs = {
};

async function quote({
  from = '',
  to = '',
  amount = 15000
}) {
  const pair = `${from}/${to}`;
  let uniswapPair = pairs[pair];
  if (!uniswapPair) {
    const master = new UniswapPair({
      // the contract address of the token you want to convert FROM
      // fromTokenContractAddress: ETH.MAINNET().contractAddress,
      fromTokenContractAddress: from,
      // the contract address of the token you want to convert TO
      toTokenContractAddress: to,
      // the ethereum address of the user using this part of the dApp
      ethereumAddress: '0x8086EdC175a651a25cd0Ee545F75c2CF458abf14',
      chainId: ChainId.MAINNET,
      providerUrl: 'http://' + RPC,
      // providerUrl: 'http://47.242.84.11:7891',
      // ethereumProvider: web3Provider,
      settings: new UniswapPairSettings({
        // if not supplied it will use `0.005` which is 0.5%
        // please pass it in as a full number decimal so 0.7%
        // would be 0.007
        slippage: 0.005,
        // if not supplied it will use 20 a deadline minutes
        deadlineMinutes: 20,
        // if not supplied it will try to use multihops
        // if this is true it will require swaps to direct
        // pairs
        disableMultihops: false,
        // for example if you only wanted to turn on quotes for v3 and not v3
        // you can only support the v3 enum same works if you only want v2 quotes
        // if you do not supply anything it query both v2 and v3
        uniswapVersions: [UniswapVersion.v2, UniswapVersion.v3],
      }),
    });
    const uniswapPairFactory = await master.createFactory();
    pairs[pair] = uniswapPairFactory;
    uniswapPair = pairs[pair];
  }
  const trade = await uniswapPair.trade(amount, 'input');
  trade.destroy();
  return {
    from,
    to,
    amount,
    baseConvertRequest: trade.baseConvertRequest,
    minAmountConvertQuote: trade.minAmountConvertQuote,
    expectedConvertQuote: trade.expectedConvertQuote
  };
}
