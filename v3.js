const {
  UniswapPair,
  ChainId,
  UniswapVersion,
  ETH,
  UniswapPairSettings
} = require('simple-uniswap-sdk');
const config = require('./config');

const Pairs = {};

async function getPairs(from, to) {
  const key = `${from}/${to}`;
  if (Pairs[key]) {
    return Pairs[key];
  }
  const uniswapPair = new UniswapPair({
    // the contract address of the token you want to convert FROM
    // fromTokenContractAddress: ETH.MAINNET().contractAddress,
    fromTokenContractAddress: from,
    // the contract address of the token you want to convert TO
    toTokenContractAddress: to,
    // the ethereum address of the user using this part of the dApp
    ethereumAddress: '0x0dD036Fa32db13116Ec74e2D701A89D648A9AcB4',
    chainId: ChainId.MAINNET,
    providerUrl: config.RPC,
    //  'https://api.pro.mevs.cc:18891',
    // providerUrl: 'http://47.242.84.11:7891',
    // ethereumProvider: provider,
    settings: new UniswapPairSettings({
      // if not supplied it will use `0.005` which is 0.5%
      // please pass it in as a full number decimal so 0.7%
      // would be 0.007
      slippage: 0.001,
      // if not supplied it will use 20 a deadline minutes
      deadlineMinutes: 20,
      // if not supplied it will try to use multihops
      // if this is true it will require swaps to direct
      // pairs
      disableMultihops: true,
      // for example if you only wanted to turn on quotes for v3 and not v3
      // you can only support the v3 enum same works if you only want v2 quotes
      // if you do not supply anything it query both v2 and v3
      uniswapVersions: [UniswapVersion.v3],
    }),
  });
  const uniswapPairFactory = await uniswapPair.createFactory();
  Pairs[key] = uniswapPairFactory;
  return Pairs[key];
}

async function v3quoter(from, to, amount, direction = 'input') {
  const pair = await getPairs(from, to);
  const quote = await pair.findBestRoute(amount, direction);
  return quote;
}

module.exports = {
  getPairs,
  v3quoter
}