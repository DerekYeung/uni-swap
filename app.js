const Koa = require('koa');

const Router = require('@koa/router');
const app = new Koa();

const server = require('http').Server(app.callback());
const io = require('socket.io')(server);
const config = require('./config');
const Quoter = require('./quoter');
const { eth, provider } = require('./web3');
const NodeCache = require('node-cache');
const quoter = new Quoter();
const router = new Router();
const Cache = new NodeCache({
  stdTTL: 60
})

quoter.init();

// logger

const logger = console;
const users = {};
let Block = null;
const Cached = {};

function onNewBlock(block) {
  console.log('on new block', block.number);
  Block = block;
  for (const k in Cached) {
    const number = Cached[k].blockNumber;
    if (number < block.number) {
      delete Cached[k];
    }
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

io.on('connection', socket => {
  console.log('client live');
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
})

eth.getBlock('latest').then(block => {
  onNewBlock(block);
}).then(() => {
  server.listen(config.PORT || port, () => {
    console.log(`app run at : http://127.0.0.1:${config.PORT}`);
  })
});
