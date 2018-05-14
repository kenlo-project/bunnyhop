'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Created by balmasi on 2017-06-02.
 */

function LoggingPlugin(pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  log.info('Using Logging Plugin');

  return {
    send: next => (routingKey, message, options) => {
      log.info(`  [>] sending %j to ${routingKey}.`, message);
      return next(routingKey, message, options);
    },
    listen: next => (() => {
      var _ref = _asyncToGenerator(function* (routingKey, listenFn, options) {
        function logPassThrough(msg) {
          const ret = listenFn(msg);
          // We have to place this log after listenFn cause it contains our deserialization logic
          log.info(`  [<] received %j on ${routingKey} via listen.`, msg.content);
          return ret;
        }

        const consumeReturnVal = yield next(routingKey, logPassThrough, options);
        log.info(`Consumer ${consumeReturnVal.consumerTag} waiting for commands on routing key ${routingKey}.`);
        return consumeReturnVal;
      });

      return function (_x, _x2, _x3) {
        return _ref.apply(this, arguments);
      };
    })(),
    publish: next => (routingKey, message, options) => {
      log.info(`  [>] publishing %j to ${routingKey}.`, message);
      return next(routingKey, message, options);
    },
    subscribe: next => (routingKey, subscribeFn, options) => {
      function logPassThrough(msg) {
        const ret = subscribeFn(msg);
        // We have to place this log after subscribeFn cause it contains our deserialization logic
        log.info(`  [<] received %j on ${routingKey} via subscribe.`, msg.content);
        return ret;
      }
      return next(routingKey, logPassThrough, options);
    }
  };
}

module.exports = LoggingPlugin;
//# sourceMappingURL=logging.plugin.js.map