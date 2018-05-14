'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Created by balmasi on 2017-06-02.
 */
const _ = require('lodash');
const debug = require('debug');
const uuid = require('uuid');
const { EventEmitter } = require('events');

const { EXCHANGE_TYPE } = require('../amqp');

const log = {
  info: debug('bunnyhop:info:engine'),
  error: debug('bunnyhop:error:engine'),
  debug: debug('bunnyhop:debug:engine')
};

function DefaultEngine(pluginAPI) {
  const ch = pluginAPI.getChannel();
  const initialOptions = pluginAPI.getInitialOptions();
  const serviceName = pluginAPI.getServiceName();

  const defaults = {
    topicExchange: 'amq.topic',
    directExchange: 'amq.direct',
    rpcReplyQueue: `${serviceName}_rpc_replies_${uuid()}`,
    errorFormatter: err => {
      const pickedError = _.pick(err, ['name', 'message', 'name', 'stack']);
      return _.assign(pickedError, { stack: pickedError.stack && pickedError.stack.split('\n') });
    }
  };

  const engineOptions = _.merge(_.clone(defaults), initialOptions);

  const { deserialize, serialize } = engineOptions.serialization;

  const {
    directExchange,
    topicExchange,
    rpcReplyQueue
  } = engineOptions;

  log.debug(`Asserting ${EXCHANGE_TYPE.DIRECT} exchange "${directExchange}"`);
  ch.assertExchange(directExchange, EXCHANGE_TYPE.DIRECT);
  log.debug(`Asserting ${EXCHANGE_TYPE.TOPIC} exchange "${topicExchange}"`);
  ch.assertExchange(topicExchange, EXCHANGE_TYPE.TOPIC);

  ch.rpcResponseEmitter = new EventEmitter();
  ch.rpcResponseEmitter.setMaxListeners(0);

  // Generate a unique queue for this sender
  log.debug(`Asserting exclusive queue "${rpcReplyQueue}" for RPC call responses.`);
  ch.assertQueue(rpcReplyQueue, { exclusive: true }).then(() => ch.consume(rpcReplyQueue, msg => {
    ch.rpcResponseEmitter.emit(msg.properties.correlationId, msg.content);
  }, { noAck: true }));

  return {
    send: (() => {
      var _ref = _asyncToGenerator(function* (routingKey, message, options = {}) {
        const msgBuffer = new Buffer(JSON.stringify(message));

        // Generate custom publish options here (like custom headers)
        const commonOptions = _.merge({ appId: serviceName }, options, {
          persistent: true,
          headers: {
            'x-isRpc': Boolean(options.sync)
          }
        });

        const sendWithOptions = function (opt = {}) {
          return ch.publish(directExchange, routingKey, msgBuffer, _.merge(commonOptions, opt));
        };

        // Response Listen queue
        if (options.sync) {
          return new Promise((() => {
            var _ref2 = _asyncToGenerator(function* (resolve, reject) {
              const uid = options.correlationId || uuid.v4();
              const handleResponsePromise = function (msgContent) {
                const { result, error } = deserialize(msgContent);
                return !_.isUndefined(error) ? reject(error) : resolve(result);
              };
              // listen for the content emitted on the correlationId event
              ch.rpcResponseEmitter.once(uid, handleResponsePromise);
              sendWithOptions({
                replyTo: rpcReplyQueue,
                correlationId: uid
              });
            });

            return function (_x3, _x4) {
              return _ref2.apply(this, arguments);
            };
          })());
        }

        sendWithOptions();
      });

      return function send(_x, _x2) {
        return _ref.apply(this, arguments);
      };
    })(),

    listen: (() => {
      var _ref3 = _asyncToGenerator(function* (routingKey, listenFn, options = {}) {
        let getResponse = (() => {
          var _ref4 = _asyncToGenerator(function* (reqMsg) {
            let result;
            let error;
            const isRpc = _.get(reqMsg, 'properties.headers["x-isRpc"]', false);

            if (listenOptions.autoAck) {
              log.debug('Message Auto-Acknowledged');
              ch.ack(reqMsg);
            } else {
              reqMsg.ack = function () {
                log.debug('Message acknowledged.');
                ch.ack(reqMsg);
              };

              reqMsg.reject = function () {
                log.debug('Message rejected.');
                ch.reject(reqMsg);
              };
            }

            reqMsg.content = deserialize(reqMsg.content);

            const listenerReturn = listenFn(reqMsg);
            if (isRpc) {
              try {
                result = yield listenerReturn;
              } catch (err) {
                error = engineOptions.errorFormatter(err);
              }

              const response = { result, error };
              const { replyTo, correlationId } = reqMsg.properties;
              yield ch.sendToQueue(replyTo, serialize(response), { correlationId });
            }
          });

          return function getResponse(_x7) {
            return _ref4.apply(this, arguments);
          };
        })();

        if (/[*#]/g.test(routingKey)) {
          throw new TypeError('Routing key cannot contain * or # for "listen".');
        }
        const listenOptions = _.merge({ appId: serviceName, autoAck: true }, options, { noAck: false });
        // This creates a queue per every listen pattern
        const qName = routingKey;
        log.debug(`Asserting durable queue "${qName}"`);
        yield ch.assertQueue(qName, { durable: true });
        log.debug(`Binding queue "${qName}" to exchange "${directExchange}" with ${routingKey}`);
        yield ch.bindQueue(qName, directExchange, routingKey);
        yield ch.prefetch(1);

        return ch.consume(qName, getResponse, listenOptions);
      });

      return function listen(_x5, _x6) {
        return _ref3.apply(this, arguments);
      };
    })(),

    publish: (() => {
      var _ref5 = _asyncToGenerator(function* (routingKey, message, options) {
        const publishOptions = _.merge({ appId: serviceName }, options, { persistent: true });

        const msgBuffer = serialize(message);
        return ch.publish(topicExchange, routingKey, msgBuffer, publishOptions);
      });

      return function publish(_x8, _x9, _x10) {
        return _ref5.apply(this, arguments);
      };
    })(),

    subscribe: (() => {
      var _ref6 = _asyncToGenerator(function* (routingKey, listenFn, options) {
        const subscribeOptions = _.merge({ appId: serviceName, autoAck: true }, options, { noAck: false });

        const qName = `${serviceName}.subscription.${routingKey}`;
        log.debug(`Asserting durable queue "${qName}"`);
        yield ch.assertQueue(qName, { durable: true });

        log.debug(`Binding queue "${qName}" to routing "${routingKey}"`);
        yield ch.bindQueue(qName, topicExchange, routingKey);

        function transformMessage(msg) {
          if (subscribeOptions.autoAck) {
            log.debug('Message Auto-Acknowledged');
            ch.ack(msg);
          } else {
            msg.ack = () => {
              log.debug('Message acknowledged.');
              ch.ack(msg);
            };

            msg.reject = () => {
              log.debug('Message rejected.');
              ch.reject(msg);
            };
          }
          msg.content = deserialize(msg.content);
          return listenFn(msg);
        }

        return ch.consume(qName, transformMessage, subscribeOptions);
      });

      return function subscribe(_x11, _x12, _x13) {
        return _ref6.apply(this, arguments);
      };
    })()
  };
}

DefaultEngine.ConnectionManager = require('../connectionManager');

module.exports = DefaultEngine;
//# sourceMappingURL=default.engine.js.map