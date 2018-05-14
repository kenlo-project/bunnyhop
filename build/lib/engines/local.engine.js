'use strict';

let ConnectionManager = (() => {
  var _ref3 = _asyncToGenerator(function* () {
    return {
      connection: null,
      channel: null
    };
  });

  return function ConnectionManager() {
    return _ref3.apply(this, arguments);
  };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/*
 * This engine simply calls the locally saved function reference.
 *
 * You set what function to call with listen or subscribe.  You call functions with send or publish.
 *
 * Useful for testing bunnyhop APIs
 */
function LocalEngine(pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  log.info('Using LocalEngine');

  const listeners = {};
  const subscriptions = {};

  return {
    send: (() => {
      var _ref = _asyncToGenerator(function* (routingKey, message, options = {}) {
        if (/[*#]/g.test(routingKey)) {
          throw new TypeError('Routing key cannot contain * or # for "send".');
        }
        if (listeners[routingKey] && listeners[routingKey].length) {
          // Take the first listener, to round robin them
          const listenFn = listeners[routingKey].shift();
          if (listenFn) {
            log.info(`  [<] calling test listener for ${routingKey}`);
            const result = listenFn({ content: message });
            // place the first one at the end of the list and continue
            listeners[routingKey].push(listenFn);
            return result;
          }
        }
      });

      return function send(_x, _x2) {
        return _ref.apply(this, arguments);
      };
    })(),

    listen: (routingKey, listenFn, options = {}) => {
      if (/[*#]/g.test(routingKey)) {
        throw new TypeError('Routing key cannot contain * or # for "listen".');
      }
      if (!listeners[routingKey]) listeners[routingKey] = [];
      log.info(`  [>] setting up a test listener for ${routingKey}`);
      listeners[routingKey].push(listenFn);
      return { consumerTag: pluginAPI.getServiceName() };
    },

    publish: (() => {
      var _ref2 = _asyncToGenerator(function* (routingKey, message, options) {
        // When publishing, publish to ALL subscribers
        if (subscriptions[routingKey] && subscriptions[routingKey].length) {
          subscriptions[routingKey].forEach(function (listenFn) {
            if (listenFn) {
              log.info(`  [<] calling test subscriber for ${routingKey}`);
              return listenFn({ content: message });
            }
          });
        }
      });

      return function publish(_x3, _x4, _x5) {
        return _ref2.apply(this, arguments);
      };
    })(),

    subscribe: (routingKey, listenFn, options) => {
      if (!subscriptions[routingKey]) subscriptions[routingKey] = [];
      log.info(`[>] setting up a test subscriber for ${routingKey}`);
      subscriptions[routingKey].push(listenFn);
      return { consumerTag: pluginAPI.getServiceName() };
    }
  };
}

LocalEngine.ConnectionManager = ConnectionManager;

module.exports = LocalEngine;
//# sourceMappingURL=local.engine.js.map