const Koa = require('koa');
const app = new Koa();

const server = require('http').Server(app.callback());
const io = require('socket.io')(server);
const config = require('./config');
const Quoter = require('./quoter');
const { eth, provider } = require('./web3');
const quoter = new Quoter();
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

app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.get('X-Response-Time');
  console.log(`${ctx.method} ${ctx.url} - ${rt}`);
});

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
  return `${params.from}/${params.to}/${params.amount}`;
}

io.on('connection', socket => {
  socket.on('quote', async (params, cb) => {
    try {
      let cachedResult;
      const cachekey = getCacheKey(params);
      if (cachedResult = Cached[cachekey]) {
        if (cachedResult.blockNumber < Block.number) {
          delete cachedResult[cachekey];
          cachedResult = null;
        }
      }
      const quote = cachedResult ? cachedResult : await quoter.quote(params);
      quote.blockNumber = Block.number;
      if (!cachedResult) {
        Cached[cachekey] = quote;
      }
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
