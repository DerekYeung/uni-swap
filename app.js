const Koa = require('koa');

const Router = require('@koa/router');
const cors = require('@koa/cors');
const app = new Koa();
app.use(cors());

const server = require('http').Server(app.callback());
const io = require('socket.io')(server);
const config = require('./config');
const Quoter = require('./quoter');
const web3 = require('web3');
const { eth, provider, getContract, updatePoolInfo, getAmountOut } = require('./web3');
const NodeCache = require('node-cache');
const { ethers } = require('ethers');
const quoter = new Quoter();
const router = new Router();
const Cache = new NodeCache({
  stdTTL: 60
});

let UNIV2_ROUTER = null;
let UNIV2_FACTORY = null;

const V2Pools = {};
const Tokens = {};

quoter.init();

// logger

const logger = console;
const users = {};
let Block = null;
const Cached = {};

async function onNewBlock(block) {
  console.log('on new block', block.number);
  Block = block;
  io.sockets.emit('block', Block);
  for (const k in Cached) {
    const number = Cached[k].blockNumber;
    if (number < block.number) {
      delete Cached[k];
    }
  }
  for (const k in V2Pools) {
    await updatePoolInfo(V2Pools[k], block.number);
  }
}

const subscriptions = {}
subscriptions.newBlockHeaders = eth.subscribe('newBlockHeaders')
.on('connected', subscriptionId => {
  console.log(`subscribed newBlockHeaders => ${subscriptionId}`);
})
.on('data', block => {
  onNewBlock(block);
})
.on('error', e => {
  console.error(`subscribe error: ${e.message}`);
});

router.get('/quote', async (ctx) => {
  const fromToken = ctx.query.fromToken;
  const fromDecimals = parseInt(ctx.query.fromDecimals || 18);
  const toToken = ctx.query.toToken;
  const toDecimals = parseInt(ctx.query.toDecimals || 18);
  const amount = parseFloat(ctx.query.amount);
  const params = {
    from: {
      contract: fromToken,
      decimals: fromDecimals
    },
    to: {
      contract: toToken,
      decimals: toDecimals
    },
    amount: amount,
  };
  const quote = await quoteAndCache(params);
  ctx.body = {
    params,
    quote
  };
});


router.get('/v2/pool', async (ctx) => {
  const { token0, token1 } = ctx.query;
  const pool = await getV2Pool(token0, token1);

  ctx.body = {
    address: pool.address,
    pool: pool.info
  };
});


const v2quoter = async (request = {}) => {
  const { fromTokenAddress, toTokenAddress, amount, fromAddress, destReceiver, slippage } = request;
  const pool = await getV2Pool(fromTokenAddress, toTokenAddress);
  const reserves = pool.info.reserves || {};
  const reservesIn = fromTokenAddress === pool.info.token0 ? reserves.token0 : reserves.token1; 
  const reservesOut = fromTokenAddress === pool.info.token0 ? reserves.token1 : reserves.token0; 
  const amountOut = getAmountOut(amount, reservesIn, reservesOut);
  const t0 = {
    address: pool.info.token0,
    decimals: pool.info.decimal0
  };
  const t1 = {
    address: pool.info.token1,
    decimals: pool.info.decimal1
  };
  const fromToken = fromTokenAddress === pool.info.token0 ? t0 : t1;
  const toToken = fromTokenAddress === pool.info.token0 ? t1 : t0;

  const body = {
    fromToken,
    toToken,
    reserves,
    fromTokenAmount: amount,
    toTokenAmount: amountOut,
  }

  if (request.swap) {
    const amountIn = web3.utils.toHex(amount);
    const amountOutMin = web3.utils.toHex(slippage > 0 ? parseInt(amountOut * (1 - parseFloat(slippage))) : amountOut);
    const timeStamp = web3.utils.toHex(Math.round(Date.now()/1000)+60*20);
    const swapTo = destReceiver || fromAddress;
    const tx = await UNIV2_ROUTER.populateTransaction.swapExactTokensForTokens(amountIn, amountOutMin, [fromTokenAddress, toTokenAddress], swapTo, timeStamp);
    body.tx = tx;
  }
  return body;
};

router.get('/v2/quote', async (ctx) => {
  const body = await v2quoter(ctx.query);
  ctx.body = body;
});


router.get('/v2/swap', async (ctx) => {
  const body = await v2quoter({
    ...ctx.query,
    swap: true
  });
  ctx.body = body;
});

router.get('/v2pools', async (ctx) => {
  ctx.body = {
    blockNumber: Block.number,
    pools: Object.values(V2Pools).map(pool => {
      return pool.info
    })
  };
});
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.get('X-Response-Time');
  console.log(`${ctx.method} ${ctx.url} - ${rt}`);
});

