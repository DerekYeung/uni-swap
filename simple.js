const { UniswapPair, ChainId, UniswapVersion, ETH, UniswapPairSettings } = require('simple-uniswap-sdk');

const uniswapPair = new UniswapPair({
  // the contract address of the token you want to convert FROM
  // fromTokenContractAddress: ETH.MAINNET().contractAddress,
  fromTokenContractAddress: '0x8f693ca8d21b157107184d29d398a8d082b38b76',
  // the contract address of the token you want to convert TO
  toTokenContractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  // the ethereum address of the user using this part of the dApp
  ethereumAddress: '0x8086EdC175a651a25cd0Ee545F75c2CF458abf14',
  chainId: ChainId.MAINNET,
  providerUrl: 'http://43.129.225.40:7891',
  // providerUrl: 'http://47.242.84.11:7891',
  // ethereumProvider: web3Provider,
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
    disableMultihops: false,
    // for example if you only wanted to turn on quotes for v3 and not v3
    // you can only support the v3 enum same works if you only want v2 quotes
    // if you do not supply anything it query both v2 and v3
    uniswapVersions: [UniswapVersion.v2, UniswapVersion.v3],
  }),
});

// now to create the factory you just do
async function main() {
  console.time('quote');
  const uniswapPairFactory = await uniswapPair.createFactory();
  const trade = await uniswapPairFactory.trade(10000, 'input');  
  // const best = await uniswapPairFactory.findAllPossibleRoutesWithQuote(1000, 'input');  
  // console.log(trade)
  // console.log(best);
  console.log(trade);
  console.log(trade.baseConvertRequest)
  console.log(trade.minAmountConvertQuote)
  console.log(trade.expectedConvertQuote)
  console.log(trade.liquidityProviderFee);
  console.log(parseFloat(trade.liquidityProviderFee) + parseFloat(trade.expectedConvertQuote));
  console.timeEnd('quote');
  // trade.quoteChanged$.subscribe((value) => {
  //   console.log('new quote', value)
  //   // value will hold the same info as below but obviously with
  //   // the new trade info.
  // });
  // await main();

}
main();
