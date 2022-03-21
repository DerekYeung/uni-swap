'use strict';
/**
 * bus.js
 *
 * Communication between the main program and worker threads
 */

// ------------------------------------------------------------------------------------------------
// Globals
// ------------------------------------------------------------------------------------------------
const { EventEmitter } = require('events');
const uuid = require('uuid');

class Bus extends EventEmitter {
  constructor() {
    super();
    const sub = new Map();
    this.sub = sub;
    return new Proxy(this, {
      get(target, key) {
        if (target[key]) {
          return target[key];
        }
        let subBus = sub.get(key);
        if (subBus) {
          return subBus;
        }
        subBus = Bus.getSub(key, target);
        sub.set(key, subBus);
        return subBus;
      },
    });
  }

  static getSub(key, bus) {
    const sub = new EventEmitter();
    const emit = sub.emit;
    sub.emit = (event, ...args) => {
      bus.emit(`${key}::${event}`, ...args);
      emit.call(sub, event, ...args);
    };
    return sub;
  }

}

const bridge = new Bus();

// let messageId = 0;
const Hub = new Map();

// ------------------------------------------------------------------------------------------------
// sendRequest
// ------------------------------------------------------------------------------------------------

async function sendRequest(port, func, ...args) {
  const id = uuid.v4();
  return new Promise((resolve, reject) => {
    // messageCallbacks[messageId] = { resolve, reject };
    Hub.set(id, {
      resolve,
      reject,
    });
    port.postMessage({ id, func, args });
  }).finally(() => {
    Hub.delete(id);
  });
}

// ------------------------------------------------------------------------------------------------
// listen
// ------------------------------------------------------------------------------------------------

function listen(port, handlers) {
  port.on('message', async msg => {
    if (msg.response) {
      const request = Hub.get(msg.id);
      if (msg.err) {
        request.reject(new Error(msg.err));
      } else {
        request.resolve(msg.ret);
      }
      return;
    }

    try {
      const handler = handlers[msg.func];
      if (typeof handler !== 'function') {
        throw new Error('No handler for ' + msg.func);
      }
      const ret = await handler(...msg.args);
      port.postMessage({ response: true, id: msg.id, ret });
    } catch (e) {
      port.postMessage({ response: true, id: msg.id, err: e.message || e.toString() });
    }
  });
}

// ------------------------------------------------------------------------------------------------

module.exports = { sendRequest, listen, Bus, Hub, bridge };