app
  .use(router.routes())
  .use(router.allowedMethods());

// x-response-time

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

// response

app.use(async ctx => {
  ctx.body = 'Hello World';
});
provider.on('connect', () => {
  console.log('rpc connected');
});

function getCacheKey(params) {
  return `${params.from.contract}/${params.to.contract}/${params.amount}`;
}

async function quoteAndCache(params) {
  const key = getCacheKey(params);
  const quote = await quoter.quote(params);
  if (quote.error) {
    console.log('quote', quote);
  }
  const cached = Cached[key];
  if (!quote.blockNumber) {
    quote.blockNumber = Block.number;
  }
  if (!cached || quote.blockNumber > cached.blockNumber) {
    Cached[key] = quote;
  }
  return quote;
}

const V2Queue = {
}

async function getV2Pool(token0, token1) {
  if (!token0 || !token1) {
    throw new Error('Missing param');
  }
  const tokens = [
    token0.toLowerCase(),
    token1.toLowerCase()
  ];
  tokens.sort((a, b) => {
    return a - b;
  });
  const key = tokens.join('_');
  return fetchV2Pool(tokens, key);

  const query = !V2Queue[key];
  if (query) {
    V2Queue[key] = [];
  }

  const p = new Promise((resolve) => {
    V2Queue[key].push(resolve);
  });
  if (query) {
    const pool = await fetchV2Pool(tokens, key);
    V2Queue[key].forEach((c) => {
      if (!pool) {
        console.log(pool);
      }
      c(pool);
    });
    delete V2Queue[key];
  }
  return p;

}

async function fetchV2Pool(tokens, key) {
  let pool;
  let address = null;
  try {
    if (V2Pools[key]) {
      await updatePoolInfo(V2Pools[key], Block.number);
      return V2Pools[key];
    }
    address = await UNIV2_FACTORY.getPair(tokens[0], tokens[1]);
    if (address === '0x0000000000000000000000000000000000000000') {
      return {
        info: {
          empty: true
        }
      };
    }
    const pair = await getContract(address, config.ABIS.UNIV2_PAIR);
    pool = {
      address,
      contract: pair
    };
    await updatePoolInfo(pool, Block.number);
    V2Pools[key] = pool;
    return pool;
  } catch (e) {
    console.error(`Missing data for: ${key} => ${address}`, e.message);
    return null;
  }
}

io.on('connection', socket => {
  console.log('client live');
  socket.emit('block', Block);
  socket.on('quote', async (params, cb) => {
    try {
      let cachedResult;
      const cachekey = getCacheKey(params);
      if (cachedResult = Cached[cachekey]) {
        const ex = Block.number - cachedResult.blockNumber;
        if (ex >= 1) {
          // quoteAndCache(params);
          cachedResult = null;
        }
        if (ex >= 3) {
          cachedResult = null;
        }
      }
      const quote = cachedResult ? cachedResult : await quoteAndCache(params);
      cb && cb(quote);
    } catch (e) {
      cb && cb({
        error: 1,
        message: e.message
      });
    }
  });
  socket.on('get-v2pool', async (params, cb) => {
    try {
      const pool = await getV2Pool(params.token0, params.token1);
      cb && cb({
        address: pool.address,
        ...pool.info
      });
    } catch (e) {
      cb && cb({
        error: 1,
        message: e.message
      });
    }
  });
  socket.on('v2/quote', async (params, cb) => {
    try {
      const body = await v2quoter(params);
      cb && cb(body);
    } catch (e) {
      cb && cb({
        error: 1,
        message: e.message
      });
    }
  });
  socket.on('v2/swap', async (params, cb) => {
    try {
      const body = await v2quoter({
        ...params,
        swap: true
      });
      cb && cb(body);
    } catch (e) {
      cb && cb({
        error: 1,
        message: e.message
      });
    }
  });
})

eth.getBlock('latest').then(block => {
  onNewBlock(block);
}).then(async () => {
  UNIV2_ROUTER = await getContract(config.UNIV2_ROUTER, config.ABIS.UNIV2_ROUTER);
  UNIV2_FACTORY = await getContract(config.UNIV2_FACTORY, config.ABIS.UNIV2_FACTORY);
  // // const FACTORY_ADDRESS = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f';
  // // const WETH_ADDRESS = await UNIV2.WETH();
  // const pair = await UNIV2_FACTORY.getPair(config.WETH_ADDRESS, config.USDT_ADDRESS);
  // const POOL = await getContract(pair, config.ABIS.UNIV2_PAIR);
  // const rev = await POOL.getReserves();
  // console.log(UNIV2_FACTORY, pair, rev);
  console.log('start');
  server.listen(config.PORT || port, () => {
    console.log(`app run at : http://127.0.0.1:${config.PORT}`);
  })
});
