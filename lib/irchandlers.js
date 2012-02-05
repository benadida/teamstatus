/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const   db = require("./db.js"),
    config = require("./config.js");

// an exported array of message handlers
exports.handlers = [
    function(host, room, from, message, cb) {
      db.logUpdate(host, room, from, message, function(err) {
        if (err) {
          cb(from + ": oops, something bad happened, your status was not recorded.");
        } else {
          cb(from + ": got your status update, thank you!");
        }
      });
    },
    function(host, room, from, message, cb) {
        cb(from + ": I am a robot. I don't say smart things.  I just listen: " +
           config.deployment_url);
    }
];
