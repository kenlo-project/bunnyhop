'use strict';

let close = (() => {
  var _ref = _asyncToGenerator(function* (closable) {
    try {
      yield closable.close();
    } catch (err) {
      log.warn(`Having trouble closing connection: ${err.message}`);
      /* catch errors */
    }
  });

  return function close(_x) {
    return _ref.apply(this, arguments);
  };
})();

/**
 * Connection function to AMQP host
 *
 * @param {string} amqpUrl
 * @param {object} options
 * @return {Promise.<{connection: *, channel: *}>}
 */


function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Created by balmasi on 2017-06-03.
 */
const amqp = require('amqplib');
const debug = require('debug');
const ON_DEATH = require('death');

const log = {
  info: debug('bunnyhop:info'),
  warn: debug('bunnyhop:warn')
};

module.exports = (() => {
  var _ref2 = _asyncToGenerator(function* (amqpUrl, options) {
    let connection;
    let channel;

    connection = yield amqp.connect(amqpUrl, options).then(function (connection) {
      log.info(`Connected to amqp host on ${amqpUrl}. Creating channel.`);
      return connection;
    }).catch(function (err) {
      throw new Error(`Could not connect to AMQP host on ${amqpUrl}. Reason: ${err.message}`);
    });

    channel = yield connection.createChannel().then(function (channel) {
      log.info(`AMQP channel open.`);
      return channel;
    }).catch(function (err) {
      throw new Error(`Could not create channel. Reason: ${err.message}`);
    });

    ON_DEATH(function (signal, error) {
      const message = `Stopping all AMQP connections due to ${signal ? `${signal} signal` : 'error'}.`;
      log.info(message);
      if (channel) {
        close(channel);
      }
      if (connection) {
        close(connection);
      }
    });

    return {
      connection,
      channel
    };
  });

  function connect(_x2, _x3) {
    return _ref2.apply(this, arguments);
  }

  return connect;
})();
//# sourceMappingURL=connectionManager.js.map