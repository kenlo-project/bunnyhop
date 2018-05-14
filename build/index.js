'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Created by balmasi on 2017-05-30.
 */

const _ = require('lodash');
const debug = require('debug');

const Plugins = require('./lib/plugin');
const { wrapCompletedHandlers } = require('./lib/util');
const JsonSerialization = require('./lib/serialization/json');
const BuiltInPlugins = require('./lib/plugins/index');
const BuiltInEngines = require('./lib/engines/index');

const log = {
  info: debug('bunnyhop:info'),
  error: debug('bunnyhop:error'),
  debug: debug('bunnyhop:debug')
};

function BunnyHop(serviceName, options = {}) {
  if (!_.isString(serviceName)) {
    throw new TypeError('serviceName argument is required');
  }

  /* Configure default options
      Note: you can pass in custom options which get exposed through the middleware API
  */
  _.defaults(options, {
    engine: BuiltInEngines.DefaultEngine,
    url: 'amqp://localhost',
    serialization: JsonSerialization,
    connectionManager: BuiltInEngines.DefaultEngine.ConnectionManager
    /*
    onHandlerError: fn,
    onHandlerSuccess: fn
     */
  });

  if (options.connectionName) {
    options.amqpConfig = {
      clientProperties: {
        connection_name: options.connectionName
      }
    };
  }

  let hasCustomEngine = options.engine !== BuiltInEngines.DefaultEngine;
  let registeredPlugins = [options.engine];

  const pluginManagerPromise = options.connectionManager(options.url, options.amqpConfig).then(({ channel, connection }) => {
    const pluginManager = Plugins({ channel, connection, options, serviceName });
    pluginManager.initalizePlugins(registeredPlugins);
    return pluginManager;
  });

  return {
    engine: function engine(engine) {
      registeredPlugins = [engine, ...registeredPlugins.slice(1)];
      hasCustomEngine = true;
      return this;
    },

    use: function use(plugin) {
      registeredPlugins.push(plugin);
      return this;
    },

    send: (() => {
      var _ref = _asyncToGenerator(function* (routingKey, message, options) {
        const pm = yield pluginManagerPromise;
        return pm.send(routingKey, message, options);
      });

      return function send(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
      };
    })(),

    listen: (() => {
      var _ref2 = _asyncToGenerator(function* (routingKey, listenFn, listenOptions) {
        const pm = yield pluginManagerPromise;
        const handler = wrapCompletedHandlers(listenFn, options.onHandlerError, options.onHandlerSuccess);
        return pm.listen(routingKey, handler, listenOptions);
      });

      return function listen(_x4, _x5, _x6) {
        return _ref2.apply(this, arguments);
      };
    })(),

    publish: (() => {
      var _ref3 = _asyncToGenerator(function* (routingKey, message, options) {
        const pm = yield pluginManagerPromise;
        return pm.publish(routingKey, message, options);
      });

      return function publish(_x7, _x8, _x9) {
        return _ref3.apply(this, arguments);
      };
    })(),

    subscribe(routingKey, subscribeFn, subscribeOptions) {
      return _asyncToGenerator(function* () {
        const pm = yield pluginManagerPromise;
        const handler = wrapCompletedHandlers(subscribeFn, options.onHandlerError, options.onHandlerSuccess);
        return pm.subscribe(routingKey, handler, subscribeOptions);
      })();
    }
  };
}

// Expose the built in plugins
BunnyHop.Plugins = BuiltInPlugins;
BunnyHop.Engines = BuiltInEngines;
module.exports = BunnyHop;
//# sourceMappingURL=index.js.map