const Koa = require('koa');

const Router = require('@koa/router');
const cors = require('@koa/cors');
const app = new Koa();
app.use(cors());

const server = require('http').Server(app.callback());
const io = require('socket.io')(server);
const config = require('./config');
const Quoter = require('./quoter');
const Web3 = require('web3');
const {
  eth,
  provider,
  ethersProvider,
  getContract,
  updatePoolInfo,
  getAmountOut,
  toTokenUnit,
  toFixedValue
} = require('./web3');
const NodeCache = require('node-cache');
const { ethers } = require('ethers');
const { parseEther } = require('ethers/lib/utils');
const { v3quoter } = require('./v3');
const quoter = new Quoter();
const router = new Router();
const Cache = new NodeCache({
  stdTTL: 60
});
let NODE_SYNCING = false;
let UNIV2_ROUTER = null;
let UNIV2_FACTORY = null;
let SUSHI_FACTORY = null;
let SUSHI_ROUTER = null;
let PANCAKE_FACTORY = null;
let PANCAKE_ROUTER = null;

const STATES = {
  V2POOLS: {},
  BALANCES: {}
};

// const V2POOLS = {};
const Tokens = {};
const V2Queue = {}

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
  console.time(`updateV2Pool-${block.number}`);
  const v2pools = Object.keys(STATES.V2POOLS);
  await Promise.all(v2pools.map(key => {
    const node = STATES.V2POOLS[key];
    return updatePoolInfo(node, block.number).then(pool => {
      if (pool) {
        STATES.V2POOLS[key] = pool;
      } else {
        delete STATES.V2POOLS[key];
      }
    });
  }));
  console.log(`update ${v2pools.length} v2pools`);
  // for (const k in V2Pools) {
  //   try {
  //     await updatePoolInfo(V2Pools[k], block.number);
  //   } catch(e) {
  //   }
  // }
  console.timeEnd(`updateV2Pool-${block.number}`);
  console.time(`updateBalance-${block.number}`);
  const balances = Object.keys(STATES.BALANCES);
  await Promise.all(balances.map(k => {
    const [origin, address] = k.split('/');
    return fetchBalance(origin, address, true);
  }));
  console.log(`update ${balances.length} balances`);
  console.timeEnd(`updateBalance-${block.number}`);
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
subscriptions.syncing = eth.subscribe('syncing')
.on('connected', subscriptionId => {
  console.log(`subscribed syncing => ${subscriptionId}`);
})
.on('data', syncing => {
  NODE_SYNCING = syncing;
  if (NODE_SYNCING) {
    console.log('[warn] NODE_SYNCING');
  }
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

async function fetchBalance(origin, address, hard) {
  if (!origin || !address) {
    throw new Error('Missing params');
  }
  const key = `${origin}/${address}`;
  const cached = STATES.BALANCES[key];
  if (cached) {
    if (!hard || cached.blockNumber >= Block.number) {
      return cached;
    }
  }
  const response = {
    balance: 0,
    blockNumber: Block.number
  };
  try {
    const contract = getContract(origin, config.ABIS.ERC20);
    const balance = await contract.balanceOf(address);
    response.balance = balance.toString();
    STATES.BALANCES[key] = response;
  } catch (e) {
    console.error('Failed to fetchBalance', origin, address, e.message);
    response.balance = 0;
  }
  return response;
}


router.get('/v2/pool', async (ctx) => {
  const { token0, token1, engine = 'UNIV2' } = ctx.query;
  const pool = await getV2Pool(token0, token1, engine);

  ctx.body = {
    code: 0,
    data: {
      address: pool.address,
      pool: pool.info
    }
  };
});

router.get('/balance', async (ctx) => {
  const { origin, address } = ctx.query;
  const response = await fetchBalance(origin, address);
  ctx.body = response;
});

const v2quoter = async (request = {}) => {
  if (NODE_SYNCING) {
    throw new Error('NODE_SYNCING');
  }
  const engine = request.engine || 'UNIV2';
  const { fromTokenAddress, toTokenAddress, amount, fromAddress, destReceiver, slippage } = request;
  const pool = await getV2Pool(fromTokenAddress, toTokenAddress, engine);
  if (!pool || pool.info.empty) {
    return pool;
  }
  const reserves = pool.info.reserves || {};
  const isToken0 = fromTokenAddress.toUpperCase() === pool.info.token0.toUpperCase();;
  const reservesIn = isToken0 ? reserves.token0 : reserves.token1; 
  const reservesOut = isToken0 ? reserves.token1 : reserves.token0; 
  const amountOut = getAmountOut(amount, reservesIn, reservesOut);
  const t0 = {
    address: pool.info.token0,
    decimals: pool.info.decimal0
  };
  const t1 = {
    address: pool.info.token1,
    decimals: pool.info.decimal1
  };
  const fromToken = isToken0 ? t0 : t1;
  const toToken = isToken0 ? t1 : t0;

  const body = {
    fromToken,
    toToken,
    reserves,
    reservesIn,
    reservesOut,
    fromTokenAmount: amount,
    toTokenAmount: toFixedValue(amountOut),
  }

  if (request.swap) {
    const amountIn = Web3.utils.toHex(amount);
    const minOut = slippage > 0 ? toFixedValue(parseInt(body.toTokenAmount) * (1 - (parseFloat(slippage) / 100) )) : amountOut;
    const amountOutMin = Web3.utils.toHex(minOut);
    const ex = (parseInt(body.toTokenAmount) - parseInt(minOut)) / body.toTokenAmount;
    if (ex > 0.1) {
      throw new Error('超过滑点');
    }
    body.minOut = minOut;
    const timeStamp = Web3.utils.toHex(Math.round(Date.now() / 1000) + 60 * 30);
    const swapTo = destReceiver || fromAddress;
    const router = engine === 'SUSHI' ? SUSHI_ROUTER : UNIV2_ROUTER;
    const tx = await router.populateTransaction.swapExactTokensForTokens(amountIn, amountOutMin, [fromTokenAddress, toTokenAddress], swapTo, timeStamp);
    body.tx = tx;
  }
  return body;
};

router.get('/v2/quote', async (ctx) => {
  const body = await v2quoter(ctx.query);
  ctx.body = body;
});
router.get('/v3/quote', async (ctx) => {
  const quote = await v3quoter(ctx.query);
  ctx.body = quote;
});
router.get('/status', async (ctx) => {
  const body = {
    block: Block,
    syncing: NODE_SYNCING,
    v2pools: Object.keys(STATES.V2POOLS).length,
    balance: Object.keys(Balances).length
  };
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

async function getV2Pool(token0, token1, engine) {
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
  engine = engine || 'UNIV2';
  const key = tokens.join('_') + `@${engine}`;
  return fetchV2Pool(tokens, key, engine);

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

async function fetchV2Pool(tokens, key, engine) {
  let pool;
  let address = null;
  try {
    if (STATES.V2POOLS[key]) {
      const next = STATES.V2POOLS[key].next || null;
      if (next) {
        if (Block.number >= next) {
          delete STATES.V2POOLS[key];
        } else {
          return STATES.V2POOLS[key];
        }
      } else {
        await updatePoolInfo(STATES.V2POOLS[key], Block.number);
        return STATES.V2POOLS[key];
      }
    }
    let factory;
    if (engine === 'UNIV2') {
      factory = UNIV2_FACTORY;
    } else if (engine === 'SUSHI') {
      factory = SUSHI_FACTORY;
    } else if (engine === 'PANCAKE') {
      factory = PANCAKE_FACTORY;
    }
    if (!factory) {
      throw new Error('Invalid engine');
    }
    console.log(tokens);
    address = await factory.getPair(tokens[0], tokens[1]);
    if (address === '0x0000000000000000000000000000000000000000') {
      pool = {
        info: {
          empty: true
        },
        blockNumber: Block.number,
        next: Block.number + 10,
      }
      STATES.V2POOLS[key] = pool;
      return pool;
    }
    const pair = await getContract(address, config.ABIS.UNIV2_PAIR);
    pool = {
      address,
      contract: pair
    };
    await updatePoolInfo(pool, Block.number);
    STATES.V2POOLS[key] = pool;
    return pool;
  } catch (e) {
    console.error(`Missing data for: ${key} => ${address}`, e.message);
    return null;
  }
}

io.on('connection', socket => {
  console.log('client live');
  socket.emit('block', Block);
  socket.emit('syncing', NODE_SYNCING);
  socket.on('block', async (cb) => {
    cb && cb(Block);
  });
  socket.on('syncing', async (cb) => {
    cb && cb(NODE_SYNCING);
  });
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
      const pool = await getV2Pool(params.token0, params.token1, params.engine);
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
  socket.on('v3/quote', async (params, cb) => {
    try {
      const body = await v3quoter(params);
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
  socket.on('balance', async (params, cb) => {
    try {
      const body = await fetchBalance(params.origin, params.address, !!params.hard);
      cb && cb(body);
    } catch (e) {
      cb && cb({
        error: 1,
        message: e.message
      });
    }
  });
});


async function waitUntilSynced() {
  NODE_SYNCING = await eth.isSyncing();
  if (NODE_SYNCING) {
    console.log('Node still syncing');
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(waitUntilSynced());
      }, 1000);
    })
  }
  return !NODE_SYNCING;
}

waitUntilSynced().then(() => {
  return eth.getBlock('latest').then(block => {
    onNewBlock(block);
  }).then(async () => {
    UNIV2_ROUTER = await getContract(config.UNIV2_ROUTER, config.ABIS.UNIV2_ROUTER);
    UNIV2_FACTORY = await getContract(config.UNIV2_FACTORY, config.ABIS.UNIV2_FACTORY);
    SUSHI_ROUTER = await getContract(config.SUSHI_ROUTER, config.ABIS.UNIV2_ROUTER);
    SUSHI_FACTORY = await getContract(config.SUSHI_FACTORY, config.ABIS.UNIV2_FACTORY);
    PANCAKE_ROUTER = await getContract(config.PANCAKE_ROUTER, config.ABIS.UNIV2_ROUTER);
    PANCAKE_FACTORY = await getContract(config.PANCAKE_FACTORY, config.ABIS.UNIV2_FACTORY);
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
});
